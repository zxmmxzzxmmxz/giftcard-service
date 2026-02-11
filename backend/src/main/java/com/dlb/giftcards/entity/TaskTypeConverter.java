package com.dlb.giftcards.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = false)
public class TaskTypeConverter implements AttributeConverter<TaskType, String> {
    @Override
    public String convertToDatabaseColumn(TaskType attribute) {
        return attribute == null ? null : attribute.getCode();
    }

    @Override
    public TaskType convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        return TaskType.fromString(dbData);
    }
}

