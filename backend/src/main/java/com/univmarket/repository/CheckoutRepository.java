package com.univmarket.repository;

import com.univmarket.entity.Checkout;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CheckoutRepository extends JpaRepository<Checkout, Long> {

    Optional<Checkout> findByOrderId(String orderId);
}
