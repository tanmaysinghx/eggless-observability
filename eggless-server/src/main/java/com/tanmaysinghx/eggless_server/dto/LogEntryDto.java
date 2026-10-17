package com.tanmaysinghx.eggless_server.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LogEntryDto {
    private String id;
    private String timestamp;
    private String fullTimestamp;
    private String level;
    private String service;
    private String environment;
    private String message;
    private String traceId;
    private String requestId;
    private String userId;
    private String host;
    private Map<String, Object> metadata;
    private String stackTrace;
}
