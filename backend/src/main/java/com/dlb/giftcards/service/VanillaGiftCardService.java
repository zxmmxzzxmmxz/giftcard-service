package com.dlb.giftcards.service;

import com.dlb.giftcards.dto.VanillaGiftCardDtos;
import com.dlb.giftcards.entity.VanillaGiftCardEntity;
import com.dlb.giftcards.repository.VanillaGiftCardRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class VanillaGiftCardService {

    private final VanillaGiftCardRepository repo;

    public VanillaGiftCardService(VanillaGiftCardRepository repo) {
        this.repo = repo;
    }

    public VanillaGiftCardEntity getOrThrow(String id) {
        return repo.findById(id).orElseThrow(() -> new IllegalArgumentException("Vanilla gift card not found: " + id));
    }

    public List<VanillaGiftCardEntity> listAll() {
        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt");
        return repo.findAll(sort);
    }

    @Transactional
    public VanillaGiftCardEntity create(VanillaGiftCardDtos.UpsertVanillaGiftCardRequest req) {
        String cardNumber = req.cardNumber == null ? null : req.cardNumber.trim();
        if (cardNumber == null || cardNumber.isBlank()) throw new IllegalArgumentException("cardNumber is required");

        repo.findFirstByCardNumber(cardNumber).ifPresent((e) -> {
            throw new IllegalArgumentException("Vanilla gift card already exists for this cardNumber");
        });

        VanillaGiftCardEntity e = new VanillaGiftCardEntity();
        e.setCardNumber(cardNumber);
        e.setCcv(trimToNull(req.ccv));
        e.setExpiryDate(trimToNull(req.expiryDate));
        e.setSerialNumber(trimToNull(req.serialNumber));
        e.setBalance(req.balance);
        e.setNeedsRedeem(req.needsRedeem != null && req.needsRedeem);
        return repo.save(e);
    }

    @Transactional
    public VanillaGiftCardEntity update(String id, VanillaGiftCardDtos.UpsertVanillaGiftCardRequest req) {
        VanillaGiftCardEntity e = getOrThrow(id);

        String cardNumber = req.cardNumber == null ? null : req.cardNumber.trim();
        if (cardNumber == null || cardNumber.isBlank()) throw new IllegalArgumentException("cardNumber is required");

        repo.findFirstByCardNumber(cardNumber).ifPresent((dup) -> {
            if (!dup.getId().equals(e.getId())) {
                throw new IllegalArgumentException("Another Vanilla gift card already exists for this cardNumber");
            }
        });

        e.setCardNumber(cardNumber);
        e.setCcv(trimToNull(req.ccv));
        e.setExpiryDate(trimToNull(req.expiryDate));
        e.setSerialNumber(trimToNull(req.serialNumber));
        e.setBalance(req.balance);
        e.setNeedsRedeem(req.needsRedeem != null && req.needsRedeem);
        return repo.save(e);
    }

    @Transactional
    public void delete(String id) {
        VanillaGiftCardEntity e = getOrThrow(id);
        repo.delete(e);
    }

    private String trimToNull(String v) {
        if (v == null) return null;
        String t = v.trim();
        return t.isBlank() ? null : t;
    }
}

