package com.dlb.giftcards.controller;

import com.dlb.giftcards.dto.AnycardDtos;
import com.dlb.giftcards.entity.AnycardType;
import com.dlb.giftcards.entity.GiftCardAnycardEntity;
import com.dlb.giftcards.service.AnycardService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/anycards")
public class AnycardController {

    private final AnycardService service;

    public AnycardController(AnycardService service) {
        this.service = service;
    }

    @GetMapping
    public List<AnycardDtos.AnycardResponse> list(
            @RequestParam(name = "anycardType", required = false) AnycardType anycardType,
            @RequestParam(name = "cardNumber", required = false) String cardNumber
    ) {
        return service.list(anycardType, cardNumber).stream().map(this::toResp).toList();
    }

    @GetMapping("/{id}")
    public AnycardDtos.AnycardResponse get(@PathVariable("id") String id) {
        return toResp(service.getOrThrow(id));
    }

    private AnycardDtos.AnycardResponse toResp(GiftCardAnycardEntity e) {
        AnycardDtos.AnycardResponse r = new AnycardDtos.AnycardResponse();
        r.id = e.getId();
        r.cardNumber = e.getCardNumber();
        r.pin = e.getPin();
        r.anycardType = e.getAnycardType();
        r.balance = e.getBalance();
        r.createdAt = e.getCreatedAt();
        r.updatedAt = e.getUpdatedAt();
        return r;
    }
}

