package com.tanmaysinghx.eggless_server.service;

import com.tanmaysinghx.eggless_server.repository.LogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

/** Deletes logs older than {@code eggless.retention.days}. A value of 0 keeps logs forever. */
@Slf4j
@Service
@RequiredArgsConstructor
public class RetentionService {

    private final LogRepository logRepository;

    @Value("${eggless.retention.days:7}")
    private int retentionDays;

    public int getRetentionDays() {
        return retentionDays;
    }

    @Scheduled(initialDelay = 60_000, fixedDelayString = "${eggless.retention.interval-ms:3600000}")
    @Transactional
    public void purgeExpiredLogs() {
        if (retentionDays <= 0) return;
        int deleted = logRepository.deleteOlderThan(Instant.now().minus(Duration.ofDays(retentionDays)));
        if (deleted > 0) {
            log.info("Retention: deleted {} logs older than {} days", deleted, retentionDays);
        }
    }
}
