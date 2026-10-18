package com.tanmaysinghx.eggless_server.dto;

import lombok.Data;

@Data
public class CreateApplicationRequest {
    private String name;
    private String environment;
    private String description;
}
