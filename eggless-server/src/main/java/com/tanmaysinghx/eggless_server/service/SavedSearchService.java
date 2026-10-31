package com.tanmaysinghx.eggless_server.service;

import com.tanmaysinghx.eggless_server.auth.SessionUser;
import com.tanmaysinghx.eggless_server.dto.SavedSearchDto;
import com.tanmaysinghx.eggless_server.entity.SavedSearchEntity;
import com.tanmaysinghx.eggless_server.query.LogQuery;
import com.tanmaysinghx.eggless_server.repository.SavedSearchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SavedSearchService {

    private static final Set<String> LEVELS = Set.of("TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL");

    private final SavedSearchRepository savedSearchRepository;

    @Transactional(readOnly = true)
    public List<SavedSearchDto> getAll() {
        return savedSearchRepository.findAllByOrderByNameAsc().stream().map(SavedSearchService::toDto).toList();
    }

    @Transactional
    public SavedSearchDto create(SavedSearchDto dto, SessionUser user) {
        SavedSearchEntity entity = SavedSearchEntity.builder()
                .id("srch_" + UUID.randomUUID().toString().substring(0, 8))
                .createdBy(user != null ? (user.name() != null ? user.name() : user.email()) : null)
                .createdAt(Instant.now())
                .build();
        apply(dto, entity);
        return toDto(savedSearchRepository.save(entity));
    }

    @Transactional
    public SavedSearchDto update(String id, SavedSearchDto dto) {
        SavedSearchEntity entity = savedSearchRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Saved search not found: " + id));
        apply(dto, entity);
        return toDto(savedSearchRepository.save(entity));
    }

    @Transactional
    public void delete(String id) {
        if (!savedSearchRepository.existsById(id)) {
            throw new NoSuchElementException("Saved search not found: " + id);
        }
        savedSearchRepository.deleteById(id);
    }

    /** Validates the definition in {@code dto} and copies it onto {@code entity}. */
    private static void apply(SavedSearchDto dto, SavedSearchEntity entity) {
        if (dto.getName() == null || dto.getName().isBlank()) {
            throw new IllegalArgumentException("Saved search name is required");
        }
        String query = dto.getQuery() != null ? dto.getQuery().trim() : "";
        if (query.length() > 2000) {
            throw new IllegalArgumentException("Search query is too long (max 2000 characters)");
        }
        List<String> levels = dto.getLevels() != null ? dto.getLevels() : List.of();
        for (String level : levels) {
            if (!LEVELS.contains(level)) {
                throw new IllegalArgumentException("Unknown log level: " + level);
            }
        }
        String timeRange = dto.getTimeRange() != null && !dto.getTimeRange().isBlank() ? dto.getTimeRange() : "1h";
        if (LogQuery.parseWindow(timeRange) == null) {
            throw new IllegalArgumentException("Time range must look like 15m, 1h or 7d (got: " + timeRange + ")");
        }
        entity.setName(dto.getName().trim());
        entity.setQuery(query);
        entity.setLevels(String.join(",", levels));
        entity.setTimeRange(timeRange);
        entity.setApplication(orAll(dto.getApplication()));
        entity.setEnvironment(orAll(dto.getEnvironment()));
    }

    private static String orAll(String value) {
        return value != null && !value.isBlank() ? value : "all";
    }

    private static SavedSearchDto toDto(SavedSearchEntity e) {
        return SavedSearchDto.builder()
                .id(e.getId())
                .name(e.getName())
                .query(e.getQuery())
                .levels(e.getLevels() == null || e.getLevels().isEmpty() ? List.of() : Arrays.asList(e.getLevels().split(",")))
                .timeRange(e.getTimeRange())
                .application(e.getApplication())
                .environment(e.getEnvironment())
                .createdBy(e.getCreatedBy())
                .createdAt(e.getCreatedAt())
                .build();
    }
}
