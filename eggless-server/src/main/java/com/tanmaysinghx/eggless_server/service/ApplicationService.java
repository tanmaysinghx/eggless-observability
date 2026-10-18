package com.tanmaysinghx.eggless_server.service;

import com.tanmaysinghx.eggless_server.dto.ApplicationDto;
import com.tanmaysinghx.eggless_server.entity.ApplicationEntity;
import com.tanmaysinghx.eggless_server.repository.ApplicationRepository;
import com.tanmaysinghx.eggless_server.repository.LogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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

    private final ApplicationRepository applicationRepository;
    private final LogRepository logRepository;

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
                .build();
    }

    /**
     * critical: 10%+ of recent logs are errors. warning: any recent errors, or silent for
     * {@link #STALE_AFTER}. Otherwise healthy.
     */
    static String status(long[] recent, Instant lastSeen, Instant now) {
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
