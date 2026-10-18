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
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ApiKeyService {

    private static final DateTimeFormatter LAST_USED_FORMAT = DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm 'UTC'")
            .withZone(ZoneOffset.UTC);

    private final ApiKeyRepository apiKeyRepository;

    @Transactional(readOnly = true)
    public List<ApiKeyDto> getAllKeys() {
        return apiKeyRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public ApiKeyDto createKey(String name) {
        return createKey(name, null);
    }

    /** Creates a key; when {@code application} is set the key may only send logs for that application. */
    @Transactional
    public ApiKeyDto createKey(String name, String application) {
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
                .application(application)
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

    /**
     * Returns the active key the token belongs to, if any. Records when the key was last used, at
     * most once a minute so ingestion does not write the key row on every request.
     */
    @Transactional
    public Optional<ApiKeyEntity> authenticate(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return Optional.empty();
        String hash = hashToken(rawToken.trim());
        return apiKeyRepository.findByTokenHash(hash)
                .filter(k -> "active".equalsIgnoreCase(k.getStatus()))
                .map(k -> {
                    Instant now = Instant.now();
                    if (k.getLastUsedAt() == null || k.getLastUsedAt().isBefore(now.minusSeconds(60))) {
                        k.setLastUsedAt(now);
                        k.setLastUsed(LAST_USED_FORMAT.format(now));
                        apiKeyRepository.save(k);
                    }
                    return k;
                });
    }

    /** Revokes every key bound to an application. */
    @Transactional
    public void revokeKeysFor(String application) {
        apiKeyRepository.findByApplication(application).forEach(k -> k.setStatus("revoked"));
    }

    @Transactional(readOnly = true)
    public List<ApiKeyDto> keysFor(String application) {
        return apiKeyRepository.findByApplication(application).stream().map(this::toDto).collect(Collectors.toList());
    }

    public ApiKeyDto toDto(ApiKeyEntity entity) {
        return ApiKeyDto.builder()
                .id(entity.getId())
                .name(entity.getName())
                .tokenPrefix(entity.getTokenPrefix())
                .created(entity.getCreated())
                .lastUsed(entity.getLastUsed())
                .status(entity.getStatus())
                .application(entity.getApplication())
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
