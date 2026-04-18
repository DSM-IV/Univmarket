package com.univmarket.service;

import com.univmarket.entity.ChargeRequest;
import com.univmarket.entity.User;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.ChargeRequestRepository;
import com.univmarket.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class ChargeRequestService {

    private final ChargeRequestRepository chargeRequestRepository;
    private final UserRepository userRepository;

    private static final BigDecimal MIN_AMOUNT = BigDecimal.valueOf(1000);
    private static final BigDecimal MAX_AMOUNT = BigDecimal.valueOf(500_000);
    private static final Pattern PHONE_PATTERN = Pattern.compile("^[0-9\\-]{9,15}$");

    @Transactional
    public ChargeRequest submit(String firebaseUid,
                                BigDecimal amount,
                                String senderName,
                                String senderPhone,
                                String receiptNumber,
                                String receiptType) {
        if (amount == null || amount.compareTo(MIN_AMOUNT) < 0) {
            throw ApiException.badRequest("최소 충전 금액은 1,000P 입니다.");
        }
        if (amount.compareTo(MAX_AMOUNT) > 0) {
            throw ApiException.badRequest("최대 충전 금액은 500,000P 입니다.");
        }
        if (senderName == null || senderName.isBlank()) {
            throw ApiException.badRequest("입금자명을 입력해 주세요.");
        }
        if (senderPhone == null || !PHONE_PATTERN.matcher(senderPhone).matches()) {
            throw ApiException.badRequest("입금자 연락처 형식이 올바르지 않습니다.");
        }

        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자 정보를 찾을 수 없습니다."));

        // 서버에서 VAT/송금액 재계산 (위변조 방지)
        BigDecimal vat = amount.divide(BigDecimal.TEN, 0, RoundingMode.CEILING);
        BigDecimal transferAmount = amount.add(vat);

        return chargeRequestRepository.save(ChargeRequest.builder()
                .user(user)
                .email(user.getEmail() != null ? user.getEmail() : "")
                .amount(amount)
                .transferAmount(transferAmount)
                .vat(vat)
                .senderName(senderName.trim())
                .senderPhone(senderPhone.trim())
                .receiptNumber(receiptNumber != null ? receiptNumber.trim() : "")
                .receiptType(receiptType != null ? receiptType.trim() : "")
                .status("pending")
                .build());
    }

    @Transactional(readOnly = true)
    public List<ChargeRequest> listMine(String firebaseUid, int limit) {
        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자 정보를 찾을 수 없습니다."));
        int safeLimit = Math.max(1, Math.min(limit, 50));
        return chargeRequestRepository
                .findByUserIdOrderByCreatedAtDesc(user.getId(),
                        PageRequest.of(0, safeLimit, Sort.by(Sort.Direction.DESC, "createdAt")))
                .getContent();
    }
}
