package com.univmarket.repository;

import com.univmarket.entity.SellerPayoutProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SellerPayoutProfileRepository extends JpaRepository<SellerPayoutProfile, Long> {

    Optional<SellerPayoutProfile> findByUserId(Long userId);

    List<SellerPayoutProfile> findAllByOrderByCreatedAtDesc();
}
