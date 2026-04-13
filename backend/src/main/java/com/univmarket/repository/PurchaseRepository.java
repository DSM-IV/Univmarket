package com.univmarket.repository;

import com.univmarket.entity.Purchase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PurchaseRepository extends JpaRepository<Purchase, Long> {

    Optional<Purchase> findByBuyerIdAndMaterialIdAndRefundedFalse(Long buyerId, Long materialId);

    boolean existsByBuyerIdAndMaterialId(Long buyerId, Long materialId);

    List<Purchase> findByBuyerIdOrderByCreatedAtDesc(Long buyerId);

    @Query("SELECT p FROM Purchase p WHERE p.settled = false AND p.createdAt < :cutoff")
    List<Purchase> findUnsettledBefore(@Param("cutoff") LocalDateTime cutoff);

    List<Purchase> findByMaterialIdAndRefundedFalse(Long materialId);
}
