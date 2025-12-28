package com.dlb.giftcards.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;

public class TemplateDtos {

    public static class UpsertTemplateRequest {
        @NotBlank
        public String name;

        public String brand;

        @NotNull
        @Valid
        public List<FieldDefinition> fields;
    }

    public static class TemplateResponse {
        public String id;
        public String name;
        public String brand;
        public List<FieldDefinition> fields;
        public Instant createdAt;
        public Instant updatedAt;
    }
}
