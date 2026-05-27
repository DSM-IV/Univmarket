package com.univmarket.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "checkouts", indexes = {
    @Index(name = "idx_checkout_user", columnList = "user_id"),
    @Index(name = "idx_checkout_order_id", columnList = "order_id", unique = true)
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Checkout {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "order_id", nullable = false, length = 100, unique = true)
    private String orderId;

    // 콤마 구분 자료 ID 목록 (예: "123,456,789"). Phase 4에서 시스템 폐기 예정이라 단순 구조 유지.
    @Column(name = "material_ids", nullable = false, columnDefinition = "TEXT")
    private String materialIds;

    @Column(nullable = false, precision = 12, scale = 0)
    private BigDecimal amount;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "pending"; // pending | completed | failed

    @Column(name = "payment_key", length = 200)
    private String paymentKey;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}
