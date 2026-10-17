package com.tanmaysinghx.eggless_server.repository;

import com.tanmaysinghx.eggless_server.entity.AlertRuleEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AlertRuleRepository extends JpaRepository<AlertRuleEntity, String> {
    List<AlertRuleEntity> findAllByOrderByCreatedAtDesc();
}
