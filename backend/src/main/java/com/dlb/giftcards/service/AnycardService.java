package com.dlb.giftcards.service;

import com.dlb.giftcards.entity.AnycardType;
import com.dlb.giftcards.entity.GiftCardAnycardEntity;
import com.dlb.giftcards.repository.GiftCardAnycardRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Sort;

import java.util.List;
import java.util.Locale;

@Service
public class AnycardService {

    private final GiftCardAnycardRepository repo;

    public AnycardService(GiftCardAnycardRepository repo) {
        this.repo = repo;
    }

    public GiftCardAnycardEntity getOrThrow(String id) {
        return repo.findById(id).orElseThrow(() -> new IllegalArgumentException("Anycard not found: " + id));
    }

    public List<GiftCardAnycardEntity> list(AnycardType anycardType, String cardNumber) {
        Sort sort = Sort.by(Sort.Direction.DESC, "updatedAt");

        boolean hasType = anycardType != null;
        boolean hasCard = cardNumber != null && !cardNumber.isBlank();
        if (!hasType && !hasCard) return repo.findAll(sort);

        return repo.findAll(sort).stream()
                .filter(e -> !hasType || anycardType == e.getAnycardType())
                .filter(e -> !hasCard || (e.getCardNumber() != null && e.getCardNumber().contains(cardNumber)))
                .toList();
    }

    @Transactional
    public GiftCardAnycardEntity upsertFromTaskResult(JsonNode result) {
        if (result == null || result.isNull()) {
            throw new IllegalArgumentException("Missing task result");
        }

        String cardNumber = text(result, "card_number");
        String pin = textOrNull(result, "PIN");
        String balance = textOrNull(result, "balance");
        AnycardType anycardType = parseAnycardType(text(result, "card_type"));

        GiftCardAnycardEntity e = repo.findByAnycardTypeAndCardNumber(anycardType, cardNumber).orElseGet(GiftCardAnycardEntity::new);
        e.setAnycardType(anycardType);
        e.setCardNumber(cardNumber);
        e.setPin(pin);
        e.setBalance(balance);
        return repo.save(e);
    }

    private AnycardType parseAnycardType(String value) {
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (normalized.equals("CELEBRATE")) return AnycardType.CELEBRATE;
        if (normalized.equals("CELEBRATE CARD")) return AnycardType.CELEBRATE;
        throw new IllegalArgumentException("Unknown anycard_type: " + value);
    }

    private String text(JsonNode obj, String key) {
        JsonNode node = obj.get(key);
        if (node == null || node.isNull()) throw new IllegalArgumentException("Missing field: " + key);
        String v = node.asText();
        if (v == null || v.isBlank()) throw new IllegalArgumentException("Missing field: " + key);
        return v;
    }

    private String textOrNull(JsonNode obj, String key) {
        JsonNode node = obj.get(key);
        if (node == null || node.isNull()) return null;
        String v = node.asText();
        return v == null || v.isBlank() ? null : v;
    }
}
