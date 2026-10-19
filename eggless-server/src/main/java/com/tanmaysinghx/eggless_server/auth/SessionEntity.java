package com.tanmaysinghx.eggless_server.auth;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** A signed-in browser. Only the SHA-256 of the cookie value is stored. */
@Entity
@Table(name = "eggless_sessions")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionEntity {

    @Id
    @Column(length = 64)
    private String tokenHash;

    @Column(nullable = false)
    private String userId;

    private String email;

    private String name;

    /** Comma-separated, e.g. "ROLE_ADMIN,ROLE_USER". */
    @Column(length = 512)
    private String roles;

    /** How the user signed in, e.g. "Portal SSO (OAuth 2.1 / OIDC PKCE)". */
    private String provider;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant expiresAt;
}
