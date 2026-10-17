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
    public ResponseEntity<Map<String, Object>> getConfig() {
        Map<String, Object> config = new HashMap<>();
        config.put("baseUrl", properties.getBaseUrl());
        config.put("applicationId", properties.getApplicationId());
        config.put("clientId", properties.getClientId());
        config.put("redirectUri", properties.getRedirectUri());
        config.put("hasAppKey", properties.getAppKey() != null && !properties.getAppKey().isBlank());
        return ResponseEntity.ok(config);
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
}
