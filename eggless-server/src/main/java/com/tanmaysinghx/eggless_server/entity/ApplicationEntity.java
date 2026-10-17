package com.tanmaysinghx.eggless_server.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "eggless_applications")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApplicationEntity {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false, length = 64)
    private String name;

    @Column(nullable = false, length = 32)
    private String environment; // production, staging, development

    private String lastLog;

    private int logsPerMin;

    private int errorsPerMin;

    private long errorCount;

    private String uptime;

    @Column(length = 16)
    private String status; // healthy, warning, critical

    private String description;

    private Instant lastSeen;
}
