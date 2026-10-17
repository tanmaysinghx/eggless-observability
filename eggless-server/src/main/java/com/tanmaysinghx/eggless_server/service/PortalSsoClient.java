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
import org.springframework.web.client.RestClient;

import java.util.Map;

/**
 * Client service implementing the Portal SSO External Auth API.
 * Handles programmatic auto-login, machine/agent auth, and headless user registration.
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
                    .onStatus(HttpStatusCode::is4xxClientError, (request, response) -> {
                        log.warn("Portal SSO 4xx response: {}", response.getStatusCode());
                    })
                    .body(PortalAuthResponse.class);
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
