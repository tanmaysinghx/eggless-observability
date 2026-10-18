package com.tanmaysinghx.eggless_server.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MetricsSummaryDto {
    private String timeRange;
    private String from;
    private String to;
    private long totalLogs;
    private long errorCount;
    private long warnCount;
    private double logsPerMin;
    /** Percentage of logs in the window that are ERROR or FATAL. */
    private double errorRate;
    private int activeServices;
    private Map<String, Long> byLevel;
    private List<Bucket> timeseries;
    private List<ServiceVolume> byService;
    private List<TopError> topErrors;

    @Data
    @AllArgsConstructor
    public static class Bucket {
        private String start;
        private long count;
        private long errors;
        private long warns;
    }

    @Data
    @AllArgsConstructor
    public static class ServiceVolume {
        private String service;
        private long count;
        private long errors;
        private double logsPerMin;
    }

    @Data
    @AllArgsConstructor
    public static class TopError {
        private String message;
        private String service;
        private long count;
        private String lastSeen;
    }
}
