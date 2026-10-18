package com.tanmaysinghx.eggless_server.controller;

import com.tanmaysinghx.eggless_server.dto.ApiKeyDto;
import com.tanmaysinghx.eggless_server.dto.ApiResponse;
import com.tanmaysinghx.eggless_server.dto.ApplicationDto;
import com.tanmaysinghx.eggless_server.dto.ApplicationRegistrationDto;
import com.tanmaysinghx.eggless_server.dto.CreateApplicationRequest;
import com.tanmaysinghx.eggless_server.service.ApiKeyService;
import com.tanmaysinghx.eggless_server.service.ApplicationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/applications")
@CrossOrigin(origins = "*", allowedHeaders = "*")
@RequiredArgsConstructor
public class ApplicationController {

    private final ApplicationService applicationService;
    private final ApiKeyService apiKeyService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ApplicationDto>>> getApplications() {
        List<ApplicationDto> apps = applicationService.getAllApplications();
        return ResponseEntity.ok(ApiResponse.ok(apps));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ApplicationDto>> getApplication(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.ok(applicationService.getApplication(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ApplicationRegistrationDto>> register(@RequestBody CreateApplicationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(applicationService.register(request), "Application registered"));
    }

    @GetMapping("/{id}/keys")
    public ResponseEntity<ApiResponse<List<ApiKeyDto>>> keys(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.ok(apiKeyService.keysFor(applicationService.getApplication(id).getName())));
    }

    /** Issues an additional ingestion key for the application, e.g. to rotate the old one. */
    @PostMapping("/{id}/keys")
    public ResponseEntity<ApiResponse<ApiKeyDto>> createKey(@PathVariable String id) {
        String name = applicationService.getApplication(id).getName();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(apiKeyService.createKey(name + " ingestion key", name)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String id) {
        applicationService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok(null, "Application deleted; its ingestion keys were revoked"));
    }
}
