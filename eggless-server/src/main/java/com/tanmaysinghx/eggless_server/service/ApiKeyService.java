package com.tanmaysinghx.eggless_server.service;

import com.tanmaysinghx.eggless_server.dto.ApiKeyDto;
import com.tanmaysinghx.eggless_server.entity.ApiKeyEntity;
import com.tanmaysinghx.eggless_server.repository.ApiKeyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ApiKeyService {

    private final ApiKeyRepository apiKeyRepository;

    @Transactional(readOnly = true)
    public List<ApiKeyDto> getAllKeys() {
        return apiKeyRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public ApiKeyDto createKey(String name) {
        String rawToken = "egg_sec_" + UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().substring(0, 8);
        String prefix = rawToken.substring(0, 16) + "...";
        String tokenHash = hashToken(rawToken);

        String dateStr = DateTimeFormatter.ofPattern("MMM dd, yyyy")
                .withZone(ZoneOffset.UTC)
                .format(Instant.now());

        ApiKeyEntity entity = ApiKeyEntity.builder()
                .id("key_" + UUID.randomUUID().toString().substring(0, 8))
                .name(name != null && !name.isBlank() ? name : "Default Ingestion Token")
                .tokenPrefix(prefix)
                .tokenHash(tokenHash)
                .created(dateStr)
                .lastUsed("Never")
                .status("active")
                .createdAt(Instant.now())
                .build();

        ApiKeyEntity saved = apiKeyRepository.save(entity);
        ApiKeyDto dto = toDto(saved);
        dto.setToken(rawToken); // Reveal raw token once upon creation
        return dto;
    }

    @Transactional
    public void revokeKey(String id) {
        apiKeyRepository.findById(id).ifPresent(entity -> {
            entity.setStatus("revoked");
            apiKeyRepository.save(entity);
        });
    }

    @Transactional(readOnly = true)
    public boolean validateToken(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return false;
        String hash = hashToken(rawToken);
        return apiKeyRepository.findByTokenHash(hash)
                .map(k -> "active".equalsIgnoreCase(k.getStatus()))
                .orElse(false);
    }

    public ApiKeyDto toDto(ApiKeyEntity entity) {
        return ApiKeyDto.builder()
                .id(entity.getId())
                .name(entity.getName())
                .tokenPrefix(entity.getTokenPrefix())
                .created(entity.getCreated())
                .lastUsed(entity.getLastUsed())
                .status(entity.getStatus())
                .build();
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}
