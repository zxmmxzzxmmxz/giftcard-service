package com.dlb.giftcards.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "gift_card_template")
public class GiftCardTemplateEntity {

    @Id
    @Column(length = 36)
    private String id;

    @Column(nullable = false)
    private String name;

    @Column
    private String brand;

    @Lob
    @Column(name = "fields_json", nullable = false)
    private String fieldsJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        if (this.id == null) this.id = UUID.randomUUID().toString();
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        this.updatedAt = Instant.now();
    }

    // getters/setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getBrand() { return brand; }
    public void setBrand(String brand) { this.brand = brand; }

    public String getFieldsJson() { return fieldsJson; }
    public void setFieldsJson(String fieldsJson) { this.fieldsJson = fieldsJson; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
