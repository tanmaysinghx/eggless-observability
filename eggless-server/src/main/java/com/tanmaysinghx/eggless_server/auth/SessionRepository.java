package com.tanmaysinghx.eggless_server.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;

@Repository
public interface SessionRepository extends JpaRepository<SessionEntity, String> {

    @Modifying
    @Query("DELETE FROM SessionEntity s WHERE s.expiresAt < :now")
    int deleteExpired(@Param("now") Instant now);
}
