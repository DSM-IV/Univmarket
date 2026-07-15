package com.univmarket.service;

import com.univmarket.entity.Checkout;
import com.univmarket.entity.Material;
import com.univmarket.entity.User;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.CheckoutRepository;
import com.univmarket.repository.MaterialRepository;
import com.univmarket.repository.PurchaseRepository;
import com.univmarket.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
public class PaymentService {

    private final UserRepository userRepository;
    private final CheckoutRepository checkoutRepository;
    private final MaterialRepository materialRepository;
    private final PurchaseRepository purchaseRepository;
    private final PurchaseService purchaseService;
    private final CheckoutTxService checkoutTxService;

    private final String tossSecretKey;
    private final WebClient tossClient;

    public PaymentService(
            UserRepository userRepository,
            CheckoutRepository checkoutRepository,
            MaterialRepository materialRepository,
            PurchaseRepository purchaseRepository,
            PurchaseService purchaseService,
            CheckoutTxService checkoutTxService,
            @Value("${payment.toss.secret-key:}") String tossSecretKey,
            @Value("${payment.toss.base-url:https://api.tosspayments.com}") String tossBaseUrl) {
        this.userRepository = userRepository;
        this.checkoutRepository = checkoutRepository;
        this.materialRepository = materialRepository;
        this.purchaseRepository = purchaseRepository;
        this.purchaseService = purchaseService;
        this.checkoutTxService = checkoutTxService;
        this.tossSecretKey = tossSecretKey;
        this.tossClient = WebClient.builder()
                .baseUrl(tossBaseUrl)
                .build();
    }

    private void requireTossConfigured() {
        if (tossSecretKey == null || tossSecretKey.isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "토스페이먼츠가 설정되지 않았습니다. 관리자에게 문의해 주세요.");
        }
    }

    /**
     * 자료 직접결제 세션 생성 (Toss).
     * 자료들의 합산 금액과 orderId를 발급. 프론트는 이걸로 Toss 결제창을 띄움.
     */
    @Transactional
    public Map<String, Object> createCheckoutSession(String firebaseUid, List<Long> materialIds) {
        requireTossConfigured();
        return createPendingCheckout(firebaseUid, materialIds);
    }

    /**
     * PG 무관 결제 세션 생성: 자료 검증 + Checkout(pending) 저장 후 {orderId, amount, orderName} 반환.
     * 어떤 PG 어댑터(Toss/이니시스)든 이 메서드로 oid·금액을 발급받는다 (PG 설정 체크 없음).
     */
    @Transactional
    public Map<String, Object> createPendingCheckout(String firebaseUid, List<Long> materialIds) {
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
     * 결제 확정 (오케스트레이터, 비트랜잭션).
     * "외부 비가역 호출(Toss 승인)"과 "DB 커밋"을 분리한다:
     *   1) beginConfirm  — 검증 + idempotency 판정 (읽기 전용 tx)
     *   2) Toss /confirm — tx 밖에서 호출. 성공 시 비가역 청구
     *   3) markCompleted — 완료 상태 즉시 커밋 (재호출이 절대 재청구되지 않게 하는 앵커)
     *   4) 자료 지급      — 자료별 독립 tx. 일부 실패해도 결제 확정/다른 자료는 보존
     * 이미 completed면 2·3을 건너뛰고 4만 수행해 부분/누락 지급을 자가복구한다.
     */
    public Map<String, Object> confirmCheckout(String firebaseUid, String paymentKey, String orderId, long amount) {
        requireTossConfigured();

        CheckoutTxService.ConfirmContext ctx = checkoutTxService.beginConfirm(firebaseUid, orderId, amount);

        if (!ctx.alreadyCompleted()) {
            callTossConfirm(paymentKey, orderId, amount);
            checkoutTxService.markCompleted(orderId, paymentKey);
        }

        String effectiveKey = ctx.paymentKey() != null ? ctx.paymentKey() : paymentKey;
        List<Long> granted = grantMaterials(firebaseUid, ctx.materialIds(), effectiveKey, amount, orderId);

        return Map.of(
                "success", true,
                "orderId", orderId,
                "materialIds", granted
        );
    }

    /**
     * Toss 결제 승인 호출 (트랜잭션 밖).
     * 이미 승인된 결제(ALREADY_PROCESSED_PAYMENT)는 이전 시도의 성공이므로 정상 처리한다.
     * 그 외 실패 시 checkout은 pending으로 남겨 재시도를 허용한다
     * (성공했을 수도 있는 청구를 failed로 단정하지 않음 — 재confirm이 ALREADY_PROCESSED로 자가복구).
     */
    private void callTossConfirm(String paymentKey, String orderId, long amount) {
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
        } catch (WebClientResponseException e) {
            if (isAlreadyProcessed(e)) {
                log.warn("Toss 이미 승인된 결제 — 재확인으로 정상 처리 (orderId={})", orderId);
                return;
            }
            log.error("Toss 결제 승인 실패 (orderId={}): {} {}", orderId, e.getStatusCode(), e.getResponseBodyAsString());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "결제 승인에 실패했습니다.");
        } catch (Exception e) {
            log.error("Toss 결제 승인 실패 (orderId={}): {}", orderId, e.getMessage());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "결제 승인에 실패했습니다.");
        }
    }

    private boolean isAlreadyProcessed(WebClientResponseException e) {
        String body = e.getResponseBodyAsString();
        return body != null && body.contains("ALREADY_PROCESSED_PAYMENT");
    }

    /**
     * 각 자료를 독립 트랜잭션으로 지급한다(recordPurchase 는 @Transactional).
     * 이미 지급된 자료(CONFLICT)는 멱등하게 성공 처리, 그 외 실패는 수집·로깅한다.
     * 결제는 이미 확정됐으므로 일부 지급 실패는 롤백 대상이 아니라 사후 복구(재confirm/CS) 대상이다.
     */
    public List<Long> grantMaterials(String firebaseUid, List<Long> materialIds, String paymentKey, long amount, String orderId) {
        List<Long> granted = new ArrayList<>();
        List<Long> failed = new ArrayList<>();
        for (Long materialId : materialIds) {
            try {
                purchaseService.recordPurchase(firebaseUid, materialId, paymentKey, amount);
                granted.add(materialId);
            } catch (ApiException e) {
                if (e.getStatus() == HttpStatus.CONFLICT) {
                    granted.add(materialId); // 이미 지급됨 — 멱등 처리
                } else {
                    log.error("[결제] 자료 지급 실패 (orderId={}, materialId={}): {}", orderId, materialId, e.getMessage());
                    failed.add(materialId);
                }
            } catch (Exception e) {
                log.error("[결제] 자료 지급 실패 (orderId={}, materialId={}): {}", orderId, materialId, e.getMessage());
                failed.add(materialId);
            }
        }
        if (!failed.isEmpty()) {
            log.error("[결제] 결제는 완료됐으나 일부 자료 미지급 — 수동 확인 필요 (orderId={}, paymentKey={}, 미지급={})",
                    orderId, paymentKey, failed);
        }
        return granted;
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
