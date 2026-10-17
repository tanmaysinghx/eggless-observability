package com.tanmaysinghx.eggless_server.repository;

import com.tanmaysinghx.eggless_server.entity.LogEntryEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface LogRepository extends JpaRepository<LogEntryEntity, String> {

    @Query("SELECT l FROM LogEntryEntity l WHERE " +
           "(:service IS NULL OR l.service = :service) AND " +
           "(:level IS NULL OR l.level = :level) AND " +
           "(:environment IS NULL OR l.environment = :environment) AND " +
           "(:search IS NULL OR LOWER(l.message) LIKE LOWER(CONCAT('%', :search, '%')) " +
           " OR LOWER(l.traceId) LIKE LOWER(CONCAT('%', :search, '%')) " +
           " OR LOWER(l.service) LIKE LOWER(CONCAT('%', :search, '%')) " +
           " OR LOWER(l.userId) LIKE LOWER(CONCAT('%', :search, '%')) " +
           " OR LOWER(l.requestId) LIKE LOWER(CONCAT('%', :search, '%'))) AND " +
           "(:since IS NULL OR l.fullTimestamp >= :since) " +
           "ORDER BY l.fullTimestamp DESC")
    List<LogEntryEntity> findLogsWithFilter(
            @Param("service") String service,
            @Param("level") String level,
            @Param("environment") String environment,
            @Param("search") String search,
            @Param("since") Instant since,
            Pageable pageable
    );

    long countByLevel(String level);

    @Query("SELECT COUNT(DISTINCT l.service) FROM LogEntryEntity l")
    long countDistinctServices();

    @Query("SELECT DISTINCT l.service FROM LogEntryEntity l")
    List<String> findDistinctServices();
}
