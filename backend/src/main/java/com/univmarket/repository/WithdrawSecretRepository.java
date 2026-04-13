package com.univmarket.repository;

import com.univmarket.entity.WithdrawSecret;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface WithdrawSecretRepository extends JpaRepository<WithdrawSecret, Long> {

    Optional<WithdrawSecret> findByTransactionId(Long transactionId);
}
