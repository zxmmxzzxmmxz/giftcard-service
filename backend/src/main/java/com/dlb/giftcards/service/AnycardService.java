package com.dlb.giftcards.service;

import com.dlb.giftcards.entity.AnycardType;
import com.dlb.giftcards.entity.GiftCardAnycardEntity;
import com.dlb.giftcards.repository.GiftCardAnycardRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Sort;

import java.util.List;
import java.util.Objects;

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
    public GiftCardAnycardEntity create(
            String cardNumber,
            String serialNumber,
            String pin,
            AnycardType anycardType,
            String balance,
            Boolean needsRedeem
    ) {
        if (cardNumber == null || cardNumber.isBlank()) throw new IllegalArgumentException("cardNumber is required");
        Objects.requireNonNull(anycardType, "anycardType");

        repo.findByAnycardTypeAndCardNumber(anycardType, cardNumber).ifPresent((e) -> {
            throw new IllegalArgumentException("Anycard already exists for this type + cardNumber");
        });

        GiftCardAnycardEntity e = new GiftCardAnycardEntity();
        e.setCardNumber(cardNumber.trim());
        e.setSerialNumber(serialNumber == null ? null : serialNumber.trim());
        e.setPin(pin == null ? null : pin.trim());
        e.setAnycardType(anycardType);
        e.setBalance(balance == null ? null : balance.trim());
        e.setNeedsRedeem(needsRedeem != null && needsRedeem);
        return repo.save(e);
    }

    @Transactional
    public GiftCardAnycardEntity update(
            String id,
            String cardNumber,
            String serialNumber,
            String pin,
            AnycardType anycardType,
            String balance,
            Boolean needsRedeem
    ) {
        GiftCardAnycardEntity e = getOrThrow(id);
        if (cardNumber == null || cardNumber.isBlank()) throw new IllegalArgumentException("cardNumber is required");
        Objects.requireNonNull(anycardType, "anycardType");

        String nextCardNumber = cardNumber.trim();
        AnycardType nextType = anycardType;

        repo.findByAnycardTypeAndCardNumber(nextType, nextCardNumber).ifPresent((dup) -> {
            if (!dup.getId().equals(e.getId())) {
                throw new IllegalArgumentException("Another anycard already exists for this type + cardNumber");
            }
        });

        e.setCardNumber(nextCardNumber);
        e.setSerialNumber(serialNumber == null ? null : serialNumber.trim());
        e.setPin(pin == null ? null : pin.trim());
        e.setAnycardType(nextType);
        e.setBalance(balance == null ? null : balance.trim());
        e.setNeedsRedeem(needsRedeem != null && needsRedeem);
        return repo.save(e);
    }

    @Transactional
    public void delete(String id) {
        GiftCardAnycardEntity e = getOrThrow(id);
        repo.delete(e);
    }

    @Transactional
    public GiftCardAnycardEntity upsertFromTaskResult(JsonNode result) {
        if (result == null || result.isNull()) {
            throw new IllegalArgumentException("Missing task result");
        }

        String cardNumber = text(result, "card_number");
        String serialNumber = firstTextOrNull(result, "serial_number", "serialNumber");
        String pin = textOrNull(result, "PIN");
        String balance = textOrNull(result, "balance");
        AnycardType anycardType = AnycardType.fromString(text(result, "card_type"));

        GiftCardAnycardEntity e = repo.findByAnycardTypeAndCardNumber(anycardType, cardNumber).orElseGet(GiftCardAnycardEntity::new);
        e.setAnycardType(anycardType);
        e.setCardNumber(cardNumber);
        e.setSerialNumber(serialNumber);
        e.setPin(pin);
        e.setBalance(balance);
        if (e.getNeedsRedeem() == null) e.setNeedsRedeem(false);
        return repo.save(e);
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

    private String firstTextOrNull(JsonNode obj, String... keys) {
        if (obj == null || obj.isNull()) return null;
        for (String k : keys) {
            String v = textOrNull(obj, k);
            if (v != null) return v;
        }
        return null;
    }
}
