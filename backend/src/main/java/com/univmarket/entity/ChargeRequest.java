package com.univmarket.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "charge_requests", indexes = {
    @Index(name = "idx_charge_request_user", columnList = "user_id"),
    @Index(name = "idx_charge_request_status", columnList = "status, created_at DESC")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ChargeRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(nullable = false, precision = 12, scale = 0)
    private BigDecimal amount;

    @Column(name = "transfer_amount", nullable = false, precision = 12, scale = 0)
    private BigDecimal transferAmount;

    @Column(precision = 12, scale = 0)
    private BigDecimal vat;

    @Column(name = "sender_name", length = 50)
    private String senderName;

    @Column(name = "sender_phone", length = 20)
    private String senderPhone;

    @Column(name = "receipt_number", length = 100)
    private String receiptNumber;

    @Column(name = "receipt_type", length = 20)
    private String receiptType;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "pending"; // pending | approved | rejected

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
