package com.tanmaysinghx.eggless_server.controller;

import com.tanmaysinghx.eggless_server.config.PortalSsoProperties;
import com.tanmaysinghx.eggless_server.dto.PortalAuthRequest;
import com.tanmaysinghx.eggless_server.dto.PortalAuthResponse;
import com.tanmaysinghx.eggless_server.dto.PortalRegisterRequest;
import com.tanmaysinghx.eggless_server.service.PortalSsoClient;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*", allowedHeaders = "*")
@RequiredArgsConstructor
public class AuthController {

    private final PortalSsoProperties properties;
    private final PortalSsoClient portalSsoClient;

    /**
     * Exposes public Portal SSO client configuration to the frontend SPA.
     * The sensitive appKey is NEVER exposed here.
     */
    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getConfig(jakarta.servlet.http.HttpServletRequest request) {
        Map<String, Object> config = new HashMap<>();
        config.put("baseUrl", properties.getBaseUrl());
        config.put("applicationId", properties.getApplicationId());
        config.put("clientId", properties.getClientId());

        String redirectUri = properties.getRedirectUri();
        // Dynamically adapt redirect URI to the actual incoming request host/domain
        String proto = request.getHeader("X-Forwarded-Proto");
        if (proto == null || proto.isBlank()) {
            proto = request.getScheme();
        }
        String host = request.getHeader("X-Forwarded-Host");
        if (host == null || host.isBlank()) {
            host = request.getHeader("Host");
        }
        if (host != null && !host.isBlank()) {
            redirectUri = proto + "://" + host + "/auth/callback";
        } else if (redirectUri == null || redirectUri.isBlank()) {
            redirectUri = "https://eggless.tanmaysinghx.com/auth/callback";
        }

        config.put("redirectUri", redirectUri);
        config.put("hasAppKey", properties.getAppKey() != null && !properties.getAppKey().isBlank());
        return ResponseEntity.ok(config);
    }

    /**
     * Proxies Portal SSO health/discovery check to avoid browser CORS restrictions.
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> checkHealth() {
        return ResponseEntity.ok(portalSsoClient.checkHealth());
    }

    /**
     * Proxies credentials login to Portal SSO External Auth API.
     * Keeps X-Portal-App-Key securely on the server side.
     */
    @PostMapping("/login")
    public ResponseEntity<PortalAuthResponse> login(@Valid @RequestBody PortalAuthRequest request) {
        PortalAuthResponse response = portalSsoClient.login(request.getEmail(), request.getPassword());
        if (response != null && response.isAuthenticated()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    /**
     * Proxies user registration to Portal SSO External Auth API.
     */
    @PostMapping("/register")
    public ResponseEntity<PortalAuthResponse> register(@Valid @RequestBody PortalRegisterRequest request) {
        PortalAuthResponse response = portalSsoClient.register(
                request.getEmail(),
                request.getPassword(),
                request.getFirstName(),
                request.getLastName()
        );
        if (response != null && response.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    /**
     * Proxies OAuth 2.1 authorization code exchange to Portal SSO server-side.
     * Avoids browser CORS and mixed content issues.
     */
    @PostMapping("/exchange")
    public ResponseEntity<?> exchangeCode(@RequestBody Map<String, String> body) {
        String code = body != null ? body.get("code") : null;
        String codeVerifier = body != null ? body.get("codeVerifier") : null;
        String redirectUri = body != null ? body.get("redirectUri") : null;

        if (code == null || codeVerifier == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "code and codeVerifier are required"));
        }

        try {
            Map<String, Object> tokenData = portalSsoClient.exchangeToken(code, codeVerifier, redirectUri);
            return ResponseEntity.ok(tokenData);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }
}
