package com.tanmaysinghx.eggless_server.controller;

import com.tanmaysinghx.eggless_server.auth.SessionService;
import com.tanmaysinghx.eggless_server.auth.SessionUser;
import com.tanmaysinghx.eggless_server.config.PortalSsoProperties;
import com.tanmaysinghx.eggless_server.dto.PortalAuthRequest;
import com.tanmaysinghx.eggless_server.dto.PortalAuthResponse;
import com.tanmaysinghx.eggless_server.dto.PortalRegisterRequest;
import com.tanmaysinghx.eggless_server.dto.PortalUserDto;
import com.tanmaysinghx.eggless_server.service.PortalSsoClient;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*", allowedHeaders = "*")
@RequiredArgsConstructor
public class AuthController {

    private final PortalSsoProperties properties;
    private final PortalSsoClient portalSsoClient;
    private final SessionService sessionService;

    /** Lets anyone who can reach the server sign in as a local admin, without Portal. Trusted networks only. */
    @Value("${eggless.auth.local-login:false}")
    private boolean localLogin;

    /**
     * Exposes public Portal SSO client configuration to the frontend SPA.
     * The sensitive appKey is NEVER exposed here.
     */
    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getConfig() {
        Map<String, Object> config = new HashMap<>();
        config.put("baseUrl", properties.getNormalizedBaseUrl());
        config.put("applicationId", properties.getApplicationId());
        config.put("clientId", properties.getClientId());
        // Must match a URI registered in Portal SSO exactly; never derived from the request host.
        config.put("redirectUri", properties.getRedirectUri());
        config.put("scopes", properties.getScopes());
        config.put("hasAppKey", properties.getAppKey() != null && !properties.getAppKey().isBlank());
        // False until env vars or "Connect with Portal SSO" supply a Portal; the login screen then offers setup.
        config.put("configured", !properties.getNormalizedBaseUrl().isBlank()
                && properties.getClientSecret() != null && !properties.getClientSecret().isBlank());
        config.put("localLogin", localLogin);
        return ResponseEntity.ok(config);
    }

    /** The signed-in user, or 401. The SPA calls this to restore a session after a reload. */
    @GetMapping("/me")
    public ResponseEntity<SessionUser> me(HttpServletRequest request) {
        return sessionService.current(request)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        sessionService.signOut(request, response);
        return ResponseEntity.noContent().build();
    }

    /** Signs in as the local admin when {@code EGGLESS_LOCAL_LOGIN=true}; otherwise 403. */
    @PostMapping("/local")
    public ResponseEntity<?> localLogin(HttpServletRequest request, HttpServletResponse response) {
        if (!localLogin) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Local sign-in is disabled. Set EGGLESS_LOCAL_LOGIN=true to enable it."));
        }
        return ResponseEntity.ok(sessionService.signIn("local-admin", "admin@localhost", "Local Admin",
                List.of("ROLE_ADMIN", "ROLE_USER"), "Local sign-in (EGGLESS_LOCAL_LOGIN)", request, response));
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
    public ResponseEntity<PortalAuthResponse> login(@Valid @RequestBody PortalAuthRequest request,
                                                    HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        PortalAuthResponse response = portalSsoClient.login(request.getEmail(), request.getPassword());
        if (response != null && response.isAuthenticated() && response.getUser() != null) {
            signIn(response.getUser(), "Portal SSO External Auth API", httpRequest, httpResponse);
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    /**
     * Proxies user registration to Portal SSO External Auth API.
     */
    @PostMapping("/register")
    public ResponseEntity<PortalAuthResponse> register(@Valid @RequestBody PortalRegisterRequest request,
                                                       HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        PortalAuthResponse response = portalSsoClient.register(
                request.getEmail(),
                request.getPassword(),
                request.getFirstName(),
                request.getLastName()
        );
        if (response != null && response.isAuthenticated() && response.getUser() != null) {
            signIn(response.getUser(), "Portal SSO Headless Registration", httpRequest, httpResponse);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    /**
     * Proxies OAuth 2.1 authorization code exchange to Portal SSO server-side.
     * Avoids browser CORS and mixed content issues.
     */
    @PostMapping("/exchange")
    public ResponseEntity<?> exchangeCode(@RequestBody Map<String, String> body,
                                          HttpServletRequest request, HttpServletResponse response) {
        String code = body != null ? body.get("code") : null;
        String codeVerifier = body != null ? body.get("codeVerifier") : null;
        String redirectUri = body != null ? body.get("redirectUri") : null;

        if (code == null || codeVerifier == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "code and codeVerifier are required"));
        }
        if (redirectUri == null || redirectUri.isBlank()) {
            redirectUri = properties.getRedirectUri();
        }
        if (!redirectUri.equals(properties.getRedirectUri()) && !redirectUri.equals(properties.getPopupRedirectUri())) {
            return ResponseEntity.badRequest().body(Map.of("error", "redirectUri is not a registered Portal SSO redirect URI"));
        }

        try {
            Map<String, Object> tokenData = portalSsoClient.exchangeToken(code, codeVerifier, redirectUri);
            if (tokenData.get("claims") instanceof Map<?, ?> claims) {
                signIn(claims, request, response);
            }
            return ResponseEntity.ok(tokenData);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    private void signIn(PortalUserDto user, String provider, HttpServletRequest request, HttpServletResponse response) {
        String name = Stream.of(user.getFirstName(), user.getLastName())
                .filter(n -> n != null && !n.isBlank()).reduce((a, b) -> a + " " + b).orElse(user.getEmail());
        sessionService.signIn(user.getId() != null ? user.getId() : user.getEmail(), user.getEmail(), name,
                user.getRoles() != null && !user.getRoles().isEmpty() ? user.getRoles() : List.of("ROLE_USER"),
                provider, request, response);
    }

    /** Signs in the user described by the verified ID token claims. */
    private void signIn(Map<?, ?> claims, HttpServletRequest request, HttpServletResponse response) {
        String email = string(claims.get("email"));
        String name = string(claims.get("name"));
        if (name == null) {
            name = Stream.of(string(claims.get("given_name")), string(claims.get("family_name")))
                    .filter(n -> n != null).reduce((a, b) -> a + " " + b)
                    .orElse(string(claims.get("preferred_username")));
        }
        List<String> roles = claims.get("roles") instanceof Collection<?> c && !c.isEmpty()
                ? c.stream().map(String::valueOf).toList() : List.of("ROLE_USER");
        String sub = string(claims.get("sub"));
        sessionService.signIn(sub != null ? sub : email, email, name, roles,
                "Portal SSO (OAuth 2.1 / OIDC PKCE)", request, response);
    }

    private static String string(Object value) {
        return value == null || value.toString().isBlank() ? null : value.toString();
    }
}
