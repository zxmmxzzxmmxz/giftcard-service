package com.dlb.giftcards.controller;

import com.dlb.giftcards.dto.TemplateDtos;
import com.dlb.giftcards.entity.GiftCardTemplateEntity;
import com.dlb.giftcards.service.TemplateService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/templates")
public class TemplateController {

    private final TemplateService service;

    public TemplateController(TemplateService service) {
        this.service = service;
    }

    @GetMapping
    public List<TemplateDtos.TemplateResponse> list() {
        return service.list().stream().map(this::toResp).toList();
    }

    @GetMapping("/{id}")
    public TemplateDtos.TemplateResponse get(@PathVariable("id") String id) {
        return toResp(service.getOrThrow(id));
    }

    @PostMapping
    public TemplateDtos.TemplateResponse create(@RequestBody @Valid TemplateDtos.UpsertTemplateRequest req) {
        return toResp(service.create(req));
    }

    @PutMapping("/{id}")
    public TemplateDtos.TemplateResponse update(@PathVariable("id") String id, @RequestBody @Valid TemplateDtos.UpsertTemplateRequest req) {
        return toResp(service.update(id, req));
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable("id") String id) {
        service.delete(id);
    }

    private TemplateDtos.TemplateResponse toResp(GiftCardTemplateEntity e) {
        TemplateDtos.TemplateResponse r = new TemplateDtos.TemplateResponse();
        r.id = e.getId();
        r.name = e.getName();
        r.brand = e.getBrand();
        r.fields = service.readFields(e);
        r.createdAt = e.getCreatedAt();
        r.updatedAt = e.getUpdatedAt();
        return r;
    }
}
