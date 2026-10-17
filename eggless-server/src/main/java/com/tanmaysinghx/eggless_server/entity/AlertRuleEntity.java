package com.tanmaysinghx.eggless_server.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "eggless_alert_rules")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertRuleEntity {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String application;

    @Column(name = "search_query")
    private String query;

    @Column(name = "alert_condition")
    private String condition; // e.g. "count > 100"

    @Column(name = "time_window")
    private String window; // e.g. "5m"

    private String channel; // e.g. "Slack #alerts-prod"

    private boolean enabled;

    private String lastTriggered;

    @Column(length = 16)
    private String status; // ok, triggered, disabled

    private Instant createdAt;
}
