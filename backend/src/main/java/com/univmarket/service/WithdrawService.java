package com.univmarket.service;

import com.univmarket.entity.Transaction;
import com.univmarket.entity.User;
import com.univmarket.entity.WithdrawSecret;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.TransactionRepository;
import com.univmarket.repository.UserRepository;
import com.univmarket.repository.WithdrawSecretRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class WithdrawService {

    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final WithdrawSecretRepository withdrawSecretRepository;

    private static final BigDecimal COMMISSION_RATE = new BigDecimal("0.10"); // 플랫폼 수수료 10% (정상 40%에서 오픈 기념 할인)
    private static final BigDecimal TAX_RATE = new BigDecimal("0.088");       // 세금 8.8% (사업소득 원천징수)
    private static final BigDecimal TAX_THRESHOLD = BigDecimal.valueOf(125000); // 이 금액 초과 시 세금 부과
    private static final BigDecimal WITHDRAW_FEE = BigDecimal.valueOf(500);    // 출금처리수수료
    private static final BigDecimal MIN_WITHDRAW = BigDecimal.valueOf(5000);
    private static final BigDecimal MAX_WITHDRAW = BigDecimal.valueOf(5000000);

    /**
     * 출금 요청
     */
    @Transactional
    public Map<String, Object> requestWithdraw(String firebaseUid, int amount,
                                                String bankName, String accountNumber, String accountHolder) {
        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));

        // 본인인증 체크 — 베타 테스트 중 임시 비활성화
        // TODO: 본인인증 UI + SMS(ALIGO) 키 준비 후 다시 켜기
        // if (!user.isIdentityVerified()) {
        //     throw ApiException.badRequest("본인인증이 필요합니다.");
        // }

        BigDecimal amountBd = BigDecimal.valueOf(amount);
        if (amountBd.compareTo(MIN_WITHDRAW) < 0 || amountBd.compareTo(MAX_WITHDRAW) > 0) {
            throw ApiException.badRequest(
                    "출금 금액은 " + MIN_WITHDRAW + "원~" + MAX_WITHDRAW + "원이어야 합니다.");
        }
        if (amountBd.compareTo(user.getEarnings()) > 0) {
            throw ApiException.badRequest("수익금이 부족합니다.");
        }

        // 수수료·세금 계산 (프론트 calcWithdrawDetails 와 동일)
        // 신청 금액 = 수익금에서 차감되는 금액. 실수령 = 신청 금액 - 수수료 - 세금 - 출금처리수수료
        BigDecimal commission = amountBd.multiply(COMMISSION_RATE).setScale(0, RoundingMode.CEILING);
        BigDecimal tax = amountBd.compareTo(TAX_THRESHOLD) > 0
                ? amountBd.multiply(TAX_RATE).setScale(0, RoundingMode.CEILING)
                : BigDecimal.ZERO;
        BigDecimal fee = WITHDRAW_FEE;
        BigDecimal totalDeduction = amountBd; // 수익금에서 차감되는 금액
        BigDecimal received = amountBd.subtract(commission).subtract(tax).subtract(fee);
        if (received.signum() <= 0) {
            throw ApiException.badRequest(
                    "수수료·세금을 빼면 실수령액이 남지 않습니다. 더 큰 금액으로 신청해주세요.");
        }

        // 수익금 차감
        int updated = userRepository.deductEarnings(user.getId(), amountBd);
        if (updated == 0) {
            throw ApiException.badRequest("수익금이 부족합니다. (동시 처리 충돌)");
        }

        user = userRepository.findById(user.getId()).orElseThrow();

        // 마스킹된 계좌번호
        String maskedAccount = maskAccountNumber(accountNumber);

        // 트랜잭션 생성
        Transaction tx = transactionRepository.save(Transaction.builder()
                .user(user)
                .type("withdraw")
                .amount(amountBd.negate())
                .balanceAfter(user.getEarnings())
                .balanceType("earnings")
                .description("출금 요청")
                .fee(fee)
                .commission(commission)
                .tax(tax)
                .totalDeduction(totalDeduction)
                .received(received)
                .bankName(bankName)
                .accountNumber(maskedAccount)
                .accountHolder(accountHolder)
                .status("pending")
                .build());

        // 원본 계좌번호 별도 저장
        withdrawSecretRepository.save(WithdrawSecret.builder()
                .transaction(tx)
                .userId(user.getId())
                .bankName(bankName)
                .accountNumber(accountNumber) // 실 운영에서는 AES 암호화
                .accountHolder(accountHolder)
                .build());

        return Map.of(
                "success", true,
                "transactionId", tx.getId(),
                "amount", amount,
                "commission", commission,
                "tax", tax,
                "fee", fee,
                "totalDeduction", totalDeduction,
                "received", received,
                "balanceAfter", user.getEarnings()
        );
    }

    private String maskAccountNumber(String accountNumber) {
        if (accountNumber == null || accountNumber.length() < 4) return "****";
        return "****" + accountNumber.substring(accountNumber.length() - 4);
    }
}
