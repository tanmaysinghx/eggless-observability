package com.tanmaysinghx.eggless_server.service;

import com.tanmaysinghx.eggless_server.dto.MetricsSummaryDto;
import com.tanmaysinghx.eggless_server.dto.MetricsSummaryDto.Bucket;
import com.tanmaysinghx.eggless_server.dto.MetricsSummaryDto.ServiceVolume;
import com.tanmaysinghx.eggless_server.dto.MetricsSummaryDto.TopError;
import com.tanmaysinghx.eggless_server.query.LogQuery;
import com.tanmaysinghx.eggless_server.repository.LogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Aggregates for dashboards and the overview. All figures are computed from stored logs; the
 * time series uses one grouped count per bucket, which stays portable across H2, PostgreSQL and MySQL.
 */
@Service
@RequiredArgsConstructor
public class MetricsService {

    public static final int BUCKETS = 30;
    private static final Duration DEFAULT_RANGE = Duration.ofHours(1);
    private static final Duration MIN_RANGE = Duration.ofMinutes(1);
    private static final Duration MAX_RANGE = Duration.ofDays(30);
    private static final int TOP_ERRORS = 5;

    private final LogRepository logRepository;

    public static boolean isError(String level) {
        return "ERROR".equalsIgnoreCase(level) || "FATAL".equalsIgnoreCase(level);
    }

    @Transactional(readOnly = true)
    public MetricsSummaryDto summary(String timeRange, String service, String environment) {
        Duration range = Optional.ofNullable(LogQuery.parseWindow(timeRange)).orElse(DEFAULT_RANGE);
        if (range.compareTo(MAX_RANGE) > 0) range = MAX_RANGE;
        if (range.compareTo(MIN_RANGE) < 0) range = MIN_RANGE;
        String svc = blankToNull(service);
        String env = blankToNull(environment);
        Instant to = Instant.now();
        Instant from = to.minus(range);

        Map<String, Long> byLevel = new LinkedHashMap<>();
        for (String level : List.of("INFO", "WARN", "ERROR", "DEBUG", "TRACE", "FATAL")) byLevel.put(level, 0L);
        Map<String, long[]> perService = new TreeMap<>();
        long total = 0;
        for (Object[] row : logRepository.countByServiceAndLevel(from, to, svc, env)) {
            String level = (String) row[1];
            long n = ((Number) row[2]).longValue();
            total += n;
            byLevel.merge(level, n, Long::sum);
            long[] c = perService.computeIfAbsent((String) row[0], k -> new long[2]);
            c[0] += n;
            if (isError(level)) c[1] += n;
        }
        long errors = byLevel.get("ERROR") + byLevel.get("FATAL");
        double minutes = range.toSeconds() / 60.0;

        List<ServiceVolume> byService = perService.entrySet().stream()
                .map(e -> new ServiceVolume(e.getKey(), e.getValue()[0], e.getValue()[1], round1(e.getValue()[0] / minutes)))
                .sorted(Comparator.comparingLong(ServiceVolume::getCount).reversed())
                .toList();

        List<TopError> topErrors = logRepository.topErrors(from, to, svc, env, PageRequest.of(0, TOP_ERRORS)).stream()
                .map(r -> new TopError((String) r[0], (String) r[1], ((Number) r[2]).longValue(), String.valueOf(r[3])))
                .toList();

        return MetricsSummaryDto.builder()
                .timeRange(timeRange != null ? timeRange : "1h")
                .from(from.toString())
                .to(to.toString())
                .totalLogs(total)
                .errorCount(errors)
                .warnCount(byLevel.get("WARN"))
                .logsPerMin(round1(total / minutes))
                .errorRate(total == 0 ? 0 : round1(100.0 * errors / total))
                .activeServices(perService.size())
                .byLevel(byLevel)
                .timeseries(timeseries(from, range, svc, env))
                .byService(byService)
                .topErrors(topErrors)
                .build();
    }

    private List<Bucket> timeseries(Instant from, Duration range, String svc, String env) {
        Duration step = range.dividedBy(BUCKETS);
        List<Bucket> buckets = new ArrayList<>(BUCKETS);
        for (int i = 0; i < BUCKETS; i++) {
            Instant start = from.plus(step.multipliedBy(i));
            long count = 0, errors = 0, warns = 0;
            for (Object[] row : logRepository.countByLevelBetween(start, start.plus(step), svc, env)) {
                String level = (String) row[0];
                long n = ((Number) row[1]).longValue();
                count += n;
                if (isError(level)) errors += n;
                if ("WARN".equalsIgnoreCase(level)) warns += n;
            }
            buckets.add(new Bucket(start.toString(), count, errors, warns));
        }
        return buckets;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() || s.equalsIgnoreCase("all") ? null : s;
    }

    private static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }
}
