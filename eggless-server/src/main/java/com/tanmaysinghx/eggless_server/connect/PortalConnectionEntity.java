package com.tanmaysinghx.eggless_server.connect;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * The Portal this Eggless instance is connected to. A single row ({@link #SINGLETON_ID}). Secrets
 * are AES-GCM encrypted by {@link SecretBox}; the key is not in the database.
 */
@Entity
@Table(name = "eggless_portal_connection")
@Getter
@Setter
@NoArgsConstructor
public class PortalConnectionEntity {

    public static final long SINGLETON_ID = 1L;

    @Id
    private Long id = SINGLETON_ID;

    @Column(nullable = false, length = 500)
    private String portalUrl;

    @Column(nullable = false, length = 500)
    private String publicUrl;

    @Column(length = 64)
    private String applicationId;

    @Column(nullable = false, length = 100)
    private String clientId;

    @Column(length = 1000)
    private String clientSecretEnc;

    @Column(length = 1000)
    private String apiKeyEnc;

    @Column(nullable = false, length = 500)
    private String redirectUri;

    @Column(length = 200)
    private String scopes;

    @Column(length = 500)
    private String loginEndpoint;

    @Column(length = 500)
    private String registerEndpoint;

    private Instant connectedAt;
}
