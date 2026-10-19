package com.tanmaysinghx.eggless_server.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

/**
 * Server-side sessions for the web console. A successful Portal SSO sign-in issues an HttpOnly,
 * SameSite=Lax cookie; the management API and the live-tail socket require it.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SessionService {

    public static final String COOKIE = "EGGLESS_SESSION";
    /** Request attribute holding the {@link SessionUser} once {@link SessionInterceptor} accepted the request. */
    public static final String USER_ATTRIBUTE = SessionService.class.getName() + ".user";

    private static final SecureRandom RANDOM = new SecureRandom();

    private final SessionRepository sessionRepository;

    @Value("${eggless.auth.session-hours:12}")
    private long sessionHours;

    /** Creates a session for the user and sets its cookie on the response. */
    @Transactional
    public SessionUser signIn(String userId, String email, String name, List<String> roles, String provider,
                              HttpServletRequest request, HttpServletResponse response) {
        if (userId == null || userId.isBlank()) throw new IllegalArgumentException("Signed-in user has no id");
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant now = Instant.now();
        Duration ttl = Duration.ofHours(Math.max(1, sessionHours));

        SessionEntity session = sessionRepository.save(SessionEntity.builder()
                .tokenHash(hash(token))
                .userId(userId)
                .email(email)
                .name(name != null && !name.isBlank() ? name : email)
                .roles(roles == null ? "" : String.join(",", roles))
                .provider(provider)
                .createdAt(now)
                .expiresAt(now.plus(ttl))
                .build());

        response.addHeader(HttpHeaders.SET_COOKIE, cookie(token, ttl, request).toString());
        return toUser(session);
    }

    /** The user whose valid session cookie came with the request, if any. */
    @Transactional(readOnly = true)
    public Optional<SessionUser> current(HttpServletRequest request) {
        return token(request).flatMap(this::find);
    }

    @Transactional(readOnly = true)
    public Optional<SessionUser> find(String token) {
        if (token == null || token.isBlank()) return Optional.empty();
        return sessionRepository.findById(hash(token))
                .filter(s -> s.getExpiresAt().isAfter(Instant.now()))
                .map(this::toUser);
    }

    /** Ends the request's session, if any, and clears the cookie. */
    @Transactional
    public void signOut(HttpServletRequest request, HttpServletResponse response) {
        token(request).ifPresent(t -> sessionRepository.deleteById(hash(t)));
        response.addHeader(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO, request).toString());
    }

    @Scheduled(initialDelay = 120_000, fixedDelay = 3_600_000)
    @Transactional
    public void purgeExpired() {
        int deleted = sessionRepository.deleteExpired(Instant.now());
        if (deleted > 0) log.debug("Removed {} expired sessions", deleted);
    }

    public static Optional<String> token(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return Optional.empty();
        return Arrays.stream(cookies)
                .filter(c -> COOKIE.equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank())
                .map(Cookie::getValue)
                .findFirst();
    }

    private static ResponseCookie cookie(String value, Duration maxAge, HttpServletRequest request) {
        return ResponseCookie.from(COOKIE, value)
                .httpOnly(true)
                .secure(request.isSecure())
                .sameSite("Lax")
                .path("/")
                .maxAge(maxAge)
                .build();
    }

    private SessionUser toUser(SessionEntity s) {
        List<String> roles = s.getRoles() == null || s.getRoles().isBlank() ? List.of() : List.of(s.getRoles().split(","));
        return new SessionUser(s.getUserId(), s.getEmail(), s.getName(), roles, s.getProvider(), s.getExpiresAt());
    }

    private static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
