package com.univmarket.service;

import com.univmarket.entity.SellerPayoutProfile;
import com.univmarket.entity.User;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.SellerPayoutProfileRepository;
import com.univmarket.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 셀러 지급 프로필(이니시스 서브몰) 등록/조회. 원본 계좌번호는 절대 외부로 노출하지 않는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PayoutProfileService {

    private final SellerPayoutProfileRepository profileRepository;
    private final UserRepository userRepository;
    private final EncryptionService encryptionService;

    /** 본인 프로필 (마스킹 뷰). 없으면 null. */
    @Transactional(readOnly = true)
    public Map<String, Object> getMyProfile(String firebaseUid) {
        User user = requireUser(firebaseUid);
        return profileRepository.findByUserId(user.getId())
                .map(this::maskedView)
                .orElse(null);
    }

    /** 은행 선택 목록 [{name, codeConfirmed}]. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> listBanks() {
        return InicisBankCodes.bankList();
    }

    /**
     * 지급 프로필 upsert. 계좌/전화 숫자만, 생년월일 과거, 사업자번호 형식, 은행명 유효성 검증.
     * 저장 시 계좌번호 암호화+마스킹, bankCode 자동 매핑(null 허용), status는 DRAFT로 리셋(재등록 필요).
     * submallId는 최초 1회만 생성.
     */
    @Transactional
    public Map<String, Object> upsertProfile(String firebaseUid, Map<String, Object> body) {
        User user = requireUser(firebaseUid);

        String displayName = str(body.get("displayName"));
        String businessNoRaw = str(body.get("businessNo"));
        String birthDateRaw = str(body.get("birthDate"));
        String phoneRaw = str(body.get("phone"));
        String email = str(body.get("email"));
        String accountHolder = str(body.get("accountHolder"));
        String bankName = str(body.get("bankName"));
        String accountNumberRaw = str(body.get("accountNumber"));

        if (isBlank(displayName)) throw ApiException.badRequest("상호(성명)를 입력해주세요.");
        if (isBlank(accountHolder)) throw ApiException.badRequest("예금주를 입력해주세요.");
        if (isBlank(email)) throw ApiException.badRequest("이메일을 입력해주세요.");
        if (!email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw ApiException.badRequest("이메일 형식이 올바르지 않습니다.");
        }

        String phone = digitsOnly(phoneRaw);
        if (phone.length() < 9 || phone.length() > 11) {
            throw ApiException.badRequest("휴대폰 번호를 숫자만 정확히 입력해주세요.");
        }

        String accountNumber = digitsOnly(accountNumberRaw);
        if (accountNumber.length() < 6 || accountNumber.length() > 20) {
            throw ApiException.badRequest("계좌번호를 숫자만 정확히 입력해주세요.");
        }

        // 사업자번호: 없으면 null(공란). 있으면 숫자 10자리.
        String businessNo = null;
        if (!isBlank(businessNoRaw)) {
            businessNo = digitsOnly(businessNoRaw);
            if (businessNo.length() != 10) {
                throw ApiException.badRequest("사업자번호는 숫자 10자리여야 합니다.");
            }
        }

        LocalDate birthDate = parseBirthDate(birthDateRaw);
        if (!birthDate.isBefore(LocalDate.now())) {
            throw ApiException.badRequest("생년월일은 과거 날짜여야 합니다.");
        }

        if (!InicisBankCodes.isKnownBank(bankName)) {
            throw ApiException.badRequest("지원하지 않는 은행입니다. 은행 목록에서 선택해주세요.");
        }

        SellerPayoutProfile profile = profileRepository.findByUserId(user.getId())
                .orElseGet(() -> SellerPayoutProfile.builder()
                        .userId(user.getId())
                        .submallId(generateSubmallId(user.getId()))
                        .build());

        profile.setDisplayName(displayName);
        profile.setBusinessNo(businessNo);
        profile.setBirthDate(birthDate);
        profile.setPhone(phone);
        profile.setEmail(email);
        profile.setAccountHolder(accountHolder);
        profile.setBankName(bankName);
        profile.setBankCode(InicisBankCodes.codeFor(bankName)); // null 허용
        profile.setAccountNumberEnc(encryptionService.encrypt(accountNumber));
        profile.setAccountNumberMasked(maskAccountNumber(accountNumber));
        // 정보 변경 시 재등록 필요 → DRAFT로 리셋
        profile.setStatus("DRAFT");

        profile = profileRepository.save(profile);
        return maskedView(profile);
    }

    // ─── 관리자 ───

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listProfilesForAdmin() {
        return profileRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::maskedView)
                .toList();
    }

    private static final List<String> ADMIN_ALLOWED_STATUS = List.of("REGISTERED", "FAILED", "DRAFT");

    @Transactional
    public Map<String, Object> setStatusByAdmin(Long profileId, String status) {
        if (status == null || !ADMIN_ALLOWED_STATUS.contains(status)) {
            throw ApiException.badRequest("status는 REGISTERED / FAILED / DRAFT 중 하나여야 합니다.");
        }
        SellerPayoutProfile profile = profileRepository.findById(profileId)
                .orElseThrow(() -> ApiException.notFound("지급 프로필을 찾을 수 없습니다."));
        profile.setStatus(status);
        return maskedView(profileRepository.save(profile));
    }

    // ─── 내부 유틸 ───

    private User requireUser(String firebaseUid) {
        return userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));
    }

    /** 결정적 판매자ID. "uf" + users.id (영숫자, 60byte 이하). */
    static String generateSubmallId(Long userId) {
        return "uf" + userId;
    }

    /** 계좌/암호문은 절대 포함하지 않는 마스킹 뷰. */
    private Map<String, Object> maskedView(SellerPayoutProfile p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.getId());
        m.put("userId", p.getUserId());
        m.put("submallId", p.getSubmallId());
        m.put("displayName", p.getDisplayName());
        m.put("businessNo", p.getBusinessNo());
        m.put("birthDate", p.getBirthDate() != null ? p.getBirthDate().toString() : null);
        m.put("phone", p.getPhone());
        m.put("email", p.getEmail());
        m.put("accountHolder", p.getAccountHolder());
        m.put("bankName", p.getBankName());
        m.put("bankCodeConfirmed", p.getBankCode() != null);
        m.put("accountNumberMasked", p.getAccountNumberMasked());
        m.put("status", p.getStatus());
        m.put("kycStatus", p.getKycStatus());
        m.put("createdAt", p.getCreatedAt() != null ? p.getCreatedAt().toString() : null);
        m.put("updatedAt", p.getUpdatedAt() != null ? p.getUpdatedAt().toString() : null);
        return m;
    }

    private LocalDate parseBirthDate(String raw) {
        if (isBlank(raw)) throw ApiException.badRequest("생년월일을 입력해주세요.");
        try {
            return LocalDate.parse(raw.trim(), DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (DateTimeParseException e) {
            throw ApiException.badRequest("생년월일 형식이 올바르지 않습니다. (yyyy-MM-dd)");
        }
    }

    private String maskAccountNumber(String accountNumber) {
        if (accountNumber == null || accountNumber.length() < 4) return "****";
        return "****" + accountNumber.substring(accountNumber.length() - 4);
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private static String digitsOnly(String s) {
        return s == null ? "" : s.replaceAll("\\D", "");
    }
}
