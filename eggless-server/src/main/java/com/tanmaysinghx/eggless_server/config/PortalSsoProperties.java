package com.tanmaysinghx.eggless_server.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Portal SSO settings, bound from environment variables in application.yaml.
 * Secrets (clientSecret, appKey) have no defaults and must come from the environment / secret store.
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "portal.sso")
public class PortalSsoProperties {
    /**
     * Issuer / base URL of the Portal SSO instance (PORTAL_URL).
     */
    private String baseUrl = "https://portal.tanmaysinghx.com";

    /**
     * Application ID registered in Portal SSO (used by the External Auth API paths).
     */
    private String applicationId = "5de93ba7-0673-4fba-8e9b-a1bdb8466f03";

    /**
     * External Auth API key sent as X-Portal-App-Key (PORTAL_API_KEY). Backend only.
     */
    private String appKey = "";

    /**
     * OAuth 2.1 Client ID (PORTAL_CLIENT_ID).
     */
    private String clientId = "eggless-observability";

    /**
     * OAuth 2.1 Client Secret for the confidential client (PORTAL_CLIENT_SECRET). Backend only.
     */
    private String clientSecret = "";

    /**
     * Registered redirect URI for full-page redirect logins (PORTAL_REDIRECT_URI). Must match Portal SSO exactly.
     */
    private String redirectUri = "https://eggless.tanmaysinghx.com/auth/callback";

    /**
     * Requested OAuth scopes (PORTAL_SCOPES).
     */
    private String scopes = "openid profile email";

    public String getNormalizedBaseUrl() {
        return baseUrl != null ? baseUrl.replaceAll("/+$", "") : "";
    }

    /**
     * Portal-hosted popup callback, pre-registered for every client and used by the SDK's loginWithPopup().
     */
    public String getPopupRedirectUri() {
        return getNormalizedBaseUrl() + "/oauth2/popup-callback";
    }
}
