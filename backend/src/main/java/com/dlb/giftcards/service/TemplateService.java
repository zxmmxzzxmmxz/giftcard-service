package com.dlb.giftcards.service;

import com.dlb.giftcards.dto.FieldDefinition;
import com.dlb.giftcards.dto.TemplateDtos;
import com.dlb.giftcards.entity.GiftCardTemplateEntity;
import com.dlb.giftcards.repository.GiftCardTemplateRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.Locale;


import java.util.List;

@Service
public class TemplateService {

    private final GiftCardTemplateRepository repo;
    private final ObjectMapper om;

    public TemplateService(GiftCardTemplateRepository repo, ObjectMapper om) {
        this.repo = repo;
        this.om = om;
    }

    public List<GiftCardTemplateEntity> list() {
        return repo.findAll();
    }

    public GiftCardTemplateEntity getOrThrow(String id) {
        return repo.findById(id).orElseThrow(() -> new IllegalArgumentException("Template not found: " + id));
    }

    public GiftCardTemplateEntity create(TemplateDtos.UpsertTemplateRequest req) {
        GiftCardTemplateEntity e = new GiftCardTemplateEntity();
        e.setName(req.name);
        e.setBrand(req.brand);
        e.setFieldsJson(writeFields(ensureRequiredFields(req.fields)));
        return repo.save(e);
    }

    public GiftCardTemplateEntity update(String id, TemplateDtos.UpsertTemplateRequest req) {
        GiftCardTemplateEntity e = getOrThrow(id);
        e.setName(req.name);
        e.setBrand(req.brand);
        e.setFieldsJson(writeFields(ensureRequiredFields(req.fields)));
        return repo.save(e);
    }

    public void delete(String id) {
        repo.deleteById(id);
    }

    public List<FieldDefinition> readFields(GiftCardTemplateEntity e) {
        try {
            return om.readValue(e.getFieldsJson(), new TypeReference<List<FieldDefinition>>() {});
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to parse fieldsJson for template " + e.getId(), ex);
        }
    }

    private String writeFields(List<FieldDefinition> fields) {
        try {
            return om.writeValueAsString(fields);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid fields", ex);
        }
    }

    private List<FieldDefinition> ensureRequiredFields(List<FieldDefinition> fields) {
        List<FieldDefinition> out = new ArrayList<>(fields);

        ensureField(
                out,
                TemplateFieldRules.CARD_NUMBER_KEY,
                TemplateFieldRules.requiredCardNumberField()
        );

        ensureField(
                out,
                TemplateFieldRules.BALANCE_KEY,
                TemplateFieldRules.requiredBalanceField()
        );

        return out;
    }

    private void ensureField(
            List<FieldDefinition> fields,
            String key,
            FieldDefinition required
    ) {
        for (int i = 0; i < fields.size(); i++) {
            FieldDefinition f = fields.get(i);
            if (f != null && f.key != null && f.key.trim().equalsIgnoreCase(key)) {
                // normalize
                f.key = key;
                f.required = true;
                f.type = required.type;
                if (f.label == null || f.label.isBlank()) {
                    f.label = required.label;
                }
                f.sensitive = required.sensitive;
                fields.set(i, f);
                return;
            }
        }

        // not found → add to front
        fields.add(0, required);
    }


}
