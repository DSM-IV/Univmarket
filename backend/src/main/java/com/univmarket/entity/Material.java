package com.univmarket.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

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
    private String subject;

    @Column(length = 50)
    private String professor;

    @Column(length = 20)
    private String category;

    @Column(length = 50)
    private String department;

    @Column(length = 20)
    private String semester;

    @Column(name = "file_type", length = 50)
    private String fileType;

    @Column(name = "pages")
    @Builder.Default
    private int pages = 0;

    @Column(name = "file_count")
    @Builder.Default
    private int fileCount = 0;

    // 대표 파일 (다운로드/미리보기용 기본값)
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

    // 다중 파일 (최대 10개)
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "material_files",
            joinColumns = @JoinColumn(name = "material_id"))
    @OrderColumn(name = "idx")
    @BatchSize(size = 50)
    @Builder.Default
    private List<MaterialFile> files = new ArrayList<>();

    // 썸네일 + 미리보기 이미지
    @Column(name = "thumbnail", length = 1000)
    private String thumbnail;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "material_preview_images",
            joinColumns = @JoinColumn(name = "material_id"))
    @OrderColumn(name = "idx")
    @Column(name = "url", length = 1000)
    @BatchSize(size = 50)
    @Builder.Default
    private List<String> previewImages = new ArrayList<>();

    // 통계
    @Column(name = "sales_count")
    @Builder.Default
    private int salesCount = 0;

    @Column(name = "view_count")
    @Builder.Default
    private int viewCount = 0;

    // 성적 인증
    @Column(name = "grade_image", length = 1000)
    private String gradeImage;

    @Column(name = "grade_claim", length = 10)
    private String gradeClaim;

    @Column(name = "grade_status", length = 20)
    private String gradeStatus; // pending | verified | rejected

    @Column(name = "verified_grade", length = 10)
    private String verifiedGrade;

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
