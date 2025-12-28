package com.dlb.giftcards.dto;

import jakarta.validation.constraints.NotBlank;

public class FieldDefinition {
    @NotBlank
    public String key;

    @NotBlank
    public String label;

    @NotBlank
    public String type; // TEXT / NUMBER / SECRET / DATE / URL / TEXTAREA

    public boolean required;
    public boolean sensitive;
}
