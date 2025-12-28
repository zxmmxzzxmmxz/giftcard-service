package com.dlb.giftcards.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.Map;

public class CardDtos {

    public static class UpsertCardRequest {
        @NotBlank
        public String templateId;

        public String displayName;

        @NotNull
        public Map<String, String> data;
    }

    public static class CardResponse {
        public String id;
        public String templateId;
        public String displayName;
        public Map<String, String> data;
        public String createdAt;
    }
}
