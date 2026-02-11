package com.dlb.giftcards.dto;

import com.dlb.giftcards.entity.AnycardType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public class AnycardDtos {
    public static class UpsertAnycardRequest {
        @NotBlank
        public String cardNumber;

        public String serialNumber;

        public String pin;

        @NotNull
        public AnycardType anycardType;

        public String balance;

        public Boolean needsRedeem;
    }

    public static class AnycardResponse {
        public String id;
        public String cardNumber;
        public String serialNumber;
        public String pin;
        public AnycardType anycardType;
        public String balance;
        public boolean needsRedeem;
        public Instant createdAt;
        public Instant updatedAt;
    }
}
