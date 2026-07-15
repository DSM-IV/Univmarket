package com.univmarket.service;

import com.univmarket.entity.Checkout;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.CheckoutRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

/**
 * 결제 확정 과정의 checkout 상태 전이를 담당하는 트랜잭션 단위.
 * PaymentService.confirmCheckout(비트랜잭션 오케스트레이터)이 외부 Toss 호출과 DB 커밋을
 * 분리할 수 있도록, 검증/완료표시를 각각 독립 트랜잭션으로 제공한다.
 * (PaymentService 자기호출로는 @Transactional 프록시가 동작하지 않으므로 별도 빈으로 분리.)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CheckoutTxService {

    private final CheckoutRepository checkoutRepository;

    /** confirm 진입 시 checkout 검증 결과. */
    public record ConfirmContext(boolean alreadyCompleted, List<Long> materialIds, String paymentKey) {}

    /**
     * checkout 로드 + 소유자/상태/금액 검증 (쓰기 없음).
     * 이미 completed면 alreadyCompleted=true로 반환(재호출 idempotent 경로).
     */
    @Transactional(readOnly = true)
    public ConfirmContext beginConfirm(String firebaseUid, String orderId, long amount) {
        Checkout checkout = checkoutRepository.findByOrderId(orderId)
                .orElseThrow(() -> ApiException.notFound("결제 정보를 찾을 수 없습니다."));

        if (!checkout.getUser().getFirebaseUid().equals(firebaseUid)) {
            throw ApiException.forbidden("본인의 결제만 확정할 수 있습니다.");
        }

        if ("completed".equals(checkout.getStatus())) {
            return new ConfirmContext(true, parseMaterialIds(checkout.getMaterialIds()), checkout.getPaymentKey());
        }
        if (!"pending".equals(checkout.getStatus())) {
            throw ApiException.badRequest("이미 처리된 결제입니다.");
        }
        if (checkout.getAmount().longValue() != amount) {
            throw ApiException.badRequest("결제 금액이 일치하지 않습니다.");
        }
        return new ConfirmContext(false, parseMaterialIds(checkout.getMaterialIds()), null);
    }

    /**
     * Toss 승인 성공 직후 호출. checkout을 completed로 즉시 커밋해 idempotency 앵커를 만든다.
     * 이 커밋 이후의 자료 지급이 실패해도 결제 확정 사실은 유실되지 않고, 재confirm은
     * beginConfirm의 completed 분기를 타 절대 재청구되지 않는다. (이미 completed면 멱등 무시.)
     */
    @Transactional
    public void markCompleted(String orderId, String paymentKey) {
        Checkout checkout = checkoutRepository.findByOrderId(orderId)
                .orElseThrow(() -> ApiException.notFound("결제 정보를 찾을 수 없습니다."));
        if ("completed".equals(checkout.getStatus())) {
            return;
        }
        checkout.setStatus("completed");
        checkout.setPaymentKey(paymentKey);
        checkout.setCompletedAt(LocalDateTime.now());
        checkoutRepository.save(checkout);
    }

    private List<Long> parseMaterialIds(String ids) {
        return Arrays.stream(ids.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(Long::parseLong)
                .toList();
    }
}
