package com.tanmaysinghx.eggless_server.auth;

import java.time.Instant;
import java.util.List;

/** The signed-in user as the browser sees it (GET /api/auth/me). */
public record SessionUser(
        String id,
        String email,
        String name,
        List<String> roles,
        String provider,
        Instant expiresAt
) {
}
