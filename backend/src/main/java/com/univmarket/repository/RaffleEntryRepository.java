package com.univmarket.repository;

import com.univmarket.entity.RaffleEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RaffleEntryRepository extends JpaRepository<RaffleEntry, Long> {

    List<RaffleEntry> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<RaffleEntry> findByUserIdAndProductId(Long userId, String productId);
}
