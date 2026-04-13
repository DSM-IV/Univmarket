package com.univmarket.repository;

import com.univmarket.entity.PaymentSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PaymentSessionRepository extends JpaRepository<PaymentSession, Long> {

    Optional<PaymentSession> findByExternalIdAndStatus(String externalId, String status);

    Optional<PaymentSession> findByExternalId(String externalId);
}
