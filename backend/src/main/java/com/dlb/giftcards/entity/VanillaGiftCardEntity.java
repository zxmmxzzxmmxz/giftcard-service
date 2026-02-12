package com.dlb.giftcards.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "vanilla_gift_card")
public class VanillaGiftCardEntity {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "card_number", nullable = false, unique = true)
    private String cardNumber;

    @Column(name = "ccv")
    private String ccv;

    @Column(name = "expiry_date")
    private String expiryDate;

    @Column(name = "serial_number")
    private String serialNumber;

    @Column(name = "balance", precision = 19, scale = 2)
    private BigDecimal balance;

    @Column(name = "needs_redeem", nullable = false)
    private boolean needsRedeem = false;

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

    public String getCcv() { return ccv; }
    public void setCcv(String ccv) { this.ccv = ccv; }

    public String getExpiryDate() { return expiryDate; }
    public void setExpiryDate(String expiryDate) { this.expiryDate = expiryDate; }

    public String getSerialNumber() { return serialNumber; }
    public void setSerialNumber(String serialNumber) { this.serialNumber = serialNumber; }

    public BigDecimal getBalance() { return balance; }
    public void setBalance(BigDecimal balance) { this.balance = balance; }

    public boolean isNeedsRedeem() { return needsRedeem; }
    public void setNeedsRedeem(boolean needsRedeem) { this.needsRedeem = needsRedeem; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

