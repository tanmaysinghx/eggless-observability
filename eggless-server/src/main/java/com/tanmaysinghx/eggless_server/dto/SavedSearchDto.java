package com.tanmaysinghx.eggless_server.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SavedSearchDto {
    private String id;
    private String name;
    private String query;
    private List<String> levels;
    private String timeRange;
    private String application;
    private String environment;
    private String createdBy;
    private Instant createdAt;
}
