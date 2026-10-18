package com.tanmaysinghx.eggless_server.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/** Returned once when an application is registered: the app plus its ingestion key (raw token shown only now). */
@Data
@AllArgsConstructor
public class ApplicationRegistrationDto {
    private ApplicationDto application;
    private ApiKeyDto apiKey;
}
