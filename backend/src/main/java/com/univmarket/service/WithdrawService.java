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

    private static final BigDecimal COMMISSION_RATE = new BigDecimal("0.033"); // 3.3%
    private static final BigDecimal MIN_WITHDRAW = BigDecimal.valueOf(5000);

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
        if (amountBd.compareTo(MIN_WITHDRAW) < 0) {
            throw ApiException.badRequest("최소 출금 금액은 " + MIN_WITHDRAW + "원입니다.");
        }
        if (amountBd.compareTo(user.getEarnings()) > 0) {
            throw ApiException.badRequest("수익금이 부족합니다.");
        }

        // 수수료 계산
        BigDecimal commission = amountBd.multiply(COMMISSION_RATE).setScale(0, RoundingMode.FLOOR);
        BigDecimal tax = commission.multiply(new BigDecimal("0.1")).setScale(0, RoundingMode.FLOOR);
        BigDecimal totalDeduction = commission.add(tax);
        BigDecimal received = amountBd.subtract(totalDeduction);

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
                .fee(BigDecimal.ZERO)
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
                "received", received
        );
    }

    private String maskAccountNumber(String accountNumber) {
        if (accountNumber == null || accountNumber.length() < 4) return "****";
        return "****" + accountNumber.substring(accountNumber.length() - 4);
    }
}
