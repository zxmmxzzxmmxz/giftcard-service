package com.dlb.giftcards.repository;

import com.dlb.giftcards.entity.GiftCardEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Sort;
import java.util.List;
import java.util.Optional;

public interface GiftCardRepository extends JpaRepository<GiftCardEntity, String> {
    List<GiftCardEntity> findByTemplateId(String templateId);

    // 简单搜索：displayName 模糊匹配（先够用）
    List<GiftCardEntity> findByDisplayNameContainingIgnoreCase(String q);

    List<GiftCardEntity> findByTemplateIdAndDisplayNameContainingIgnoreCase(String templateId, String q);

    List<GiftCardEntity> findByArchivedFalse(Sort sort);
    List<GiftCardEntity> findByTemplateIdAndArchivedFalse(String templateId, Sort sort);
    List<GiftCardEntity> findByDisplayNameContainingIgnoreCaseAndArchivedFalse(String q, Sort sort);
    List<GiftCardEntity> findByTemplateIdAndDisplayNameContainingIgnoreCaseAndArchivedFalse(String templateId, String q, Sort sort);

    Optional<GiftCardEntity> findByIdAndArchivedFalse(String id);
}
