package com.tanmaysinghx.eggless_server.query;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * An alert threshold: {@code <metric> <op> <number>[%]}, with anything after the number ignored
 * (so "ERROR > 50 logs in 5 minutes" reads naturally).
 *
 * <p>Metrics: {@code count}/{@code logs} (all matching logs), {@code error_count}/{@code errors},
 * {@code warn_count}/{@code warns}, {@code error_rate} (percent of matching logs that are ERROR/FATAL),
 * or a level name such as {@code ERROR} or {@code WARN}.
 */
public record AlertCondition(String metric, String level, String op, double threshold) {

    private static final Pattern CONDITION = Pattern.compile(
            "^\\s*([A-Za-z_]+)\\s*(>=|<=|==|=|>|<)\\s*(\\d+(?:\\.\\d+)?)\\s*%?.*$");

    public static AlertCondition parse(String text) {
        Matcher m = CONDITION.matcher(text == null ? "" : text);
        if (!m.matches()) {
            throw new IllegalArgumentException(
                    "Condition must look like 'ERROR > 50', 'count >= 100' or 'error_rate > 5%' (got: " + text + ")");
        }
        String name = m.group(1).toLowerCase(Locale.ROOT);
        String op = m.group(2).equals("=") ? "==" : m.group(2);
        double threshold = Double.parseDouble(m.group(3));
        return switch (name) {
            case "count", "logs" -> new AlertCondition("count", null, op, threshold);
            case "error_count", "errors" -> new AlertCondition("errors", null, op, threshold);
            case "warn_count", "warns", "warnings" -> new AlertCondition("count", "WARN", op, threshold);
            case "error_rate" -> new AlertCondition("error_rate", null, op, threshold);
            case "info", "warn", "error", "debug", "trace", "fatal" ->
                    new AlertCondition("count", name.toUpperCase(Locale.ROOT), op, threshold);
            default -> throw new IllegalArgumentException("Unknown alert metric '" + m.group(1)
                    + "'. Use count, error_count, warn_count, error_rate or a level such as ERROR.");
        };
    }

    public boolean breached(double value) {
        return switch (op) {
            case ">" -> value > threshold;
            case ">=" -> value >= threshold;
            case "<" -> value < threshold;
            case "<=" -> value <= threshold;
            default -> value == threshold;
        };
    }
}
