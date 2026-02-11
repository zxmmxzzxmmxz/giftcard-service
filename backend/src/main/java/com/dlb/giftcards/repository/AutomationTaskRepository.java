package com.dlb.giftcards.repository;

import com.dlb.giftcards.entity.AutomationTaskEntity;
import com.dlb.giftcards.entity.TaskStatus;
import com.dlb.giftcards.entity.TaskType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AutomationTaskRepository extends JpaRepository<AutomationTaskEntity, String> {
    Optional<AutomationTaskEntity> findFirstByStatusOrderByCreatedAtAsc(TaskStatus status);
    Optional<AutomationTaskEntity> findFirstByStatusAndTypeOrderByCreatedAtAsc(TaskStatus status, TaskType type);
    List<AutomationTaskEntity> findByType(TaskType type);
}
