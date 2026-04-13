package com.univmarket.repository;

import com.univmarket.entity.Report;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface ReportRepository extends JpaRepository<Report, Long> {

    Page<Report> findAllByOrderByCreatedAtDesc(Pageable pageable);

    long countByReporterIdAndCreatedAtAfter(Long reporterId, LocalDateTime after);

    boolean existsByReporterIdAndMaterialIdAndStatusAndType(
            Long reporterId, Long materialId, String status, String type);
}
