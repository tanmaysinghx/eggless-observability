package com.tanmaysinghx.eggless_server.repository;

import com.tanmaysinghx.eggless_server.entity.SavedSearchEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SavedSearchRepository extends JpaRepository<SavedSearchEntity, String> {
    List<SavedSearchEntity> findAllByOrderByNameAsc();
}
