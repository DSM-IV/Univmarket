package com.univmarket.service;

import com.univmarket.entity.PaymentSession;
import com.univmarket.entity.Transaction;
import com.univmarket.entity.User;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.PaymentSessionRepository;
import com.univmarket.repository.TransactionRepository;
import com.univmarket.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.Map;

@Slf4j
@Service
public class PaymentService {

    private final UserRepository userRepository;
    private final PaymentSessionRepository paymentSessionRepository;
    private final TransactionRepository transactionRepository;

    private final String kakaopayCid;
    private final String kakaopaySecretKey;
    private final String tossSecretKey;

    private final WebClient kakaoClient;
    private final WebClient tossClient;

    public PaymentService(
            UserRepository userRepository,
            PaymentSessionRepository paymentSessionRepository,
            TransactionRepository transactionRepository,
            @Value("${payment.kakaopay.cid:}") String kakaopayCid,
            @Value("${payment.kakaopay.secret-key:}") String kakaopaySecretKey,
            @Value("${payment.toss.secret-key:}") String tossSecretKey) {
        this.userRepository = userRepository;
        this.paymentSessionRepository = paymentSessionRepository;
        this.transactionRepository = transactionRepository;
        this.kakaopayCid = kakaopayCid;
        this.kakaopaySecretKey = kakaopaySecretKey;
        this.tossSecretKey = tossSecretKey;
        this.kakaoClient = WebClient.builder()
                .baseUrl("https://open-api.kakaopay.com")
                .build();
        this.tossClient = WebClient.builder()
                .baseUrl("https://api.tosspayments.com")
                .build();
    }

    private void requireKakaopayConfigured() {
        if (kakaopayCid == null || kakaopayCid.isBlank()
                || kakaopaySecretKey == null || kakaopaySecretKey.isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "카카오페이가 설정되지 않았습니다. 관리자에게 문의해 주세요.");
        }
    }

    private void requireTossConfigured() {
        if (tossSecretKey == null || tossSecretKey.isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "토스페이먼츠가 설정되지 않았습니다. 관리자에게 문의해 주세요.");
        }
    }

    /**
     * 카카오페이 결제 준비
     */
    @Transactional
    public Map<String, Object> createKakaoPaySession(String firebaseUid, int amount) {
        requireKakaopayConfigured();
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
        requireKakaopayConfigured();

        PaymentSession session = paymentSessionRepository.findByExternalId(tid)
                .orElseThrow(() -> ApiException.notFound("결제 세션을 찾을 수 없습니다."));

        if (!"pending".equals(session.getStatus())) {
            throw ApiException.badRequest("이미 처리된 결제입니다.");
        }

        // 실제 카카오페이 승인 호출 — 실패 시 예외
        try {
            kakaoClient.post()
                    .uri("/online/v1/payment/approve")
                    .header("Authorization", "SECRET_KEY " + kakaopaySecretKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(Map.of(
                            "cid", kakaopayCid,
                            "tid", tid,
                            "partner_order_id", String.valueOf(session.getId()),
                            "partner_user_id", session.getUser().getFirebaseUid(),
                            "pg_token", pgToken
                    ))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block(Duration.ofSeconds(10));
        } catch (Exception e) {
            log.error("KakaoPay 승인 실패 (sessionId={}): {}", session.getId(), e.getMessage());
            session.setStatus("failed");
            paymentSessionRepository.save(session);
            throw new ApiException(HttpStatus.BAD_GATEWAY, "카카오페이 승인에 실패했습니다.");
        }

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
        requireTossConfigured();
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
        requireTossConfigured();

        PaymentSession session = paymentSessionRepository.findByExternalId(orderId)
                .orElseThrow(() -> ApiException.notFound("결제 세션을 찾을 수 없습니다."));

        if (!"pending".equals(session.getStatus())) {
            throw ApiException.badRequest("이미 처리된 결제입니다.");
        }

        if (session.getAmount().intValue() != amount) {
            throw ApiException.badRequest("결제 금액이 일치하지 않습니다.");
        }

        // 실제 토스 승인 호출
        String authHeader = Base64.getEncoder().encodeToString(
                (tossSecretKey + ":").getBytes(StandardCharsets.UTF_8));
        try {
            tossClient.post()
                    .uri("/v1/payments/confirm")
                    .header("Authorization", "Basic " + authHeader)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(Map.of(
                            "paymentKey", paymentKey,
                            "orderId", orderId,
                            "amount", amount
                    ))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block(Duration.ofSeconds(10));
        } catch (Exception e) {
            log.error("Toss 승인 실패 (sessionId={}): {}", session.getId(), e.getMessage());
            session.setStatus("failed");
            paymentSessionRepository.save(session);
            throw new ApiException(HttpStatus.BAD_GATEWAY, "토스페이먼츠 승인에 실패했습니다.");
        }

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
