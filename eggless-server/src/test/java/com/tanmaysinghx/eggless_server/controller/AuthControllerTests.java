package com.tanmaysinghx.eggless_server.controller;

import com.tanmaysinghx.eggless_server.auth.SessionService;
import com.tanmaysinghx.eggless_server.config.PortalSsoProperties;
import com.tanmaysinghx.eggless_server.service.PortalSsoClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.List;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Guards the Portal SSO hard rules: exact redirect URIs only, and no secret ever reaches the browser.
 */
class AuthControllerTests {

    private static final String REGISTERED = "https://eggless.tanmaysinghx.com/auth/callback";
    private static final String POPUP = "https://portal.tanmaysinghx.com/oauth2/popup-callback";

    private PortalSsoProperties properties;
    private PortalSsoClient client;
    private SessionService sessions;
    private AuthController controller;

    @BeforeEach
    void setUp() {
        properties = new PortalSsoProperties();
        properties.setBaseUrl("https://portal.tanmaysinghx.com/");
        properties.setRedirectUri(REGISTERED);
        properties.setClientSecret("test-client-secret");
        properties.setAppKey("psso_app_test-key");
        client = mock(PortalSsoClient.class);
        sessions = mock(SessionService.class);
        controller = new AuthController(properties, client, sessions);
    }

    @Test
    void configReturnsRegisteredRedirectUriAndNoSecrets() {
        Map<String, Object> config = controller.getConfig().getBody();

        assertThat(config).containsEntry("redirectUri", REGISTERED)
                .containsEntry("baseUrl", "https://portal.tanmaysinghx.com")
                .containsEntry("scopes", "openid profile email")
                .containsEntry("hasAppKey", true);
        assertThat(config.values().toString())
                .doesNotContain("test-client-secret")
                .doesNotContain("psso_app_test-key");
    }

    @Test
    void exchangeRejectsUnregisteredRedirectUri() {
        ResponseEntity<?> response = controller.exchangeCode(Map.of(
                "code", "c", "codeVerifier", "v", "redirectUri", "http://localhost:4200/auth/callback"), new MockHttpServletRequest(), new MockHttpServletResponse());

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        verify(client, never()).exchangeToken(any(), any(), any());
    }

    @Test
    void exchangeAcceptsPopupCallback() {
        when(client.exchangeToken("c", "v", POPUP)).thenReturn(Map.of("id_token", "t"));

        ResponseEntity<?> response = controller.exchangeCode(Map.of("code", "c", "codeVerifier", "v", "redirectUri", POPUP),
                new MockHttpServletRequest(), new MockHttpServletResponse());

        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void exchangeDefaultsToRegisteredRedirectUri() {
        when(client.exchangeToken(eq("c"), eq("v"), eq(REGISTERED))).thenReturn(Map.of("id_token", "t"));

        ResponseEntity<?> response = controller.exchangeCode(Map.of("code", "c", "codeVerifier", "v"),
                new MockHttpServletRequest(), new MockHttpServletResponse());

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(client).exchangeToken("c", "v", REGISTERED);
    }

    @Test
    void successfulExchangeStartsASessionForTheVerifiedUser() {
        when(client.exchangeToken("c", "v", REGISTERED)).thenReturn(Map.of("id_token", "t", "claims",
                Map.of("sub", "usr_1", "email", "ada@example.com", "given_name", "Ada", "family_name", "Lovelace",
                        "roles", List.of("ROLE_ADMIN"))));

        controller.exchangeCode(Map.of("code", "c", "codeVerifier", "v"), new MockHttpServletRequest(), new MockHttpServletResponse());

        verify(sessions).signIn(eq("usr_1"), eq("ada@example.com"), eq("Ada Lovelace"), eq(List.of("ROLE_ADMIN")),
                anyString(), any(), any());
    }

    @Test
    void localLoginIsRefusedUnlessEnabled() {
        ResponseEntity<?> response = controller.localLogin(new MockHttpServletRequest(), new MockHttpServletResponse());

        assertThat(response.getStatusCode().value()).isEqualTo(403);
        verify(sessions, never()).signIn(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void exchangeRequiresCodeAndVerifier() {
        ResponseEntity<?> response = controller.exchangeCode(Map.of("code", "c"), new MockHttpServletRequest(), new MockHttpServletResponse());

        assertThat(response.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void externalApiUrlsDeriveFromApplicationIdUnlessOverridden() {
        properties.setApplicationId("app-123");
        assertThat(properties.getLoginUrl()).isEqualTo("https://portal.tanmaysinghx.com/api/external/apps/app-123/login");

        properties.setRegisterEndpoint("https://example.test/register");
        assertThat(properties.getRegisterUrl()).isEqualTo("https://example.test/register");
    }
}
