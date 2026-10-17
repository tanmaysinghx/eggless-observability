package com.tanmaysinghx.eggless_server.service;

import com.tanmaysinghx.eggless_server.dto.ApplicationDto;
import com.tanmaysinghx.eggless_server.entity.ApplicationEntity;
import com.tanmaysinghx.eggless_server.repository.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ApplicationService {

    private final ApplicationRepository applicationRepository;

    @Transactional(readOnly = true)
    public List<ApplicationDto> getAllApplications() {
        return applicationRepository.findAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public void recordLogActivity(String serviceName, String environment, String level) {
        if (serviceName == null || serviceName.isBlank()) return;

        ApplicationEntity app = applicationRepository.findByName(serviceName)
                .orElseGet(() -> ApplicationEntity.builder()
                        .id("app_" + UUID.randomUUID().toString().substring(0, 8))
                        .name(serviceName)
                        .environment(environment != null ? environment : "production")
                        .status("healthy")
                        .uptime("99.98%")
                        .description("Microservice registered via live telemetry")
                        .build()
                );

        app.setLastSeen(Instant.now());
        app.setLastLog("Just now");
        app.setLogsPerMin(Math.max(app.getLogsPerMin() + 1, 1));

        if ("ERROR".equalsIgnoreCase(level) || "FATAL".equalsIgnoreCase(level)) {
            app.setErrorCount(app.getErrorCount() + 1);
            app.setErrorsPerMin(app.getErrorsPerMin() + 1);
            app.setStatus(app.getErrorCount() > 50 ? "critical" : "warning");
        }

        applicationRepository.save(app);
    }

    public ApplicationDto toDto(ApplicationEntity entity) {
        return ApplicationDto.builder()
                .id(entity.getId())
                .name(entity.getName())
                .environment(entity.getEnvironment())
                .lastLog(entity.getLastLog() != null ? entity.getLastLog() : "Active")
                .logsPerMin(entity.getLogsPerMin())
                .errorsPerMin(entity.getErrorsPerMin())
                .errorCount(entity.getErrorCount())
                .uptime(entity.getUptime() != null ? entity.getUptime() : "99.9%")
                .status(entity.getStatus() != null ? entity.getStatus() : "healthy")
                .description(entity.getDescription())
                .build();
    }
}
