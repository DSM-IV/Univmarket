package com.univmarket.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 이니시스 지급대행 "서브몰"(판매자) 등록 정보.
 * 정산이 확정된 실수령액을 판매자 계좌로 송금하기 위한 지급 프로필.
 *
 * 원본 계좌번호는 {@code accountNumberEnc}에 AES-GCM 암호화(EncryptionService)하여 저장하고,
 * 화면 표시용 마스킹은 {@code accountNumberMasked}에 별도 보관한다.
 * (transactions/withdraw_secrets 와 동일한 관례)
 */
@Entity
@Table(name = "seller_payout_profiles")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class SellerPayoutProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // User 식별 타입은 WithdrawSecret.userId 와 동일한 Long (users.id).
    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    // 판매자ID(이니시스 서브몰 식별자). 최초 1회 생성 후 불변. 규칙: "uf" + users.id
    @Column(name = "submall_id", nullable = false, unique = true, updatable = false, length = 60)
    private String submallId;

    // 상호 — 개인 셀러는 성명
    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    // 사업자번호 — 개인 셀러는 null(공란 전송). 숫자 10자리
    @Column(name = "business_no", length = 10)
    private String businessNo;

    // 생년월일 — 계좌 실명조회·KYC 기준값
    @Column(name = "birth_date", nullable = false)
    private LocalDate birthDate;

    @Column(nullable = false, length = 20)
    private String phone;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(name = "account_holder", nullable = false, length = 50)
    private String accountHolder;

    @Column(name = "bank_name", nullable = false, length = 30)
    private String bankName;

    // 이니시스 지급대행 2자리 은행코드. 미확정 은행은 null 허용(지급 대상에서 제외됨).
    @Column(name = "bank_code", length = 2)
    private String bankCode;

    // AES-GCM 암호문 (원본 계좌번호)
    @Column(name = "account_number_enc", nullable = false, length = 100)
    private String accountNumberEnc;

    // 표시용 마스킹 계좌번호 (예: ****1234)
    @Column(name = "account_number_masked", nullable = false, length = 30)
    private String accountNumberMasked;

    // DRAFT → REGISTERED(관리자가 이니시스 가맹점관리자에서 실제 등록 후 수동 마킹) / FAILED
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "DRAFT";

    // NONE / REQUIRED / DONE
    @Column(name = "kyc_status", nullable = false, length = 20)
    @Builder.Default
    private String kycStatus = "NONE";

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
