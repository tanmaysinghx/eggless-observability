package com.tanmaysinghx.eggless_server.connect;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AES-256-GCM for the Portal credentials Eggless stores after "Connect with Portal SSO".
 *
 * <p>The key comes from {@code EGGLESS_SECRET_KEY} (base64, 32 bytes) or is generated once into
 * {@code ~/.eggless/secrets/connection.key}. Keeping it outside the database means a database dump
 * or backup alone does not reveal the client secret or API key.
 */
@Slf4j
@Component
public class SecretBox {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int IV_BYTES = 12;

    private final SecretKeySpec key;

    public SecretBox(
            @Value("${eggless.secret-key:}") String configuredKey,
            @Value("${eggless.home}") String home) {
        this.key = new SecretKeySpec(resolveKey(configuredKey, Path.of(home, "secrets", "connection.key")), "AES");
    }

    public String encrypt(String plaintext) {
        if (plaintext == null) {
            return null;
        }
        try {
            byte[] iv = new byte[IV_BYTES];
            RANDOM.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
            byte[] sealed = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(ByteBuffer.allocate(iv.length + sealed.length).put(iv).put(sealed).array());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Could not encrypt secret", e);
        }
    }

    public String decrypt(String encoded) {
        if (encoded == null) {
            return null;
        }
        try {
            byte[] all = Base64.getDecoder().decode(encoded);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, all, 0, IV_BYTES));
            return new String(cipher.doFinal(all, IV_BYTES, all.length - IV_BYTES), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException(
                    "Stored Portal credentials cannot be decrypted. Was connection.key or EGGLESS_SECRET_KEY changed? "
                            + "Reconnect Eggless to Portal SSO.", e);
        }
    }

    private static byte[] resolveKey(String configured, Path keyFile) {
        if (configured != null && !configured.isBlank()) {
            byte[] bytes = Base64.getDecoder().decode(configured.trim());
            if (bytes.length != 32) {
                throw new IllegalStateException("EGGLESS_SECRET_KEY must be base64 for exactly 32 bytes");
            }
            return bytes;
        }
        try {
            if (Files.exists(keyFile)) {
                return Base64.getDecoder().decode(Files.readString(keyFile).trim());
            }
            byte[] bytes = new byte[32];
            RANDOM.nextBytes(bytes);
            SecretFiles.writeOwnerOnly(keyFile, Base64.getEncoder().encodeToString(bytes));
            log.info("Generated credential encryption key at {}. Back it up with the database.", keyFile);
            return bytes;
        } catch (IOException e) {
            throw new IllegalStateException("Cannot read or create " + keyFile, e);
        }
    }

    /** Owner-only files where the filesystem supports it (POSIX); best effort elsewhere. */
    static final class SecretFiles {
        private SecretFiles() {}

        static void writeOwnerOnly(Path file, String content) throws IOException {
            Files.createDirectories(file.getParent());
            Files.writeString(file, content);
            try {
                Files.setPosixFilePermissions(file, PosixFilePermissions.fromString("rw-------"));
            } catch (UnsupportedOperationException ignored) {
                // Windows: inherits the user profile's ACLs.
            }
        }
    }
}
