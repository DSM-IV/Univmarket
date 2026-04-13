package com.univmarket.repository;

import com.univmarket.entity.Cart;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CartRepository extends JpaRepository<Cart, Long> {

    List<Cart> findByUserIdOrderByAddedAtDesc(Long userId);

    Optional<Cart> findByUserIdAndMaterialId(Long userId, Long materialId);

    boolean existsByUserIdAndMaterialId(Long userId, Long materialId);

    void deleteByUserIdAndMaterialId(Long userId, Long materialId);
}
