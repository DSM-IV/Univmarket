package com.univmarket.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "material_requests", indexes = {
    @Index(name = "idx_material_request_user", columnList = "user_id"),
    @Index(name = "idx_material_request_created", columnList = "created_at DESC")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MaterialRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 16)
    private String nickname;

    @Column(nullable = false, length = 50)
    private String subject;

    @Column(length = 50)
    private String professor;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 20)
    private String category;

    @Column(name = "need_count", nullable = false)
    @Builder.Default
    private int needCount = 1;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "open"; // open | closed

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
