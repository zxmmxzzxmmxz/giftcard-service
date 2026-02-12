package com.dlb.giftcards.controller;

import com.dlb.giftcards.dto.VanillaGiftCardDtos;
import com.dlb.giftcards.entity.VanillaGiftCardEntity;
import com.dlb.giftcards.service.VanillaGiftCardService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/vanilla-giftcards")
public class VanillaGiftCardController {

    private final VanillaGiftCardService service;

    public VanillaGiftCardController(VanillaGiftCardService service) {
        this.service = service;
    }

    @GetMapping
    public List<VanillaGiftCardDtos.VanillaGiftCardResponse> listAll() {
        return service.listAll().stream().map(this::toResp).toList();
    }

    @PostMapping
    public VanillaGiftCardDtos.VanillaGiftCardResponse create(@RequestBody @Valid VanillaGiftCardDtos.UpsertVanillaGiftCardRequest req) {
        return toResp(service.create(req));
    }

    @PutMapping("/{id}")
    public VanillaGiftCardDtos.VanillaGiftCardResponse update(
            @PathVariable("id") String id,
            @RequestBody @Valid VanillaGiftCardDtos.UpsertVanillaGiftCardRequest req
    ) {
        return toResp(service.update(id, req));
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable("id") String id) {
        service.delete(id);
    }

    private VanillaGiftCardDtos.VanillaGiftCardResponse toResp(VanillaGiftCardEntity e) {
        VanillaGiftCardDtos.VanillaGiftCardResponse r = new VanillaGiftCardDtos.VanillaGiftCardResponse();
        r.id = e.getId();
        r.cardNumber = e.getCardNumber();
        r.ccv = e.getCcv();
        r.expiryDate = e.getExpiryDate();
        r.serialNumber = e.getSerialNumber();
        r.balance = e.getBalance();
        r.needsRedeem = e.isNeedsRedeem();
        r.createdAt = e.getCreatedAt();
        r.updatedAt = e.getUpdatedAt();
        return r;
    }
}

