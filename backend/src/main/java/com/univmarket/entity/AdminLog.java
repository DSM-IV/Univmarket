package com.univmarket.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "admin_logs", indexes = {
    @Index(name = "idx_admin_log_created", columnList = "created_at DESC")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class AdminLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "admin_uid", nullable = false, length = 128)
    private String adminUid;

    @Column(nullable = false, length = 50)
    private String action;

    @Column(columnDefinition = "JSONB")
    private String details; // JSON 형태로 저장

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
