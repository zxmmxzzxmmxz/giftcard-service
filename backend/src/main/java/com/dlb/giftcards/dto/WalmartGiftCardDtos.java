package com.dlb.giftcards.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;

public class WalmartGiftCardDtos {

    public static class UpsertWalmartGiftCardRequest {
        @NotBlank
        public String cardNumber;

        @NotBlank
        public String pin;

        @NotNull
        public BigDecimal balance;
    }

    public static class WalmartGiftCardResponse {
        public String id;
        public String cardNumber;
        public String pin;
        public BigDecimal balance;
        public Instant createdAt;
        public Instant updatedAt;
    }
}

