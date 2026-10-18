package com.tanmaysinghx.eggless_server.service;

import com.tanmaysinghx.eggless_server.dto.ApiKeyDto;
import com.tanmaysinghx.eggless_server.dto.ApplicationDto;
import com.tanmaysinghx.eggless_server.dto.ApplicationRegistrationDto;
import com.tanmaysinghx.eggless_server.dto.CreateApplicationRequest;
import com.tanmaysinghx.eggless_server.entity.ApplicationEntity;
import com.tanmaysinghx.eggless_server.repository.ApplicationRepository;
import com.tanmaysinghx.eggless_server.repository.LogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Applications are registered from the service names seen in ingested logs. Rates and health are
 * computed from recent logs on read, so they always reflect what is actually arriving.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ApplicationService {

    /** Window used for logs/min, errors/min and health. */
    static final Duration RATE_WINDOW = Duration.ofMinutes(5);
    /** An application that has sent nothing for this long is reported as degraded. */
    static final Duration STALE_AFTER = Duration.ofMinutes(15);
    /** Avoids a write per log: lastSeen is only refreshed when it is older than this. */
    private static final Duration LAST_SEEN_RESOLUTION = Duration.ofSeconds(10);

    private static final Pattern NAME = Pattern.compile("[a-z0-9][a-z0-9._-]{1,62}[a-z0-9]");
    private static final Set<String> ENVIRONMENTS = Set.of("production", "staging", "development");

    private final ApplicationRepository applicationRepository;
    private final LogRepository logRepository;
    private final ApiKeyService apiKeyService;

    @Transactional(readOnly = true)
    public List<ApplicationDto> getAllApplications() {
        Instant now = Instant.now();
        Map<String, long[]> recent = countsByService(now.minus(RATE_WINDOW), now);
        Map<String, long[]> daily = countsByService(now.minus(Duration.ofHours(24)), now);

        return applicationRepository.findAll().stream()
                .map(app -> toDto(app, recent.getOrDefault(app.getName(), new long[2]),
                        daily.getOrDefault(app.getName(), new long[2]), now))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ApplicationDto getApplication(String id) {
        ApplicationEntity app = applicationRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Application not found: " + id));
        Instant now = Instant.now();
        return toDto(app, countsByService(now.minus(RATE_WINDOW), now).getOrDefault(app.getName(), new long[2]),
                countsByService(now.minus(Duration.ofHours(24)), now).getOrDefault(app.getName(), new long[2]), now);
    }

    /**
     * Registers an application before it sends logs and creates an ingestion key bound to it. The
     * name is what the application sends as "service" in each log.
     */
    @Transactional
    public ApplicationRegistrationDto register(CreateApplicationRequest request) {
        String name = request.getName() == null ? "" : request.getName().trim().toLowerCase(Locale.ROOT);
        if (!NAME.matcher(name).matches()) {
            throw new IllegalArgumentException("Name must be 3-64 characters of lowercase letters, digits, '.', '_' or '-', "
                    + "starting and ending with a letter or digit (e.g. payment-api)");
        }
        if (applicationRepository.existsByNameIgnoreCase(name)) {
            throw new IllegalArgumentException("An application named '" + name + "' already exists");
        }
        String environment = request.getEnvironment() == null ? "production" : request.getEnvironment().trim().toLowerCase(Locale.ROOT);
        if (!ENVIRONMENTS.contains(environment)) {
            throw new IllegalArgumentException("Environment must be one of production, staging or development");
        }
        String description = request.getDescription() == null || request.getDescription().isBlank()
                ? null : request.getDescription().trim();
        if (description != null && description.length() > 255) {
            throw new IllegalArgumentException("Description must be at most 255 characters");
        }

        ApplicationEntity app = applicationRepository.save(ApplicationEntity.builder()
                .id("app_" + UUID.randomUUID().toString().substring(0, 8))
                .name(name)
                .environment(environment)
                .description(description)
                .createdAt(Instant.now())
                .build());
        ApiKeyDto key = apiKeyService.createKey(name + " ingestion key", name);
        return new ApplicationRegistrationDto(toDto(app, new long[2], new long[2], Instant.now()), key);
    }

    @Transactional(readOnly = true)
    public Optional<String> environmentOf(String name) {
        return applicationRepository.findByName(name).map(ApplicationEntity::getEnvironment);
    }

    /** Removes the application and revokes its keys. Its logs stay until retention deletes them. */
    @Transactional
    public void delete(String id) {
        ApplicationEntity app = applicationRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Application not found: " + id));
        apiKeyService.revokeKeysFor(app.getName());
        applicationRepository.delete(app);
    }

    @Transactional
    public void recordLogActivity(String serviceName, String environment, Instant occurredAt) {
        if (serviceName == null || serviceName.isBlank()) return;

        ApplicationEntity app = applicationRepository.findByName(serviceName).orElse(null);
        if (app == null) {
            app = ApplicationEntity.builder()
                    .id("app_" + UUID.randomUUID().toString().substring(0, 8))
                    .name(serviceName)
                    .environment(environment != null ? environment : "production")
                    .description("Registered automatically from ingested logs")
                    .build();
        } else if (app.getLastSeen() != null && !occurredAt.isAfter(app.getLastSeen().plus(LAST_SEEN_RESOLUTION))) {
            return;
        }

        app.setLastSeen(occurredAt);
        applicationRepository.save(app);
    }

    /** service -> [total, errors] between from and to. */
    private Map<String, long[]> countsByService(Instant from, Instant to) {
        Map<String, long[]> result = new HashMap<>();
        for (Object[] row : logRepository.countByServiceAndLevel(from, to, null, null)) {
            long[] c = result.computeIfAbsent((String) row[0], k -> new long[2]);
            long n = ((Number) row[2]).longValue();
            c[0] += n;
            if (MetricsService.isError((String) row[1])) c[1] += n;
        }
        return result;
    }

    private ApplicationDto toDto(ApplicationEntity entity, long[] recent, long[] daily, Instant now) {
        double minutes = RATE_WINDOW.toSeconds() / 60.0;
        int logsPerMin = (int) Math.round(recent[0] / minutes);
        int errorsPerMin = (int) Math.round(recent[1] / minutes);

        return ApplicationDto.builder()
                .id(entity.getId())
                .name(entity.getName())
                .environment(entity.getEnvironment())
                .lastLog(relative(entity.getLastSeen(), now))
                .logsPerMin(logsPerMin)
                .errorsPerMin(errorsPerMin)
                .errorCount(daily[1])
                .uptime(daily[0] == 0 ? "—" : String.format("%.2f%%", 100.0 * (daily[0] - daily[1]) / daily[0]))
                .status(status(recent, entity.getLastSeen(), now))
                .description(entity.getDescription())
                .createdAt(entity.getCreatedAt() != null ? entity.getCreatedAt().toString() : null)
                .build();
    }

    /**
     * pending: registered but no logs yet. critical: 10%+ of recent logs are errors. warning: any
     * recent errors, or silent for {@link #STALE_AFTER}. Otherwise healthy.
     */
    static String status(long[] recent, Instant lastSeen, Instant now) {
        if (lastSeen == null && recent[0] == 0) return "pending";
        if (recent[0] > 0 && recent[1] * 10 >= recent[0]) return "critical";
        if (recent[1] > 0) return "warning";
        if (lastSeen == null || lastSeen.isBefore(now.minus(STALE_AFTER))) return "warning";
        return "healthy";
    }

    static String relative(Instant then, Instant now) {
        if (then == null) return "Never";
        long seconds = Math.max(Duration.between(then, now).toSeconds(), 0);
        if (seconds < 60) return "Just now";
        if (seconds < 3600) return (seconds / 60) + "m ago";
        if (seconds < 86400) return (seconds / 3600) + "h ago";
        return (seconds / 86400) + "d ago";
    }
}
