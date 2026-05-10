package com.univmarket.repository;

import com.univmarket.entity.MaterialRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MaterialRequestRepository extends JpaRepository<MaterialRequest, Long> {

    Page<MaterialRequest> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
