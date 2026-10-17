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
 * A connection request Eggless has submitted and not yet completed. Persisted rather than kept in
 * memory because an administrator may approve hours later, after a restart. The verifier is what
 * proves to Portal that this backend submitted the request, so it is stored encrypted.
 */
@Entity
@Table(name = "eggless_portal_connect_attempts")
@Getter
@Setter
@NoArgsConstructor
public class PortalConnectAttemptEntity {

    @Id
    @Column(length = 36)
    private String requestId;

    @Column(nullable = false, length = 500)
    private String portalUrl;

    @Column(nullable = false, length = 500)
    private String publicUrl;

    @Column(nullable = false, length = 500)
    private String verifierEnc;

    @Column(nullable = false, length = 1000)
    private String approvalUrl;

    private Instant createdAt;

    private Instant expiresAt;
}
