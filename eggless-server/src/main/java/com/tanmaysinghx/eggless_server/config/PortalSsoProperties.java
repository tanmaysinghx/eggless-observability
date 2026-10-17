package com.tanmaysinghx.eggless_server.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "portal.sso")
public class PortalSsoProperties {
    /**
     * Base URL of the Portal SSO instance (e.g. https://portal.tanmaysinghx.com).
     */
    private String baseUrl = "https://portal.tanmaysinghx.com";

    /**
     * Application ID registered in Portal SSO Admin Console.
     */
    private String applicationId = "5de93ba7-0673-4fba-8e9b-a1bdb8466f03";

    /**
     * Application Secret API Key (X-Portal-App-Key) generated in Portal SSO.
     */
    private String appKey = "";

    /**
     * OAuth 2.1 Client ID for interactive browser logins.
     */
    private String clientId = "eggless-observability";

    /**
     * Optional OAuth 2.1 Client Secret if the client was registered as Confidential.
     */
    private String clientSecret = "QjW5D-roZKxXXd9aNsdNrLT2TRkcj4JYy6BGS2ZvLl0";

    /**
     * Allowed redirect URI for OIDC PKCE callbacks.
     */
    private String redirectUri = "http://localhost:4200/auth/callback";
}
