package com.univmarket.service;

import com.univmarket.entity.PaymentSession;
import com.univmarket.entity.Transaction;
import com.univmarket.entity.User;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.PaymentSessionRepository;
import com.univmarket.repository.TransactionRepository;
import com.univmarket.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final UserRepository userRepository;
    private final PaymentSessionRepository paymentSessionRepository;
    private final TransactionRepository transactionRepository;

    /**
     * 카카오페이 결제 준비
     */
    @Transactional
    public Map<String, Object> createKakaoPaySession(String firebaseUid, int amount) {
        if (amount < 1000 || amount > 500000) {
            throw ApiException.badRequest("충전 금액은 1,000원 ~ 500,000원 사이여야 합니다.");
        }

        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));

        PaymentSession session = paymentSessionRepository.save(PaymentSession.builder()
                .user(user)
                .type("kakaopay")
                .amount(BigDecimal.valueOf(amount))
                .pointAmount(BigDecimal.valueOf(amount))
                .status("pending")
                .build());

        // TODO: 실제 카카오페이 API 호출하여 TID와 redirect URL 획득
        // 여기서는 세션 ID만 반환 (실제 구현 시 카카오페이 REST API 연동 필요)
        return Map.of(
                "sessionId", session.getId(),
                "amount", amount
        );
    }

    /**
     * 카카오페이 결제 승인 (콜백)
     */
    @Transactional
    public Map<String, Object> approveKakaoPay(String pgToken, String tid) {
        PaymentSession session = paymentSessionRepository.findByExternalId(tid)
                .orElseThrow(() -> ApiException.notFound("결제 세션을 찾을 수 없습니다."));

        if (!"pending".equals(session.getStatus())) {
            throw ApiException.badRequest("이미 처리된 결제입니다.");
        }

        // TODO: 실제 카카오페이 승인 API 호출

        session.setStatus("completed");
        paymentSessionRepository.save(session);

        // 포인트 충전
        User user = session.getUser();
        userRepository.addPoints(user.getId(), session.getPointAmount());

        user = userRepository.findById(user.getId()).orElseThrow();

        transactionRepository.save(Transaction.builder()
                .user(user)
                .type("charge")
                .amount(session.getPointAmount())
                .balanceAfter(user.getPoints())
                .balanceType("points")
                .description("카카오페이 충전")
                .kakaopayTid(tid)
                .status("completed")
                .build());

        return Map.of("success", true, "points", user.getPoints());
    }

    /**
     * 토스 결제 준비
     */
    @Transactional
    public Map<String, Object> createTossSession(String firebaseUid, int amount) {
        if (amount < 1000 || amount > 500000) {
            throw ApiException.badRequest("충전 금액은 1,000원 ~ 500,000원 사이여야 합니다.");
        }

        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));

        PaymentSession session = paymentSessionRepository.save(PaymentSession.builder()
                .user(user)
                .type("toss")
                .amount(BigDecimal.valueOf(amount))
                .pointAmount(BigDecimal.valueOf(amount))
                .status("pending")
                .build());

        // TODO: 실제 토스 결제 API 호출
        return Map.of(
                "sessionId", session.getId(),
                "amount", amount
        );
    }

    /**
     * 토스 결제 승인
     */
    @Transactional
    public Map<String, Object> approveToss(String firebaseUid, String paymentKey, String orderId, int amount) {
        PaymentSession session = paymentSessionRepository.findByExternalId(orderId)
                .orElseThrow(() -> ApiException.notFound("결제 세션을 찾을 수 없습니다."));

        if (!"pending".equals(session.getStatus())) {
            throw ApiException.badRequest("이미 처리된 결제입니다.");
        }

        // TODO: 실제 토스 승인 API 호출

        session.setStatus("completed");
        session.setExternalId(paymentKey);
        paymentSessionRepository.save(session);

        User user = session.getUser();
        userRepository.addPoints(user.getId(), session.getPointAmount());

        user = userRepository.findById(user.getId()).orElseThrow();

        transactionRepository.save(Transaction.builder()
                .user(user)
                .type("charge")
                .amount(session.getPointAmount())
                .balanceAfter(user.getPoints())
                .balanceType("points")
                .description("토스 충전")
                .tossPaymentKey(paymentKey)
                .tossPaymentAmount(BigDecimal.valueOf(amount))
                .status("completed")
                .build());

        return Map.of("success", true, "points", user.getPoints());
    }
}
