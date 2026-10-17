package com.tanmaysinghx.eggless_server.service;

import com.tanmaysinghx.eggless_server.config.PortalSsoProperties;
import com.tanmaysinghx.eggless_server.dto.PortalAuthRequest;
import com.tanmaysinghx.eggless_server.dto.PortalAuthResponse;
import com.tanmaysinghx.eggless_server.dto.PortalRegisterRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
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

    public PortalSsoClient(PortalSsoProperties properties) {
        this.properties = properties;
        String base = properties.getBaseUrl() != null ? properties.getBaseUrl().replaceAll("/+$", "") : "https://portal.tanmaysinghx.com";
        this.restClient = RestClient.builder()
                .baseUrl(base)
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
     * Server-side OAuth 2.1 authorization code exchange with Portal SSO.
     * Keeps token exchange reliable and avoids browser CORS restrictions.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> exchangeToken(String code, String codeVerifier, String redirectUri) {
        String base = properties.getBaseUrl() != null ? properties.getBaseUrl().replaceAll("/+$", "") : "https://portal.tanmaysinghx.com";
        String tokenUrl = base + "/oauth2/token";
        String uriToUse = (redirectUri != null && !redirectUri.isBlank()) ? redirectUri : properties.getRedirectUri();
        log.info("Exchanging OAuth code with Portal SSO at {} (redirect_uri: {})", tokenUrl, uriToUse);

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", properties.getClientId());
        form.add("code", code);
        form.add("redirect_uri", uriToUse);
        form.add("code_verifier", codeVerifier);

        if (properties.getClientSecret() != null && !properties.getClientSecret().isBlank()) {
            form.add("client_secret", properties.getClientSecret());
        }

        try {
            var requestSpec = restClient.post()
                    .uri(tokenUrl)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form);

            if (properties.getClientSecret() != null && !properties.getClientSecret().isBlank()) {
                String credentials = properties.getClientId() + ":" + properties.getClientSecret();
                String basicAuth = java.util.Base64.getEncoder().encodeToString(credentials.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                requestSpec.header(HttpHeaders.AUTHORIZATION, "Basic " + basicAuth);
            }

            Map<String, Object> tokenResponse = requestSpec.retrieve().body(Map.class);

            if (tokenResponse != null && tokenResponse.containsKey("access_token")) {
                String accessToken = (String) tokenResponse.get("access_token");
                try {
                    Map<String, Object> userinfo = restClient.get()
                            .uri(base + "/userinfo")
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                            .retrieve()
                            .body(Map.class);
                    if (userinfo != null) {
                        tokenResponse.put("userinfo", userinfo);
                    }
                } catch (Exception e) {
                    log.warn("Could not retrieve userinfo from Portal SSO: {}", e.getMessage());
                }
            }
            return tokenResponse;
        } catch (org.springframework.web.client.RestClientResponseException rcEx) {
            String errorBody = rcEx.getResponseBodyAsString();
            log.error("Portal SSO OAuth token exchange error ({}): {}", rcEx.getStatusCode(), errorBody);
            String msg = extractErrorMessage(errorBody, "HTTP " + rcEx.getStatusCode());
            throw new RuntimeException("Token exchange failed with Portal SSO: " + msg);
        } catch (Exception e) {
            log.error("Portal SSO OAuth token exchange error: {}", e.getMessage());
            throw new RuntimeException("Token exchange failed with Portal SSO: " + e.getMessage());
        }
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
        String base = properties.getBaseUrl() != null ? properties.getBaseUrl().replaceAll("/+$", "") : "https://portal.tanmaysinghx.com";
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
