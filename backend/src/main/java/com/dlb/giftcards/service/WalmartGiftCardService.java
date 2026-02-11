package com.dlb.giftcards.service;

import com.dlb.giftcards.dto.WalmartGiftCardDtos;
import com.dlb.giftcards.entity.WalmartGiftCardEntity;
import com.dlb.giftcards.repository.WalmartGiftCardRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class WalmartGiftCardService {

    private final WalmartGiftCardRepository repo;

    public WalmartGiftCardService(WalmartGiftCardRepository repo) {
        this.repo = repo;
    }

    public WalmartGiftCardEntity getOrThrow(String id) {
        return repo.findById(id).orElseThrow(() -> new IllegalArgumentException("Walmart gift card not found: " + id));
    }

    public List<WalmartGiftCardEntity> listAll() {
        Sort sort = Sort.by(Sort.Direction.ASC, "createdAt");
        return repo.findAll(sort);
    }

    @Transactional
    public WalmartGiftCardEntity create(WalmartGiftCardDtos.UpsertWalmartGiftCardRequest req) {
        String cardNumber = req.cardNumber == null ? null : req.cardNumber.trim();
        String pin = req.pin == null ? null : req.pin.trim();

        if (cardNumber == null || cardNumber.isBlank()) throw new IllegalArgumentException("cardNumber is required");
        if (pin == null || pin.isBlank()) throw new IllegalArgumentException("pin is required");
        if (req.balance == null) throw new IllegalArgumentException("balance is required");

        repo.findFirstByCardNumber(cardNumber).ifPresent((e) -> {
            throw new IllegalArgumentException("Walmart gift card already exists for this cardNumber");
        });

        WalmartGiftCardEntity e = new WalmartGiftCardEntity();
        e.setCardNumber(cardNumber);
        e.setPin(pin);
        e.setBalance(req.balance);
        return repo.save(e);
    }

    @Transactional
    public WalmartGiftCardEntity update(String id, WalmartGiftCardDtos.UpsertWalmartGiftCardRequest req) {
        WalmartGiftCardEntity e = getOrThrow(id);

        String cardNumber = req.cardNumber == null ? null : req.cardNumber.trim();
        String pin = req.pin == null ? null : req.pin.trim();

        if (cardNumber == null || cardNumber.isBlank()) throw new IllegalArgumentException("cardNumber is required");
        if (pin == null || pin.isBlank()) throw new IllegalArgumentException("pin is required");
        if (req.balance == null) throw new IllegalArgumentException("balance is required");

        repo.findFirstByCardNumber(cardNumber).ifPresent((dup) -> {
            if (!dup.getId().equals(e.getId())) {
                throw new IllegalArgumentException("Another Walmart gift card already exists for this cardNumber");
            }
        });

        e.setCardNumber(cardNumber);
        e.setPin(pin);
        e.setBalance(req.balance);
        return repo.save(e);
    }

    @Transactional
    public void delete(String id) {
        WalmartGiftCardEntity e = getOrThrow(id);
        repo.delete(e);
    }
}
