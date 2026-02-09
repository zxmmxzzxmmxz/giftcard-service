package com.dlb.giftcards.entity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Locale;

public enum TaskType {
    GETMYBONUS_ANYCARD("getmybonus_anycard");

    private final String code;

    TaskType(String code) {
        this.code = code;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    @JsonCreator
    public static TaskType fromString(String value) {
        if (value == null) throw new IllegalArgumentException("Task type is required");

        String normalized = value.trim();
        if (normalized.isBlank()) throw new IllegalArgumentException("Task type is required");

        String upper = normalized.toUpperCase(Locale.ROOT);
        for (TaskType t : values()) {
            if (t.name().equals(upper)) return t;
            if (t.code.equalsIgnoreCase(normalized)) return t;
        }
        throw new IllegalArgumentException("Unknown task type: " + value);
    }
}

