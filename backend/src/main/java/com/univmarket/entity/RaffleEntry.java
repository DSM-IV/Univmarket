package com.univmarket.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "raffle_entries", indexes = {
    @Index(name = "idx_raffle_user", columnList = "user_id"),
    @Index(name = "idx_raffle_product", columnList = "product_id")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class RaffleEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "product_id", nullable = false, length = 100)
    private String productId;

    @Column(nullable = false)
    @Builder.Default
    private int count = 1;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
