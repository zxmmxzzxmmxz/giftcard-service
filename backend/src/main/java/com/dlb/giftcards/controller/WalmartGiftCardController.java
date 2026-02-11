package com.dlb.giftcards.controller;

import com.dlb.giftcards.dto.WalmartGiftCardDtos;
import com.dlb.giftcards.entity.WalmartGiftCardEntity;
import com.dlb.giftcards.service.WalmartGiftCardService;
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
@RequestMapping("/api/walmart-giftcards")
public class WalmartGiftCardController {

    private final WalmartGiftCardService service;

    public WalmartGiftCardController(WalmartGiftCardService service) {
        this.service = service;
    }

    @GetMapping
    public List<WalmartGiftCardDtos.WalmartGiftCardResponse> getAllCards() {
        return service.listAll().stream().map(this::toResp).toList();
    }

    @GetMapping("/{id}")
    public WalmartGiftCardDtos.WalmartGiftCardResponse getCardById(@PathVariable("id") String id) {
        return toResp(service.getOrThrow(id));
    }

    @PostMapping
    public WalmartGiftCardDtos.WalmartGiftCardResponse create(@RequestBody @Valid WalmartGiftCardDtos.UpsertWalmartGiftCardRequest req) {
        return toResp(service.create(req));
    }

    @PutMapping("/{id}")
    public WalmartGiftCardDtos.WalmartGiftCardResponse update(
            @PathVariable("id") String id,
            @RequestBody @Valid WalmartGiftCardDtos.UpsertWalmartGiftCardRequest req
    ) {
        return toResp(service.update(id, req));
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable("id") String id) {
        service.delete(id);
    }

    private WalmartGiftCardDtos.WalmartGiftCardResponse toResp(WalmartGiftCardEntity e) {
        WalmartGiftCardDtos.WalmartGiftCardResponse r = new WalmartGiftCardDtos.WalmartGiftCardResponse();
        r.id = e.getId();
        r.cardNumber = e.getCardNumber();
        r.pin = e.getPin();
        r.balance = e.getBalance();
        r.createdAt = e.getCreatedAt();
        r.updatedAt = e.getUpdatedAt();
        return r;
    }
}

