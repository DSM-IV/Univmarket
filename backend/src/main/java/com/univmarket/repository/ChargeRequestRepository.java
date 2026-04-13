package com.univmarket.repository;

import com.univmarket.entity.ChargeRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChargeRequestRepository extends JpaRepository<ChargeRequest, Long> {

    Page<ChargeRequest> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<ChargeRequest> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);
}
