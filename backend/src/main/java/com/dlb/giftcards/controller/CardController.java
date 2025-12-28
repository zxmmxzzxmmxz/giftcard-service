package com.dlb.giftcards.controller;

import com.dlb.giftcards.dto.CardDtos;
import com.dlb.giftcards.entity.GiftCardEntity;
import com.dlb.giftcards.service.CardService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cards")
public class CardController {

    private final CardService service;

    public CardController(CardService service) {
        this.service = service;
    }

    @GetMapping
    public List<CardDtos.CardResponse> list(
            @RequestParam(name = "templateId", required = false) String templateId,
            @RequestParam(name = "query", required = false) String query,
            @RequestParam(name = "includeArchived", required = false) Boolean includeArchived
    ) {
        return service.list(templateId, query, includeArchived).stream().map(this::toResp).toList();
    }


    @GetMapping("/{id}")
    public CardDtos.CardResponse get(@PathVariable("id") String id) {
        return toResp(service.getOrThrow(id));
    }

    @PostMapping
    public CardDtos.CardResponse create(@RequestBody @Valid CardDtos.UpsertCardRequest req) {
        return toResp(service.create(req));
    }

    @PutMapping("/{id}")
    public CardDtos.CardResponse update(@PathVariable("id") String id, @RequestBody @Valid CardDtos.UpsertCardRequest req) {
        return toResp(service.update(id, req));
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable("id") String id) {
        service.delete(id);
    }

    private CardDtos.CardResponse toResp(GiftCardEntity e) {
        CardDtos.CardResponse r = new CardDtos.CardResponse();
        r.id = e.getId();
        r.templateId = e.getTemplateId();
        r.displayName = e.getDisplayName();
        r.data = service.readData(e);
        r.createdAt = e.getCreatedAt() == null ? null : e.getCreatedAt().toString();
        return r;
    }
}

