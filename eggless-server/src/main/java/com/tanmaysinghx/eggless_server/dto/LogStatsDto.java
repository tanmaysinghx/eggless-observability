package com.tanmaysinghx.eggless_server.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LogStatsDto {
    private long totalLogs;
    private long errorCount;
    private long warnCount;
    private long activeApplications;
    private long logsPerMin;
}
