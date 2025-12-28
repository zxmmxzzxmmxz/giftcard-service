package com.dlb.giftcards.service;

import com.dlb.giftcards.dto.CardDtos;
import com.dlb.giftcards.entity.GiftCardEntity;
import com.dlb.giftcards.repository.GiftCardRepository;
import com.dlb.giftcards.repository.GiftCardTemplateRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Sort;

import java.util.List;
import java.util.Map;

@Service
public class CardService {

    private final GiftCardRepository repo;
    private final GiftCardTemplateRepository templateRepo;
    private final ObjectMapper om;

    public CardService(GiftCardRepository repo, GiftCardTemplateRepository templateRepo, ObjectMapper om) {
        this.repo = repo;
        this.templateRepo = templateRepo;
        this.om = om;
    }

    public List<GiftCardEntity> list(String templateId, String query, Boolean includeArchived) {
        boolean hasTemplate = templateId != null && !templateId.isBlank();
        boolean hasQuery = query != null && !query.isBlank();
        boolean inc = includeArchived != null && includeArchived;

        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt");

        if (inc) {
            // include archived => 不过滤
            // 这里先用原 repo.findAll() + sort（最简单）
            // 需要 Sort 的话可以用 repo.findAll(sort)，你可以加一个：extends JpaRepository 已支持
            if (hasTemplate && hasQuery) return repo.findAll().stream()
                    .filter(c -> templateId.equals(c.getTemplateId()))
                    .filter(c -> c.getDisplayName() != null && c.getDisplayName().toLowerCase().contains(query.toLowerCase()))
                    .toList();

            if (hasTemplate) return repo.findByTemplateId(templateId);
            if (hasQuery) return repo.findByDisplayNameContainingIgnoreCase(query);
            return repo.findAll();
        }

        // default: archived=false
        if (hasTemplate && hasQuery) return repo.findByTemplateIdAndDisplayNameContainingIgnoreCaseAndArchivedFalse(templateId, query, sort);
        if (hasTemplate) return repo.findByTemplateIdAndArchivedFalse(templateId, sort);
        if (hasQuery) return repo.findByDisplayNameContainingIgnoreCaseAndArchivedFalse(query, sort);
        return repo.findByArchivedFalse(sort);
    }


    public GiftCardEntity getOrThrow(String id) {
        return repo.findById(id).orElseThrow(() -> new IllegalArgumentException("Card not found: " + id));
    }

    public GiftCardEntity create(CardDtos.UpsertCardRequest req) {
        // 确保 template 存在
        templateRepo.findById(req.templateId)
                .orElseThrow(() -> new IllegalArgumentException("Template not found: " + req.templateId));

        GiftCardEntity e = new GiftCardEntity();
        e.setTemplateId(req.templateId);
        e.setDisplayName(req.displayName);
        e.setDataJson(writeData(req.data));
        return repo.save(e);
    }

    public GiftCardEntity update(String id, CardDtos.UpsertCardRequest req) {
        templateRepo.findById(req.templateId)
                .orElseThrow(() -> new IllegalArgumentException("Template not found: " + req.templateId));

        GiftCardEntity e = getOrThrow(id);
        e.setTemplateId(req.templateId);
        e.setDisplayName(req.displayName);
        e.setDataJson(writeData(req.data));
        return repo.save(e);
    }

    public void delete(String id) {
        GiftCardEntity e = getOrThrow(id);
        e.setArchived(true);
        repo.save(e);
    }

    public GiftCardEntity unarchive(String id) {
        GiftCardEntity e = getOrThrow(id);
        e.setArchived(false);
        return repo.save(e);
    }

    public Map<String, String> readData(GiftCardEntity e) {
        try {
            return om.readValue(e.getDataJson(), new TypeReference<Map<String, String>>() {});
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to parse dataJson for card " + e.getId(), ex);
        }
    }

    private String writeData(Map<String, String> data) {
        try {
            return om.writeValueAsString(data);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid data", ex);
        }
    }
}
