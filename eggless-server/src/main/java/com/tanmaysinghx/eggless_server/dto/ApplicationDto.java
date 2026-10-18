package com.tanmaysinghx.eggless_server.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApplicationDto {
    private String id;
    private String name;
    private String environment;
    private String lastLog;
    private int logsPerMin;
    private int errorsPerMin;
    private long errorCount;
    private String uptime;
    private String status;
    private String description;
    private String createdAt;
}
