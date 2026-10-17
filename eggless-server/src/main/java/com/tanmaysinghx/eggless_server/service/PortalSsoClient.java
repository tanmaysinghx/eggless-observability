package com.tanmaysinghx.eggless_server.service;

import com.tanmaysinghx.eggless_server.config.PortalSsoProperties;
import com.tanmaysinghx.eggless_server.dto.PortalAuthRequest;
import com.tanmaysinghx.eggless_server.dto.PortalAuthResponse;
import com.tanmaysinghx.eggless_server.dto.PortalRegisterRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Client service implementing the Portal SSO External Auth API and OAuth 2.1 token exchange.
 * Handles programmatic auto-login, machine/agent auth, headless user registration,
 * and server-side OAuth2 authorization code exchange (avoiding browser CORS).
 */
@Slf4j
@Service
public class PortalSsoClient {

    private final PortalSsoProperties properties;
    private final RestClient restClient;
    private JwtDecoder idTokenDecoder;

    public PortalSsoClient(PortalSsoProperties properties) {
        this.properties = properties;
        this.restClient = RestClient.builder()
                .baseUrl(properties.getNormalizedBaseUrl())
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    /**
     * Authenticate user credentials against Portal SSO.
     */
    public PortalAuthResponse login(String email, String password) {
        String url = String.format("/api/external/apps/%s/login", properties.getApplicationId());
        log.info("Authenticating with Portal SSO at {} for {}", url, email);

        try {
            return restClient.post()
                    .uri(url)
                    .header("X-Portal-App-Key", properties.getAppKey())
                    .body(new PortalAuthRequest(email, password))
                    .retrieve()
                    .body(PortalAuthResponse.class);
        } catch (org.springframework.web.client.RestClientResponseException rcEx) {
            String body = rcEx.getResponseBodyAsString();
            log.error("Portal SSO login error ({}): {}", rcEx.getStatusCode(), body);
            String message = extractErrorMessage(body, "Portal SSO authentication failed (" + rcEx.getStatusCode() + ")");
            return PortalAuthResponse.builder()
                    .authenticated(false)
                    .error("AUTH_FAILED")
                    .message(message)
                    .build();
        } catch (Exception e) {
            log.error("Portal SSO login failed: {}", e.getMessage());
            return PortalAuthResponse.builder()
                    .authenticated(false)
                    .error("AUTH_FAILED")
                    .message(e.getMessage() != null ? e.getMessage() : "Portal SSO authentication failed")
                    .build();
        }
    }

    /**
     * Register a new user in Portal SSO under this application.
     */
    public PortalAuthResponse register(String email, String password, String firstName, String lastName) {
        String url = String.format("/api/external/apps/%s/register", properties.getApplicationId());
        log.info("Registering user in Portal SSO at {} for {}", url, email);

        try {
            return restClient.post()
                    .uri(url)
                    .header("X-Portal-App-Key", properties.getAppKey())
                    .body(new PortalRegisterRequest(email, password, firstName, lastName))
                    .retrieve()
                    .body(PortalAuthResponse.class);
        } catch (org.springframework.web.client.RestClientResponseException rcEx) {
            String body = rcEx.getResponseBodyAsString();
            log.error("Portal SSO registration error ({}): {}", rcEx.getStatusCode(), body);
            String message = extractErrorMessage(body, "Portal SSO registration failed (" + rcEx.getStatusCode() + ")");
            return PortalAuthResponse.builder()
                    .authenticated(false)
                    .error("REGISTRATION_FAILED")
                    .message(message)
                    .build();
        } catch (Exception e) {
            log.error("Portal SSO registration failed: {}", e.getMessage());
            return PortalAuthResponse.builder()
                    .authenticated(false)
                    .error("REGISTRATION_FAILED")
                    .message(e.getMessage() != null ? e.getMessage() : "Portal SSO registration failed")
                    .build();
        }
    }

    /**
     * Server-side OAuth 2.1 authorization code exchange (confidential client, PKCE S256).
     * Authenticates with client_secret_basic, verifies the ID token signature against the
     * issuer's JWKS (RS256), and returns only what the SPA needs. The refresh token stays server-side.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> exchangeToken(String code, String codeVerifier, String redirectUri) {
        if (properties.getClientSecret() == null || properties.getClientSecret().isBlank()) {
            throw new IllegalStateException("PORTAL_CLIENT_SECRET is not configured");
        }
        String base = properties.getNormalizedBaseUrl();
        String tokenUrl = base + "/oauth2/token";
        log.info("Exchanging OAuth code with Portal SSO at {} (redirect_uri: {})", tokenUrl, redirectUri);

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("code", code);
        form.add("redirect_uri", redirectUri);
        form.add("code_verifier", codeVerifier);

        Map<String, Object> tokenResponse;
        try {
            tokenResponse = restClient.post()
                    .uri(tokenUrl)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .headers(h -> h.setBasicAuth(
                            URLEncoder.encode(properties.getClientId(), StandardCharsets.UTF_8),
                            URLEncoder.encode(properties.getClientSecret(), StandardCharsets.UTF_8)))
                    .body(form)
                    .retrieve()
                    .body(Map.class);
        } catch (org.springframework.web.client.RestClientResponseException rcEx) {
            String errorBody = rcEx.getResponseBodyAsString();
            log.error("Portal SSO OAuth token exchange error ({}): {}", rcEx.getStatusCode(), errorBody);
            String msg = extractErrorMessage(errorBody, "HTTP " + rcEx.getStatusCode());
            throw new RuntimeException("Token exchange failed with Portal SSO: " + msg);
        } catch (Exception e) {
            log.error("Portal SSO OAuth token exchange error: {}", e.getMessage());
            throw new RuntimeException("Token exchange failed with Portal SSO: " + e.getMessage());
        }

        if (tokenResponse == null || !(tokenResponse.get("id_token") instanceof String idToken)) {
            throw new RuntimeException("Token exchange failed with Portal SSO: no id_token returned");
        }

        Jwt verified;
        try {
            verified = idTokenDecoder().decode(idToken);
        } catch (JwtException e) {
            log.error("Portal SSO ID token verification failed: {}", e.getMessage());
            throw new RuntimeException("ID token verification failed: " + e.getMessage());
        }

        Map<String, Object> claims = new HashMap<>(verified.getClaims());
        String accessToken = (String) tokenResponse.get("access_token");
        if (accessToken != null) {
            try {
                Map<String, Object> userinfo = restClient.get()
                        .uri(base + "/userinfo")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .retrieve()
                        .body(Map.class);
                // userinfo must describe the same subject as the verified ID token
                if (userinfo != null && verified.getSubject().equals(userinfo.get("sub"))) {
                    userinfo.forEach(claims::putIfAbsent);
                }
            } catch (Exception e) {
                log.warn("Could not retrieve userinfo from Portal SSO: {}", e.getMessage());
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("id_token", idToken);
        result.put("access_token", accessToken);
        result.put("expires_in", tokenResponse.get("expires_in"));
        result.put("claims", claims);
        return result;
    }

    private synchronized JwtDecoder idTokenDecoder() {
        if (idTokenDecoder == null) {
            String issuer = properties.getNormalizedBaseUrl();
            NimbusJwtDecoder decoder = NimbusJwtDecoder.withIssuerLocation(issuer)
                    .jwsAlgorithm(SignatureAlgorithm.RS256)
                    .build();
            OAuth2TokenValidator<Jwt> audience = new JwtClaimValidator<List<String>>(
                    JwtClaimNames.AUD, aud -> aud != null && aud.contains(properties.getClientId()));
            decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                    JwtValidators.createDefaultWithIssuer(issuer), audience));
            idTokenDecoder = decoder;
        }
        return idTokenDecoder;
    }

    private String extractErrorMessage(String jsonBody, String defaultMessage) {
        if (jsonBody == null || jsonBody.isBlank()) {
            return defaultMessage;
        }
        try {
            var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            var node = mapper.readTree(jsonBody);
            if (node.has("message") && !node.get("message").asText().isBlank()) {
                return node.get("message").asText();
            }
            if (node.has("error_description") && !node.get("error_description").asText().isBlank()) {
                return node.get("error_description").asText();
            }
            if (node.has("error") && !node.get("error").asText().isBlank()) {
                return node.get("error").asText();
            }
        } catch (Exception ignored) {
        }
        return defaultMessage;
    }

    /**
     * Checks if Portal SSO OIDC Discovery is reachable and healthy server-to-server.
     */
    public Map<String, Object> checkHealth() {
        String base = properties.getNormalizedBaseUrl();
        String url = base + "/.well-known/openid-configuration";
        Map<String, Object> result = new HashMap<>();
        try {
            var response = restClient.get()
                    .uri(url)
                    .retrieve()
                    .toBodilessEntity();
            result.put("ok", response.getStatusCode().is2xxSuccessful());
            result.put("message", "Portal SSO OIDC Provider reachable and ready.");
        } catch (Exception e) {
            log.warn("Health check to Portal SSO failed: {}", e.getMessage());
            result.put("ok", false);
            result.put("message", e.getMessage() != null ? e.getMessage() : "Could not connect to Portal SSO server");
        }
        return result;
    }

    /**
     * Idempotent Auto-Login Pattern for AI Agents & Services:
     * Attempts login; if account does not exist or fails with 400, registers automatically and logs in.
     */
    public PortalAuthResponse ensureAuthenticatedAgent(String email, String password, String name) {
        log.info("Ensuring authenticated agent session for {}", email);
        PortalAuthResponse auth = login(email, password);
        if (auth != null && auth.isAuthenticated()) {
            return auth;
        }

        log.info("Agent account not yet authenticated. Attempting registration for {}", email);
        PortalAuthResponse reg = register(email, password, name, "Agent");
        if (reg != null && reg.isAuthenticated()) {
            return reg;
        }

        return auth;
    }
}
