package com.tanmaysinghx.eggless_server.repository;

import com.tanmaysinghx.eggless_server.entity.LogEntryEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface LogRepository extends JpaRepository<LogEntryEntity, String>, JpaSpecificationExecutor<LogEntryEntity> {

    long countByLevel(String level);

    @Query("SELECT COUNT(DISTINCT l.service) FROM LogEntryEntity l")
    long countDistinctServices();

    @Query("SELECT DISTINCT l.service FROM LogEntryEntity l")
    List<String> findDistinctServices();

    /** Rows of [service, level, count] in [from, to), optionally narrowed to one service/environment. */
    @Query("SELECT l.service, l.level, COUNT(l) FROM LogEntryEntity l WHERE " +
           "l.fullTimestamp >= :from AND l.fullTimestamp < :to AND " +
           "(:service IS NULL OR l.service = :service) AND " +
           "(:environment IS NULL OR l.environment = :environment) " +
           "GROUP BY l.service, l.level")
    List<Object[]> countByServiceAndLevel(
            @Param("from") Instant from,
            @Param("to") Instant to,
            @Param("service") String service,
            @Param("environment") String environment
    );

    /** Rows of [level, count] in [from, to). */
    @Query("SELECT l.level, COUNT(l) FROM LogEntryEntity l WHERE " +
           "l.fullTimestamp >= :from AND l.fullTimestamp < :to AND " +
           "(:service IS NULL OR l.service = :service) AND " +
           "(:environment IS NULL OR l.environment = :environment) " +
           "GROUP BY l.level")
    List<Object[]> countByLevelBetween(
            @Param("from") Instant from,
            @Param("to") Instant to,
            @Param("service") String service,
            @Param("environment") String environment
    );

    /** Rows of [message, service, count, lastSeen] for ERROR/FATAL logs, most frequent first. */
    @Query("SELECT l.message, l.service, COUNT(l), MAX(l.fullTimestamp) FROM LogEntryEntity l WHERE " +
           "l.level IN ('ERROR', 'FATAL') AND l.fullTimestamp >= :from AND l.fullTimestamp < :to AND " +
           "(:service IS NULL OR l.service = :service) AND " +
           "(:environment IS NULL OR l.environment = :environment) " +
           "GROUP BY l.message, l.service ORDER BY COUNT(l) DESC")
    List<Object[]> topErrors(
            @Param("from") Instant from,
            @Param("to") Instant to,
            @Param("service") String service,
            @Param("environment") String environment,
            Pageable pageable
    );

    @Modifying
    @Query("DELETE FROM LogEntryEntity l WHERE l.fullTimestamp < :cutoff")
    int deleteOlderThan(@Param("cutoff") Instant cutoff);
}
