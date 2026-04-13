package com.univmarket.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "purchases", indexes = {
    @Index(name = "idx_purchase_buyer_material", columnList = "buyer_id, material_id"),
    @Index(name = "idx_purchase_buyer_created", columnList = "buyer_id, created_at DESC"),
    @Index(name = "idx_purchase_settled", columnList = "settled, created_at")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Purchase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "buyer_id", nullable = false)
    private User buyer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seller_id", nullable = false)
    private User seller;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "material_id", nullable = false)
    private Material material;

    @Column(nullable = false)
    private int price;

    @Builder.Default
    private boolean settled = false;

    @Builder.Default
    private boolean downloaded = false;

    @Column(name = "downloaded_at")
    private LocalDateTime downloadedAt;

    @Builder.Default
    private boolean refunded = false;

    @Column(name = "refunded_at")
    private LocalDateTime refundedAt;

    @Column(name = "refund_reason", length = 100)
    private String refundReason;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
