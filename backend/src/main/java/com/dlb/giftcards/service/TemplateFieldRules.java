package com.dlb.giftcards.service;

import com.dlb.giftcards.dto.FieldDefinition;

public final class TemplateFieldRules {
    private TemplateFieldRules() {}

    public static final String BALANCE_KEY = "balance";
    public static final String CARD_NUMBER_KEY = "cardNumber";

    public static FieldDefinition requiredBalanceField() {
        FieldDefinition f = new FieldDefinition();
        f.key = BALANCE_KEY;
        f.label = "余额";
        f.type = "NUMBER";
        f.required = true;
        f.sensitive = false;
        return f;
    }

    public static FieldDefinition requiredCardNumberField() {
        FieldDefinition f = new FieldDefinition();
        f.key = CARD_NUMBER_KEY;
        f.label = "卡号";
        f.type = "TEXT";
        f.required = true;
        f.sensitive = false;
        return f;
    }
}
