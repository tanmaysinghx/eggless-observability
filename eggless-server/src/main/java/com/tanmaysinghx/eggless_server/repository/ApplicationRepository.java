package com.tanmaysinghx.eggless_server.repository;

import com.tanmaysinghx.eggless_server.entity.ApplicationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ApplicationRepository extends JpaRepository<ApplicationEntity, String> {
    Optional<ApplicationEntity> findByName(String name);
}
