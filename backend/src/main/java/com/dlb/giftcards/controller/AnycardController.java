package com.dlb.giftcards.controller;

import com.dlb.giftcards.dto.AnycardDtos;
import com.dlb.giftcards.entity.AnycardType;
import com.dlb.giftcards.entity.GiftCardAnycardEntity;
import com.dlb.giftcards.service.AnycardService;
import jakarta.validation.Valid;
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
            @RequestParam(name = "anycardType", required = false) String anycardType,
            @RequestParam(name = "cardNumber", required = false) String cardNumber
    ) {
        AnycardType t = (anycardType == null || anycardType.isBlank()) ? null : AnycardType.fromString(anycardType);
        return service.list(t, cardNumber).stream().map(this::toResp).toList();
    }

    @GetMapping("/{id}")
    public AnycardDtos.AnycardResponse get(@PathVariable("id") String id) {
        return toResp(service.getOrThrow(id));
    }

    @PostMapping
    public AnycardDtos.AnycardResponse create(@RequestBody @Valid AnycardDtos.UpsertAnycardRequest req) {
        return toResp(service.create(req.cardNumber, req.serialNumber, req.pin, req.anycardType, req.balance, req.needsRedeem));
    }

    @PutMapping("/{id}")
    public AnycardDtos.AnycardResponse update(
            @PathVariable("id") String id,
            @RequestBody @Valid AnycardDtos.UpsertAnycardRequest req
    ) {
        return toResp(service.update(id, req.cardNumber, req.serialNumber, req.pin, req.anycardType, req.balance, req.needsRedeem));
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable("id") String id) {
        service.delete(id);
    }

    private AnycardDtos.AnycardResponse toResp(GiftCardAnycardEntity e) {
        AnycardDtos.AnycardResponse r = new AnycardDtos.AnycardResponse();
        r.id = e.getId();
        r.cardNumber = e.getCardNumber();
        r.serialNumber = e.getSerialNumber();
        r.pin = e.getPin();
        r.anycardType = e.getAnycardType();
        r.balance = e.getBalance();
        r.needsRedeem = Boolean.TRUE.equals(e.getNeedsRedeem());
        r.createdAt = e.getCreatedAt();
        r.updatedAt = e.getUpdatedAt();
        return r;
    }
}
