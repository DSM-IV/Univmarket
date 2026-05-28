package com.univmarket.service;

import com.univmarket.entity.Checkout;
import com.univmarket.entity.Material;
import com.univmarket.entity.PaymentSession;
import com.univmarket.entity.Transaction;
import com.univmarket.entity.User;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.CheckoutRepository;
import com.univmarket.repository.MaterialRepository;
import com.univmarket.repository.PaymentSessionRepository;
import com.univmarket.repository.PurchaseRepository;
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
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
public class PaymentService {

    private final UserRepository userRepository;
    private final PaymentSessionRepository paymentSessionRepository;
    private final TransactionRepository transactionRepository;
    private final CheckoutRepository checkoutRepository;
    private final MaterialRepository materialRepository;
    private final PurchaseRepository purchaseRepository;
    private final PurchaseService purchaseService;

    private final String kakaopayCid;
    private final String kakaopaySecretKey;
    private final String tossSecretKey;

    private final WebClient kakaoClient;
    private final WebClient tossClient;

    public PaymentService(
            UserRepository userRepository,
            PaymentSessionRepository paymentSessionRepository,
            TransactionRepository transactionRepository,
            CheckoutRepository checkoutRepository,
            MaterialRepository materialRepository,
            PurchaseRepository purchaseRepository,
            PurchaseService purchaseService,
            @Value("${payment.kakaopay.cid:}") String kakaopayCid,
            @Value("${payment.kakaopay.secret-key:}") String kakaopaySecretKey,
            @Value("${payment.toss.secret-key:}") String tossSecretKey) {
        this.userRepository = userRepository;
        this.paymentSessionRepository = paymentSessionRepository;
        this.transactionRepository = transactionRepository;
        this.checkoutRepository = checkoutRepository;
        this.materialRepository = materialRepository;
        this.purchaseRepository = purchaseRepository;
        this.purchaseService = purchaseService;
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

    /**
     * 자료 직접결제 세션 생성 (Toss).
     * 자료들의 합산 금액과 orderId를 발급. 프론트는 이걸로 Toss 결제창을 띄움.
     */
    @Transactional
    public Map<String, Object> createCheckoutSession(String firebaseUid, List<Long> materialIds) {
        requireTossConfigured();

        if (materialIds == null || materialIds.isEmpty()) {
            throw ApiException.badRequest("결제할 자료를 선택해주세요.");
        }
        if (materialIds.size() > 50) {
            throw ApiException.badRequest("한 번에 최대 50개까지 결제 가능합니다.");
        }

        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));

        List<Material> materials = materialRepository.findAllById(materialIds);
        if (materials.size() != materialIds.size()) {
            throw ApiException.badRequest("일부 자료를 찾을 수 없습니다.");
        }

        for (Material m : materials) {
            if (m.getAuthor().getId().equals(user.getId())) {
                throw ApiException.badRequest("본인의 자료는 구매할 수 없습니다.");
            }
            if (m.isHidden() || m.isCopyrightDeleted()) {
                throw ApiException.badRequest("\"" + m.getTitle() + "\"는 구매할 수 없는 자료입니다.");
            }
            if (purchaseRepository.existsByBuyerIdAndMaterialId(user.getId(), m.getId())) {
                throw ApiException.badRequest("\"" + m.getTitle() + "\"는 이미 구매한 자료입니다.");
            }
        }

        long total = materials.stream().mapToLong(Material::getPrice).sum();
        if (total < 100) {
            throw ApiException.badRequest("결제 최소 금액은 100원입니다.");
        }

        String orderId = "checkout_" + UUID.randomUUID().toString().replace("-", "").substring(0, 24);
        String materialIdsStr = materialIds.stream()
                .map(String::valueOf)
                .collect(Collectors.joining(","));
        String orderName = materials.size() == 1
                ? materials.get(0).getTitle()
                : materials.get(0).getTitle() + " 외 " + (materials.size() - 1) + "건";

        checkoutRepository.save(Checkout.builder()
                .user(user)
                .orderId(orderId)
                .materialIds(materialIdsStr)
                .amount(BigDecimal.valueOf(total))
                .status("pending")
                .build());

        return Map.of(
                "orderId", orderId,
                "amount", total,
                "orderName", orderName
        );
    }

    /**
     * 결제 확정. Toss /v1/payments/confirm 호출 후 각 자료 지급.
     * 중복 호출 방지를 위해 status=completed면 idempotent 응답.
     */
    @Transactional
    public Map<String, Object> confirmCheckout(String firebaseUid, String paymentKey, String orderId, long amount) {
        requireTossConfigured();

        Checkout checkout = checkoutRepository.findByOrderId(orderId)
                .orElseThrow(() -> ApiException.notFound("결제 정보를 찾을 수 없습니다."));

        if (!checkout.getUser().getFirebaseUid().equals(firebaseUid)) {
            throw ApiException.forbidden("본인의 결제만 확정할 수 있습니다.");
        }

        if ("completed".equals(checkout.getStatus())) {
            return Map.of(
                    "success", true,
                    "orderId", orderId,
                    "materialIds", parseMaterialIds(checkout.getMaterialIds())
            );
        }
        if (!"pending".equals(checkout.getStatus())) {
            throw ApiException.badRequest("이미 처리된 결제입니다.");
        }
        if (checkout.getAmount().longValue() != amount) {
            throw ApiException.badRequest("결제 금액이 일치하지 않습니다.");
        }

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
            log.error("Toss 결제 승인 실패 (orderId={}): {}", orderId, e.getMessage());
            checkout.setStatus("failed");
            checkoutRepository.save(checkout);
            throw new ApiException(HttpStatus.BAD_GATEWAY, "결제 승인에 실패했습니다.");
        }

        checkout.setStatus("completed");
        checkout.setPaymentKey(paymentKey);
        checkout.setCompletedAt(LocalDateTime.now());
        checkoutRepository.save(checkout);

        List<Long> materialIds = parseMaterialIds(checkout.getMaterialIds());
        for (Long materialId : materialIds) {
            purchaseService.recordPurchase(firebaseUid, materialId, paymentKey, amount);
        }

        return Map.of(
                "success", true,
                "orderId", orderId,
                "materialIds", materialIds
        );
    }

    private List<Long> parseMaterialIds(String ids) {
        return Arrays.stream(ids.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(Long::parseLong)
                .toList();
    }

    /**
     * Toss 결제 부분/전액 취소. 한 paymentKey 에 대해 여러 번 부분취소 가능 (Toss가 잔액 추적).
     */
    public void cancelTossPayment(String paymentKey, long cancelAmount, String reason) {
        requireTossConfigured();
        if (paymentKey == null || paymentKey.isBlank()) {
            throw ApiException.badRequest("결제 키가 없어 환불할 수 없습니다.");
        }
        if (cancelAmount <= 0) {
            throw ApiException.badRequest("환불 금액이 올바르지 않습니다.");
        }

        String authHeader = Base64.getEncoder().encodeToString(
                (tossSecretKey + ":").getBytes(StandardCharsets.UTF_8));
        try {
            tossClient.post()
                    .uri("/v1/payments/" + paymentKey + "/cancel")
                    .header("Authorization", "Basic " + authHeader)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(Map.of(
                            "cancelReason", reason == null || reason.isBlank() ? "구매자 요청 환불" : reason,
                            "cancelAmount", cancelAmount
                    ))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block(Duration.ofSeconds(10));
        } catch (Exception e) {
            log.error("Toss 환불 실패 (paymentKey={}, amount={}): {}", paymentKey, cancelAmount, e.getMessage());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "환불 처리에 실패했습니다.");
        }
    }
}
