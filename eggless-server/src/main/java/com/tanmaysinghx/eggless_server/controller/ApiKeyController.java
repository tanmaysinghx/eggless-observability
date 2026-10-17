package com.tanmaysinghx.eggless_server.controller;

import com.tanmaysinghx.eggless_server.dto.ApiKeyDto;
import com.tanmaysinghx.eggless_server.dto.ApiResponse;
import com.tanmaysinghx.eggless_server.service.ApiKeyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/apikeys")
@CrossOrigin(origins = "*", allowedHeaders = "*")
@RequiredArgsConstructor
public class ApiKeyController {

    private final ApiKeyService apiKeyService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ApiKeyDto>>> getApiKeys() {
        List<ApiKeyDto> keys = apiKeyService.getAllKeys();
        return ResponseEntity.ok(ApiResponse.ok(keys));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ApiKeyDto>> createApiKey(@RequestBody Map<String, String> body) {
        String name = body != null ? body.get("name") : "New Key";
        ApiKeyDto created = apiKeyService.createKey(name);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(created));
    }

    @PostMapping("/revoke")
    public ResponseEntity<ApiResponse<Void>> revokeApiKey(@RequestParam String id) {
        apiKeyService.revokeKey(id);
        return ResponseEntity.ok(ApiResponse.ok(null, "Key revoked"));
    }
}
