package com.univmarket.repository;

import com.univmarket.entity.VerificationSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Optional;

public interface VerificationSessionRepository extends JpaRepository<VerificationSession, Long> {

    Optional<VerificationSession> findTopByPhoneAndExpiresAtAfterOrderByCreatedAtDesc(
            String phone, LocalDateTime now);

    long countByPhoneAndCreatedAtAfter(String phone, LocalDateTime after);
}
