package com.tanmaysinghx.eggless_server.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Portal SSO settings, bound from environment variables in application.yaml.
 * Populated from environment variables, or at runtime by PortalConnectService from a stored
 * "Connect with Portal SSO" connection. Secrets (clientSecret, appKey) never have defaults.
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "portal.sso")
public class PortalSsoProperties {
    /**
     * Issuer / base URL of the Portal SSO instance (PORTAL_URL).
     */
    private String baseUrl = "";

    /**
     * Application ID registered in Portal SSO (used by the External Auth API paths).
     */
    private String applicationId = "";

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
    private String redirectUri = "";

    /**
     * Requested OAuth scopes (PORTAL_SCOPES).
     */
    private String scopes = "openid profile email";

    /**
     * External Auth API login endpoint (PORTAL_LOGIN_ENDPOINT). Defaults to the URL derived from applicationId.
     */
    private String loginEndpoint = "";

    /**
     * External Auth API register endpoint (PORTAL_REGISTER_ENDPOINT). Defaults to the URL derived from applicationId.
     */
    private String registerEndpoint = "";

    public String getLoginUrl() {
        return isSet(loginEndpoint) ? loginEndpoint
                : getNormalizedBaseUrl() + "/api/external/apps/" + applicationId + "/login";
    }

    public String getRegisterUrl() {
        return isSet(registerEndpoint) ? registerEndpoint
                : getNormalizedBaseUrl() + "/api/external/apps/" + applicationId + "/register";
    }

    private static boolean isSet(String value) {
        return value != null && !value.isBlank();
    }

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
