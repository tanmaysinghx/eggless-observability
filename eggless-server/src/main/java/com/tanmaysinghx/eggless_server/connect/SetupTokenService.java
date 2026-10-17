package com.tanmaysinghx.eggless_server.connect;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Guards connecting (and disconnecting) Eggless to a Portal.
 *
 * <p>Eggless has no accounts of its own before it is connected, so without this anyone who could
 * reach a fresh instance could pair it with <em>their</em> Portal and decide who signs in. The token
 * lives on the server's filesystem ({@code ~/.eggless/secrets/setupToken}, printed at startup), so
 * only whoever operates the server can use it. Set {@code EGGLESS_SETUP_TOKEN} to choose it.
 */
@Slf4j
@Component
public class SetupTokenService {

    private final String token;
    private final Path tokenFile;

    public SetupTokenService(
            @Value("${eggless.setup-token:}") String configured,
            @Value("${eggless.home}") String home) throws IOException {
        this.tokenFile = Path.of(home, "secrets", "setupToken");
        if (configured != null && !configured.isBlank()) {
            this.token = configured.trim();
        } else if (Files.exists(tokenFile)) {
            this.token = Files.readString(tokenFile).trim();
        } else {
            byte[] bytes = new byte[18];
            new SecureRandom().nextBytes(bytes);
            this.token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
            SecretBox.SecretFiles.writeOwnerOnly(tokenFile, token);
        }
    }

    public boolean matches(String candidate) {
        return candidate != null && MessageDigest.isEqual(
                candidate.trim().getBytes(StandardCharsets.UTF_8), token.getBytes(StandardCharsets.UTF_8));
    }

    public void announce(boolean connected) {
        if (connected) {
            log.info("Portal SSO: connected. Setup token (needed to reconnect or disconnect) is in {}", tokenFile);
            return;
        }
        log.info("""

                *************************************************************
                Eggless is not connected to Portal SSO yet.
                Open Eggless, choose "Connect with Portal SSO" and enter:

                    {}

                (also stored in {})
                *************************************************************
                """, token, tokenFile);
    }

    public Path tokenFile() {
        return tokenFile;
    }
}
