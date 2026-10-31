package com.tanmaysinghx.eggless_server.controller;

import com.tanmaysinghx.eggless_server.auth.SessionService;
import com.tanmaysinghx.eggless_server.auth.SessionUser;
import com.tanmaysinghx.eggless_server.dto.ApiResponse;
import com.tanmaysinghx.eggless_server.dto.SavedSearchDto;
import com.tanmaysinghx.eggless_server.service.SavedSearchService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/saved-searches")
@RequiredArgsConstructor
public class SavedSearchController {

    private final SavedSearchService savedSearchService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<SavedSearchDto>>> getSavedSearches() {
        return ResponseEntity.ok(ApiResponse.ok(savedSearchService.getAll()));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<SavedSearchDto>> createSavedSearch(
            @RequestBody SavedSearchDto dto, HttpServletRequest request) {
        // Set by SessionInterceptor for every /api/v1 management call.
        SessionUser user = (SessionUser) request.getAttribute(SessionService.USER_ATTRIBUTE);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(savedSearchService.create(dto, user)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<SavedSearchDto>> updateSavedSearch(@PathVariable String id, @RequestBody SavedSearchDto dto) {
        return ResponseEntity.ok(ApiResponse.ok(savedSearchService.update(id, dto)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteSavedSearch(@PathVariable String id) {
        savedSearchService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok(null, "Saved search deleted"));
    }
}
