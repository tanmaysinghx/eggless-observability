package com.tanmaysinghx.eggless_server.auth;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:sessions;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
        "eggless.home=${java.io.tmpdir}/eggless-test-${random.uuid}",
        "eggless.alerts.evaluation-interval-ms=3600000"
})
class SessionTests {

    @Autowired SessionService sessionService;
    @Autowired SessionInterceptor interceptor;

    /** Signs in and returns a request carrying the issued cookie. */
    private MockHttpServletRequest signedInRequest() {
        MockHttpServletResponse response = new MockHttpServletResponse();
        sessionService.signIn("usr_1", "ada@example.com", "Ada", List.of("ROLE_ADMIN"), "test",
                new MockHttpServletRequest(), response);
        String setCookie = response.getHeader(HttpHeaders.SET_COOKIE);
        assertThat(setCookie).contains("HttpOnly").contains("SameSite=Lax");
        String value = setCookie.substring(setCookie.indexOf('=') + 1, setCookie.indexOf(';'));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/alerts");
        request.setCookies(new Cookie(SessionService.COOKIE, value));
        return request;
    }

    @Test
    void issuedCookieIdentifiesTheUserUntilSignOut() {
        MockHttpServletRequest request = signedInRequest();

        assertThat(sessionService.current(request)).hasValueSatisfying(u -> {
            assertThat(u.email()).isEqualTo("ada@example.com");
            assertThat(u.roles()).containsExactly("ROLE_ADMIN");
        });

        sessionService.signOut(request, new MockHttpServletResponse());
        assertThat(sessionService.current(request)).isEmpty();
    }

    @Test
    void managementApiRequiresASession() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        boolean allowed = interceptor.preHandle(new MockHttpServletRequest("GET", "/api/v1/alerts"), response, new Object());

        assertThat(allowed).isFalse();
        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(interceptor.preHandle(signedInRequest(), new MockHttpServletResponse(), new Object())).isTrue();
    }

    @Test
    void unknownCookieIsRejected() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/logs");
        request.setCookies(new Cookie(SessionService.COOKIE, "forged"));

        assertThat(interceptor.preHandle(request, new MockHttpServletResponse(), new Object())).isFalse();
    }

    @Test
    void onlyLogIngestionIsExempt() {
        assertThat(SessionInterceptor.isExempt(new MockHttpServletRequest("POST", "/api/v1/logs"))).isTrue();
        assertThat(SessionInterceptor.isExempt(new MockHttpServletRequest("POST", "/api/v1/logs/batch"))).isTrue();
        assertThat(SessionInterceptor.isExempt(new MockHttpServletRequest("POST", "/api/v1/logs/ingest/"))).isTrue();
        assertThat(SessionInterceptor.isExempt(new MockHttpServletRequest("GET", "/api/v1/logs"))).isFalse();
        assertThat(SessionInterceptor.isExempt(new MockHttpServletRequest("POST", "/api/v1/apikeys"))).isFalse();
    }
}
