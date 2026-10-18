package com.tanmaysinghx.eggless_server.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "eggless_api_keys")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiKeyEntity {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, length = 32)
    private String tokenPrefix; // e.g. "egg_sec_991..."

    @Column(nullable = false, length = 128)
    private String tokenHash;

    private String created;

    private String lastUsed;

    private Instant lastUsedAt;

    /** When set, the key may only send logs for this application (service name). */
    @Column(length = 64)
    private String application;

    @Column(length = 16)
    private String status; // active, revoked

    private Instant createdAt;
}
