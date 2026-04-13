package com.univmarket.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "reports", indexes = {
    @Index(name = "idx_report_reporter", columnList = "reporter_id, created_at"),
    @Index(name = "idx_report_status", columnList = "status, created_at DESC")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Report {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "material_id", nullable = false)
    private Material material;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reporter_id", nullable = false)
    private User reporter;

    @Column(nullable = false, length = 20)
    private String type; // copyright | defect

    @Column(nullable = false, length = 100)
    private String reason;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "original_source", length = 500)
    private String originalSource;

    @Column(name = "contact_email", length = 200)
    private String contactEmail;

    @Column(name = "is_rights_holder")
    @Builder.Default
    private boolean rightsHolder = false;

    @Column(name = "purchase_id")
    private Long purchaseId;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "pending"; // pending | resolved | rejected

    @Column(length = 50)
    private String resolution;

    @Column(name = "resolved_by", length = 128)
    private String resolvedBy;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
