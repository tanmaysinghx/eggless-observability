package io.eggless.sdk.spring.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

public class EgglessTraceFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        long startTime = System.currentTimeMillis();

        String traceId = request.getHeader("X-Trace-Id");
        if (traceId == null || traceId.isBlank()) {
            traceId = request.getHeader("X-Request-Id");
        }
        if (traceId == null || traceId.isBlank()) {
            traceId = "tr-" + UUID.randomUUID().toString().substring(0, 13);
        }

        String userId = request.getHeader("X-User-Id");

        MDC.put("traceId", traceId);
        MDC.put("requestId", traceId);
        MDC.put("httpMethod", request.getMethod());
        MDC.put("httpUri", request.getRequestURI());
        if (userId != null) {
            MDC.put("userId", userId);
        }

        response.setHeader("X-Trace-Id", traceId);

        try {
            filterChain.doFilter(request, response);
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            MDC.put("httpStatus", String.valueOf(response.getStatus()));
            MDC.put("durationMs", String.valueOf(duration));
            MDC.clear();
        }
    }
}
