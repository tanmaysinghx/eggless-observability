package com.tanmaysinghx.eggless_server.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiKeyDto {
    private String id;
    private String name;
    private String tokenPrefix;
    private String token; // Only returned on creation
    private String created;
    private String lastUsed;
    private String status;
}
