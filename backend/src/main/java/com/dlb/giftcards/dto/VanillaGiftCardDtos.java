package com.dlb.giftcards.dto;

import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;
import java.time.Instant;

public class VanillaGiftCardDtos {

    public static class UpsertVanillaGiftCardRequest {
        @NotBlank
        public String cardNumber;

        public String ccv;
        public String expiryDate;
        public String serialNumber;
        public BigDecimal balance;
        public Boolean needsRedeem;
    }

    public static class VanillaGiftCardResponse {
        public String id;
        public String cardNumber;
        public String ccv;
        public String expiryDate;
        public String serialNumber;
        public BigDecimal balance;
        public boolean needsRedeem;
        public Instant createdAt;
        public Instant updatedAt;
    }
}

