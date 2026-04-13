package com.univmarket.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "payment_sessions", indexes = {
    @Index(name = "idx_payment_session_user", columnList = "user_id"),
    @Index(name = "idx_payment_session_external", columnList = "external_id")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class PaymentSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 20)
    private String type; // kakaopay | toss

    @Column(nullable = false, precision = 12, scale = 0)
    private BigDecimal amount;

    @Column(name = "point_amount", nullable = false, precision = 12, scale = 0)
    private BigDecimal pointAmount;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "pending"; // pending | completed | failed | cancelled

    @Column(name = "external_id", length = 200)
    private String externalId; // TID or paymentKey

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
