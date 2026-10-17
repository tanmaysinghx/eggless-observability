package com.tanmaysinghx.eggless_server.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertRuleDto {
    private String id;
    private String name;
    private String application;
    private String query;
    private String condition;
    private String window;
    private String channel;
    private boolean enabled;
    private String lastTriggered;
    private String status;
}
