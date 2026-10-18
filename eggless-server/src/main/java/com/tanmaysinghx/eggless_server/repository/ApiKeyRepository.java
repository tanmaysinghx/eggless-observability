package com.tanmaysinghx.eggless_server.repository;

import com.tanmaysinghx.eggless_server.entity.ApiKeyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ApiKeyRepository extends JpaRepository<ApiKeyEntity, String> {
    List<ApiKeyEntity> findAllByOrderByCreatedAtDesc();
    Optional<ApiKeyEntity> findByTokenHash(String tokenHash);
    List<ApiKeyEntity> findByApplication(String application);
}
