package com.univmarket.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "transactions", indexes = {
    @Index(name = "idx_tx_user_created", columnList = "user_id, created_at DESC"),
    @Index(name = "idx_tx_type_status", columnList = "type, status")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 30)
    private String type; // charge, purchase, sale, refund, withdraw, admin_grant, raffle_entry

    @Column(nullable = false, precision = 12, scale = 0)
    private BigDecimal amount;

    @Column(name = "balance_after", precision = 12, scale = 0)
    private BigDecimal balanceAfter;

    @Column(name = "balance_type", length = 10)
    private String balanceType; // points | earnings

    @Column(length = 500)
    private String description;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "completed"; // pending | completed | rejected | failed

    // 결제 관련
    @Column(name = "kakaopay_tid", length = 100)
    private String kakaopayTid;

    @Column(name = "toss_payment_key", length = 200)
    private String tossPaymentKey;

    @Column(name = "toss_payment_amount", precision = 12, scale = 0)
    private BigDecimal tossPaymentAmount;

    // 출금 관련
    @Column(precision = 12, scale = 0)
    private BigDecimal fee;

    @Column(precision = 12, scale = 0)
    private BigDecimal commission;

    @Column(precision = 12, scale = 0)
    private BigDecimal tax;

    @Column(name = "total_deduction", precision = 12, scale = 0)
    private BigDecimal totalDeduction;

    @Column(precision = 12, scale = 0)
    private BigDecimal received;

    @Column(name = "bank_name", length = 30)
    private String bankName;

    @Column(name = "account_number", length = 30) // 마스킹된 계좌번호
    private String accountNumber;

    @Column(name = "account_holder", length = 50)
    private String accountHolder;

    // 관련 자료/유저
    @Column(name = "related_material_id")
    private Long relatedMaterialId;

    @Column(name = "related_user_id")
    private Long relatedUserId;

    @Column(name = "granted_by", length = 128)
    private String grantedBy; // admin UID

    @Column(name = "completed_by", length = 128)
    private String completedBy;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "rejected_by", length = 128)
    private String rejectedBy;

    @Column(name = "rejected_at")
    private LocalDateTime rejectedAt;

    @Column(name = "reject_reason", length = 500)
    private String rejectReason;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
