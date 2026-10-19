package com.tanmaysinghx.eggless_server.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.util.Optional;
import java.util.Set;

/**
 * Requires a console session for the management API ({@code /api/v1/**}). Log ingestion is exempt:
 * it authenticates with an API key in {@code LogController}.
 */
@Component
@RequiredArgsConstructor
public class SessionInterceptor implements HandlerInterceptor {

    static final Set<String> INGEST_PATHS = Set.of("/api/v1/logs", "/api/v1/logs/ingest", "/api/v1/logs/batch");

    private final SessionService sessionService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        if (isExempt(request)) return true;
        Optional<SessionUser> user = sessionService.current(request);
        if (user.isPresent()) {
            request.setAttribute(SessionService.USER_ATTRIBUTE, user.get());
            return true;
        }
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("{\"success\":false,\"error\":\"Sign in to Eggless to use this endpoint\"}");
        return false;
    }

    static boolean isExempt(HttpServletRequest request) {
        String method = request.getMethod();
        if (HttpMethod.OPTIONS.matches(method)) return true;
        String path = request.getRequestURI().substring(request.getContextPath().length());
        if (path.endsWith("/") && path.length() > 1) path = path.substring(0, path.length() - 1);
        return HttpMethod.POST.matches(method) && INGEST_PATHS.contains(path);
    }
}
