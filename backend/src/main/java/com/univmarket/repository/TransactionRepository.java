package com.univmarket.repository;

import com.univmarket.entity.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    Page<Transaction> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    List<Transaction> findByTypeAndStatusOrderByCreatedAtDesc(String type, String status);

    List<Transaction> findTop200ByTypeOrderByCreatedAtDesc(String type);
}
