package com.dlb.giftcards.dto;

import com.dlb.giftcards.entity.AnycardType;

import java.time.Instant;

public class AnycardDtos {
    public static class AnycardResponse {
        public String id;
        public String cardNumber;
        public String pin;
        public AnycardType anycardType;
        public String balance;
        public Instant createdAt;
        public Instant updatedAt;
    }
}

