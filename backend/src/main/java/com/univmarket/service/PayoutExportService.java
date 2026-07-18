package com.univmarket.service;

import com.univmarket.entity.SellerPayoutProfile;
import com.univmarket.entity.Transaction;
import com.univmarket.repository.SellerPayoutProfileRepository;
import com.univmarket.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.Charset;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 관리자 지급파일 내보내기 (이니시스 지급대행 일괄 업로드용).
 *
 * 대상 = status=pending 인 출금(Transaction, type=withdraw) 전부.
 * 지급액 = Transaction.received. 계좌번호는 지급 프로필의 암호문을 복호화해 사용(WithdrawSecret 아님).
 * 지급파일은 EUC-KR 인코딩, 파이프(|) 구분.
 *
 * 보안: 이 클래스는 계좌 원본을 로그로 남기지 않는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PayoutExportService {

    private final TransactionRepository transactionRepository;
    private final SellerPayoutProfileRepository profileRepository;
    private final EncryptionService encryptionService;

    private static final Charset EUC_KR = Charset.forName("EUC-KR");
    private static final DateTimeFormatter YMD = DateTimeFormatter.ofPattern("yyyyMMdd");

    /**
     * 지급 대상 미리보기. { included: [...], excluded: [...] }
     * 계좌번호는 복호화하지 않는다(미리보기에 불필요).
     */
    @Transactional(readOnly = true)
    public Map<String, Object> preview(LocalDate payDate) {
        List<Transaction> pending = transactionRepository
                .findByTypeAndStatusOrderByCreatedAtDesc("withdraw", "pending");

        List<Map<String, Object>> included = new ArrayList<>();
        List<Map<String, Object>> excluded = new ArrayList<>();

        for (Transaction tx : pending) {
            Long userId = tx.getUser().getId();
            Optional<SellerPayoutProfile> profileOpt = profileRepository.findByUserId(userId);
            String reason = exclusionReason(tx, profileOpt);
            if (reason != null) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("transactionId", tx.getId());
                row.put("reason", reason);
                excluded.add(row);
                continue;
            }
            SellerPayoutProfile profile = profileOpt.orElseThrow();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("transactionId", tx.getId());
            row.put("userId", userId);
            row.put("submallId", profile.getSubmallId());
            row.put("amount", tx.getReceived());
            row.put("accountHolder", profile.getAccountHolder());
            included.add(row);
        }

        log.info("지급파일 미리보기 payDate={} 포함={}건 제외={}건", payDate, included.size(), excluded.size());
        return Map.of("included", included, "excluded", excluded);
    }

    /**
     * 포함 대상만으로 지급데이터 txt를 생성해 EUC-KR bytes로 반환.
     * 라인 포맷: 지급일|판매자ID|사업자번호|생년월일|지급액|예금주|은행코드|계좌번호
     */
    @Transactional(readOnly = true)
    public byte[] buildPayoutFile(LocalDate payDate) {
        List<Transaction> pending = transactionRepository
                .findByTypeAndStatusOrderByCreatedAtDesc("withdraw", "pending");

        String payDateStr = payDate.format(YMD);
        StringBuilder sb = new StringBuilder();
        int includedCount = 0;

        for (Transaction tx : pending) {
            Long userId = tx.getUser().getId();
            Optional<SellerPayoutProfile> profileOpt = profileRepository.findByUserId(userId);
            if (exclusionReason(tx, profileOpt) != null) {
                continue;
            }
            SellerPayoutProfile profile = profileOpt.orElseThrow();

            String businessNo = profile.getBusinessNo() != null ? profile.getBusinessNo() : "";
            String birth = profile.getBirthDate().format(YMD);
            String amount = tx.getReceived().toBigInteger().toString();
            String accountNumber = encryptionService.decrypt(profile.getAccountNumberEnc());

            sb.append(payDateStr).append('|')
              .append(profile.getSubmallId()).append('|')
              .append(businessNo).append('|')
              .append(birth).append('|')
              .append(amount).append('|')
              .append(profile.getAccountHolder()).append('|')
              .append(profile.getBankCode()).append('|')
              .append(accountNumber)
              .append("\r\n");
            includedCount++;
        }

        log.info("지급파일 생성 payDate={} 포함={}건", payDate, includedCount);
        return sb.toString().getBytes(EUC_KR);
    }

    /**
     * 제외 사유. 지급 가능하면 null.
     * 제외: 프로필 없음 / 프로필 미등록(REGISTERED 아님) / 은행코드 미확정 / 지급액 없음 /
     *       예금주 EUC-KR 인코딩 불가.
     */
    private String exclusionReason(Transaction tx, Optional<SellerPayoutProfile> profileOpt) {
        if (profileOpt.isEmpty()) {
            return "지급 프로필 없음";
        }
        SellerPayoutProfile p = profileOpt.get();
        if (!"REGISTERED".equals(p.getStatus())) {
            return "프로필 미등록 (현재 " + p.getStatus() + ")";
        }
        if (p.getBankCode() == null) {
            return "은행코드 미확정 (" + p.getBankName() + ")";
        }
        if (p.getBirthDate() == null) {
            return "생년월일 없음";
        }
        if (tx.getReceived() == null || tx.getReceived().compareTo(BigDecimal.ZERO) <= 0) {
            return "지급액 없음";
        }
        if (!EUC_KR.newEncoder().canEncode(p.getAccountHolder())) {
            return "예금주 EUC-KR 인코딩 불가";
        }
        return null;
    }
}
