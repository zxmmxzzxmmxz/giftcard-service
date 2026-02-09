package com.dlb.giftcards.repository;

import com.dlb.giftcards.entity.AutomationTaskArtifactEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AutomationTaskArtifactRepository extends JpaRepository<AutomationTaskArtifactEntity, String> {
    List<AutomationTaskArtifactEntity> findByTaskIdOrderByCreatedAtAsc(String taskId);
}

