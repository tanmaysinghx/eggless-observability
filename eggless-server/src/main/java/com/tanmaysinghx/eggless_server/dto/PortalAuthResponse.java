package com.tanmaysinghx.eggless_server.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PortalAuthResponse {
    private boolean authenticated;
    private boolean mfaRequired;
    private PortalUserDto user;
    private String error;
    private String message;
}
