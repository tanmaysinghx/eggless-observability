package com.tanmaysinghx.eggless_server.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

@Entity
@Table(name = "eggless_logs", indexes = {
        @Index(name = "idx_logs_timestamp", columnList = "fullTimestamp"),
        @Index(name = "idx_logs_service", columnList = "service"),
        @Index(name = "idx_logs_level", columnList = "level"),
        @Index(name = "idx_logs_env", columnList = "environment")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LogEntryEntity {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false)
    private String timestamp; // Display timestamp e.g. "20:41:32.182"

    @Column(nullable = false)
    private Instant fullTimestamp; // ISO Instant for sorting and filtering

    @Column(nullable = false, length = 16)
    private String level; // INFO, WARN, ERROR, DEBUG, TRACE, FATAL

    @Column(nullable = false, length = 64)
    private String service;

    @Column(nullable = false, length = 32)
    private String environment; // production, staging, development

    @Column(columnDefinition = "TEXT", nullable = false)
    private String message;

    @Column(length = 64)
    private String traceId;

    @Column(length = 64)
    private String requestId;

    @Column(length = 64)
    private String userId;

    @Column(length = 64)
    private String host;

    @Column(columnDefinition = "TEXT")
    private String metadata; // JSON serialized map

    @Column(columnDefinition = "TEXT")
    private String stackTrace;

    @PrePersist
    public void prePersist() {
        if (this.fullTimestamp == null) {
            this.fullTimestamp = Instant.now();
        }
        if (this.timestamp == null) {
            this.timestamp = DateTimeFormatter.ofPattern("HH:mm:ss.SSS")
                    .withZone(ZoneOffset.UTC)
                    .format(this.fullTimestamp);
        }
    }
}
