package com.univmarket.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "materials", indexes = {
    @Index(name = "idx_material_author", columnList = "author_id"),
    @Index(name = "idx_material_created", columnList = "created_at DESC")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Material {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private int price; // 0 ~ 500,000

    @Column(length = 50)
    private String subject; // 과목명

    @Column(length = 50)
    private String professor;

    @Column(length = 20)
    private String category; // 수업, 시험, 과제 등

    @Column(length = 20)
    private String semester; // 2026-1 등

    // 파일 정보 (R2)
    @Column(name = "file_key", length = 500)
    private String fileKey;

    @Column(name = "file_url", length = 1000)
    private String fileUrl;

    @Column(name = "file_name", length = 200)
    private String fileName;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "content_type", length = 100)
    private String contentType;

    // 통계
    @Column(name = "sales_count")
    @Builder.Default
    private int salesCount = 0;

    @Column(name = "view_count")
    @Builder.Default
    private int viewCount = 0;

    // 바이러스 검사
    @Column(name = "scan_status", length = 20)
    @Builder.Default
    private String scanStatus = "pending"; // pending | clean | infected | unavailable

    // 공개 여부
    @Builder.Default
    private boolean hidden = false;

    @Column(name = "copyright_deleted")
    @Builder.Default
    private boolean copyrightDeleted = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
