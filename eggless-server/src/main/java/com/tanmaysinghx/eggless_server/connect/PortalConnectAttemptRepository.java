package com.tanmaysinghx.eggless_server.connect;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PortalConnectAttemptRepository extends JpaRepository<PortalConnectAttemptEntity, String> {
    Optional<PortalConnectAttemptEntity> findFirstByOrderByCreatedAtDesc();
}
