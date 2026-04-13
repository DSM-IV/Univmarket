package com.univmarket.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "cart", indexes = {
    @Index(name = "idx_cart_user", columnList = "user_id")
}, uniqueConstraints = {
    @UniqueConstraint(name = "uq_cart_user_material", columnNames = {"user_id", "material_id"})
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Cart {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "material_id", nullable = false)
    private Long materialId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false)
    private int price;

    @Column(length = 100)
    private String author;

    @Column(length = 20)
    private String category;

    @Column(length = 1000)
    private String thumbnail;

    @CreationTimestamp
    @Column(name = "added_at", updatable = false)
    private LocalDateTime addedAt;
}
