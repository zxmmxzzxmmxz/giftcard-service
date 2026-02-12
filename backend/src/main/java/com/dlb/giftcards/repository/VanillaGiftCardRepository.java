package com.dlb.giftcards.repository;

import com.dlb.giftcards.entity.VanillaGiftCardEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface VanillaGiftCardRepository extends JpaRepository<VanillaGiftCardEntity, String> {
    Optional<VanillaGiftCardEntity> findFirstByCardNumber(String cardNumber);
}

