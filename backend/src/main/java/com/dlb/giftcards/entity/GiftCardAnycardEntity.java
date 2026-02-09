package com.dlb.giftcards.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "giftcard_anycard")
public class GiftCardAnycardEntity {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "card_number", nullable = false)
    private String cardNumber;

    @Column(name = "pin")
    private String pin;

    @Enumerated(EnumType.STRING)
    @Column(name = "anycard_type", nullable = false)
    private AnycardType anycardType;

    @Column(name = "balance")
    private String balance;

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

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCardNumber() { return cardNumber; }
    public void setCardNumber(String cardNumber) { this.cardNumber = cardNumber; }

    public String getPin() { return pin; }
    public void setPin(String pin) { this.pin = pin; }

    public AnycardType getAnycardType() { return anycardType; }
    public void setAnycardType(AnycardType anycardType) { this.anycardType = anycardType; }

    public String getBalance() { return balance; }
    public void setBalance(String balance) { this.balance = balance; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

