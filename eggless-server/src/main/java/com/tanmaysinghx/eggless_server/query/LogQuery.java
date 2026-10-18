package com.tanmaysinghx.eggless_server.query;

import com.tanmaysinghx.eggless_server.entity.LogEntryEntity;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parsed log filter shared by the logs explorer, metrics and alert rules.
 *
 * <p>Search syntax: terms joined by {@code AND} (or whitespace between {@code key:value} terms).
 * Keys: {@code level}, {@code service}, {@code env}/{@code environment}, {@code host},
 * {@code trace}/{@code traceId}, {@code request}/{@code requestId}, {@code user}/{@code userId},
 * {@code message}/{@code msg}. Values may be quoted with ' or ". Anything else is free text matched
 * against message, trace, request, user and service.
 */
public record LogQuery(
        List<String> levels,
        String service,
        String environment,
        String host,
        String traceId,
        String requestId,
        String userId,
        List<String> messageContains,
        List<String> freeText,
        Instant since,
        Instant until
) {

    private static final Pattern TERM = Pattern.compile(
            "(\\w+):(?:'([^']*)'|\"([^\"]*)\"|(\\S+))|'([^']*)'|\"([^\"]*)\"|(\\S+)");
    private static final char ESCAPE = '\\';
    private static final Pattern DURATION = Pattern.compile("(\\d+)\\s*([smhd])");

    public static Builder builder() {
        return new Builder();
    }

    /** Parses a window such as {@code 15m}, {@code 1h}, {@code 7d}. Returns null for blank/unknown input. */
    public static Duration parseWindow(String window) {
        if (window == null || window.isBlank()) return null;
        Matcher m = DURATION.matcher(window.trim().toLowerCase(Locale.ROOT));
        if (!m.matches()) return null;
        long n = Long.parseLong(m.group(1));
        return switch (m.group(2)) {
            case "s" -> Duration.ofSeconds(n);
            case "m" -> Duration.ofMinutes(n);
            case "h" -> Duration.ofHours(n);
            default -> Duration.ofDays(n);
        };
    }

    public Specification<LogEntryEntity> toSpecification() {
        return (root, cq, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (levels != null && !levels.isEmpty()) p.add(root.get("level").in(levels));
            if (service != null) p.add(cb.equal(root.get("service"), service));
            if (environment != null) p.add(cb.equal(root.get("environment"), environment));
            if (host != null) p.add(cb.equal(root.get("host"), host));
            if (traceId != null) p.add(cb.equal(root.get("traceId"), traceId));
            if (requestId != null) p.add(cb.equal(root.get("requestId"), requestId));
            if (userId != null) p.add(cb.like(cb.lower(root.get("userId")), like(userId), ESCAPE));
            if (since != null) p.add(cb.greaterThanOrEqualTo(root.get("fullTimestamp"), since));
            if (until != null) p.add(cb.lessThan(root.get("fullTimestamp"), until));
            for (String m : messageContains) {
                p.add(cb.like(cb.lower(root.get("message")), like(m), ESCAPE));
            }
            for (String t : freeText) {
                String v = like(t);
                p.add(cb.or(
                        cb.like(cb.lower(root.get("message")), v, ESCAPE),
                        cb.like(cb.lower(root.get("traceId")), v, ESCAPE),
                        cb.like(cb.lower(root.get("requestId")), v, ESCAPE),
                        cb.like(cb.lower(root.get("userId")), v, ESCAPE),
                        cb.like(cb.lower(root.get("service")), v, ESCAPE)));
            }
            return cb.and(p.toArray(Predicate[]::new));
        };
    }

    private static String like(String value) {
        String escaped = value.toLowerCase(Locale.ROOT)
                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + escaped + "%";
    }

    public static final class Builder {
        private final List<String> levels = new ArrayList<>();
        private String service;
        private String environment;
        private String host;
        private String traceId;
        private String requestId;
        private String userId;
        private final List<String> messageContains = new ArrayList<>();
        private final List<String> freeText = new ArrayList<>();
        private Instant since;
        private Instant until;

        public Builder level(String level) {
            if (present(level)) levels.add(level.trim().toUpperCase(Locale.ROOT));
            return this;
        }

        public Builder service(String service) {
            if (present(service)) this.service = service.trim();
            return this;
        }

        public Builder environment(String environment) {
            if (present(environment)) this.environment = environment.trim();
            return this;
        }

        public Builder since(Instant since) {
            this.since = since;
            return this;
        }

        public Builder until(Instant until) {
            this.until = until;
            return this;
        }

        /** Adds the terms of a search string. */
        public Builder search(String search) {
            if (search == null || search.isBlank()) return this;
            Matcher m = TERM.matcher(search);
            while (m.find()) {
                String key = m.group(1);
                if (key != null) {
                    String value = first(m.group(2), m.group(3), m.group(4));
                    applyKey(key.toLowerCase(Locale.ROOT), value);
                    continue;
                }
                String word = first(m.group(5), m.group(6), m.group(7));
                if (word.equalsIgnoreCase("AND")) continue;
                if (!word.isEmpty()) freeText.add(word);
            }
            return this;
        }

        private void applyKey(String key, String value) {
            if (value.isEmpty()) return;
            switch (key) {
                case "level" -> level(value);
                case "service", "app", "application" -> service(value);
                case "env", "environment" -> environment(value);
                case "host" -> host = value;
                case "trace", "traceid" -> traceId = value;
                case "request", "requestid" -> requestId = value;
                case "user", "userid" -> userId = value;
                case "message", "msg" -> messageContains.add(value);
                // Not a known key (e.g. a URL "http://..."): keep it as free text.
                default -> freeText.add(key + ":" + value);
            }
        }

        public LogQuery build() {
            return new LogQuery(List.copyOf(levels), service, environment, host, traceId, requestId, userId,
                    List.copyOf(messageContains), List.copyOf(freeText), since, until);
        }

        private static boolean present(String s) {
            return s != null && !s.isBlank() && !s.equalsIgnoreCase("all");
        }

        private static String first(String... values) {
            for (String v : values) if (v != null) return v;
            return "";
        }
    }
}
