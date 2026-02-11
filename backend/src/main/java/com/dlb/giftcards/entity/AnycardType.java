package com.dlb.giftcards.entity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Locale;

public enum AnycardType {
    CELEBRATE("Celebrate");

    private final String code;

    AnycardType(String code) {
        this.code = code;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static AnycardType fromString(String value) {
        if (value == null) throw new IllegalArgumentException("anycardType is required");
        String normalized = value.trim();
        if (normalized.isBlank()) throw new IllegalArgumentException("anycardType is required");

        String upper = normalized.toUpperCase(Locale.ROOT);
        for (AnycardType t : values()) {
            if (t.name().equals(upper)) return t;
            if (t.code.equalsIgnoreCase(normalized)) return t;
        }
        throw new IllegalArgumentException("Unknown anycardType: " + value);
    }
}
