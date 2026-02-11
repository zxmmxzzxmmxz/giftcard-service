package com.dlb.giftcards.repository;

import com.dlb.giftcards.entity.AnycardType;
import com.dlb.giftcards.entity.GiftCardAnycardEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GiftCardAnycardRepository extends JpaRepository<GiftCardAnycardEntity, String> {
    Optional<GiftCardAnycardEntity> findByAnycardTypeAndCardNumber(AnycardType anycardType, String cardNumber);
    List<GiftCardAnycardEntity> findByNeedsRedeemTrue();
    Optional<GiftCardAnycardEntity> findFirstByCardNumber(String cardNumber);
    Optional<GiftCardAnycardEntity> findFirstBySerialNumber(String serialNumber);
}
