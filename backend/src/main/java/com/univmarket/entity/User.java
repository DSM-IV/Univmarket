package com.univmarket.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "firebase_uid", unique = true, nullable = false, length = 128)
    private String firebaseUid;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(name = "display_name", length = 100)
    private String displayName;

    @Column(unique = true, length = 16)
    private String nickname;

    @Column(length = 50)
    private String university;

    @Column(nullable = false, precision = 12, scale = 0)
    @Builder.Default
    private BigDecimal points = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 0)
    @Builder.Default
    private BigDecimal earnings = BigDecimal.ZERO;

    @Column(name = "pending_earnings", nullable = false, precision = 12, scale = 0)
    @Builder.Default
    private BigDecimal pendingEarnings = BigDecimal.ZERO;

    @Column(name = "total_earned", nullable = false, precision = 12, scale = 0)
    @Builder.Default
    private BigDecimal totalEarned = BigDecimal.ZERO;

    @Column(name = "total_spent", nullable = false, precision = 12, scale = 0)
    @Builder.Default
    private BigDecimal totalSpent = BigDecimal.ZERO;

    @Column(length = 10)
    @Builder.Default
    private String role = "user"; // "user" | "admin"

    // 본인인증
    @Column(name = "identity_verified")
    @Builder.Default
    private boolean identityVerified = false;

    @Column(name = "identity_verified_at")
    private LocalDateTime identityVerifiedAt;

    @Column(name = "verified_name", length = 50)
    private String verifiedName;

    @Column(name = "verified_phone", length = 20)
    private String verifiedPhone;

    @Column(name = "verified_birth", length = 6)
    private String verifiedBirth;

    // 제재
    @Builder.Default
    private boolean banned = false;

    @Column(name = "banned_at")
    private LocalDateTime bannedAt;

    @Column(name = "ban_reason", length = 500)
    private String banReason;

    @Builder.Default
    private boolean suspended = false;

    @Column(name = "suspended_until")
    private LocalDateTime suspendedUntil;

    @Column(name = "suspend_reason", length = 500)
    private String suspendReason;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
