package com.dlb.giftcards.repository;

import com.dlb.giftcards.entity.WalmartGiftCardEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface WalmartGiftCardRepository extends JpaRepository<WalmartGiftCardEntity, String> {
    Optional<WalmartGiftCardEntity> findFirstByCardNumber(String cardNumber);
}

