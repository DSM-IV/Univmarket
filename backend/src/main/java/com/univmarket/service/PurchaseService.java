package com.univmarket.service;

import com.univmarket.entity.*;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PurchaseService {

    private final UserRepository userRepository;
    private final MaterialRepository materialRepository;
    private final PurchaseRepository purchaseRepository;
    private final TransactionRepository transactionRepository;
    private final NotificationRepository notificationRepository;

    private static final int REFUND_DEADLINE_HOURS = 24;

    /**
     * 자료 구매 (원자적 트랜잭션)
     * - 구매자 포인트 차감
     * - 판매자 pendingEarnings 증가 (24시간 보류)
     * - 거래내역 2건 생성 (구매자, 판매자)
     * - 구매 기록 생성
     * - 판매자 알림
     */
    @Transactional
    public void purchaseMaterial(String buyerUid, Long materialId) {
        User buyer = userRepository.findByFirebaseUid(buyerUid)
                .orElseThrow(() -> ApiException.notFound("사용자 정보를 찾을 수 없습니다."));
        Material material = materialRepository.findById(materialId)
                .orElseThrow(() -> ApiException.notFound("자료를 찾을 수 없습니다."));
        User seller = material.getAuthor();

        if (seller.getId().equals(buyer.getId())) {
            throw ApiException.badRequest("본인의 자료는 구매할 수 없습니다.");
        }
        if (material.isHidden() || material.isCopyrightDeleted()) {
            throw ApiException.badRequest("구매할 수 없는 자료입니다.");
        }
        if (purchaseRepository.existsByBuyerIdAndMaterialId(buyer.getId(), materialId)) {
            throw ApiException.conflict("이미 구매한 자료입니다.");
        }

        BigDecimal price = BigDecimal.valueOf(material.getPrice());
        if (buyer.getPoints().compareTo(price) < 0) {
            throw ApiException.badRequest("포인트가 부족합니다.");
        }

        // 구매자 포인트 차감 (비관적 잠금 효과 — UPDATE WHERE points >= price)
        int updated = userRepository.deductPoints(buyer.getId(), price);
        if (updated == 0) {
            throw ApiException.badRequest("포인트가 부족합니다. (동시 처리 충돌)");
        }

        // 판매자 보류 수익금 추가
        userRepository.addPendingEarnings(seller.getId(), price);

        // 자료 판매 수 증가
        materialRepository.incrementSalesCount(materialId);

        // 구매자 최신 정보 조회
        buyer = userRepository.findById(buyer.getId()).orElseThrow();
        seller = userRepository.findById(seller.getId()).orElseThrow();

        // 구매자 거래 내역
        transactionRepository.save(Transaction.builder()
                .user(buyer)
                .type("purchase")
                .amount(price.negate())
                .balanceAfter(buyer.getPoints())
                .balanceType("points")
                .description("\"" + material.getTitle() + "\" 구매")
                .relatedMaterialId(materialId)
                .relatedUserId(seller.getId())
                .status("completed")
                .build());

        // 판매자 거래 내역
        transactionRepository.save(Transaction.builder()
                .user(seller)
                .type("sale")
                .amount(price)
                .balanceAfter(seller.getEarnings().add(seller.getPendingEarnings()))
                .balanceType("earnings")
                .description("\"" + material.getTitle() + "\" 판매 (정산 보류 중)")
                .relatedMaterialId(materialId)
                .relatedUserId(buyer.getId())
                .status("completed")
                .build());

        // 구매 기록 (DB unique 제약이 동시 중복 구매를 최종 차단)
        try {
            purchaseRepository.saveAndFlush(Purchase.builder()
                    .buyer(buyer)
                    .seller(seller)
                    .material(material)
                    .price(material.getPrice())
                    .settled(false)
                    .build());
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            throw ApiException.conflict("이미 구매한 자료입니다.");
        }

        // 판매자 알림
        notificationRepository.save(Notification.builder()
                .user(seller)
                .type("sale")
                .title("자료가 판매되었어요!")
                .message("\"" + material.getTitle() + "\" 자료가 판매되었습니다. (+" + price + "P)")
                .materialId(materialId)
                .materialTitle(material.getTitle())
                .build());
    }

    /**
     * 다운로드 URL 발급 + 최초 다운로드 기록.
     * 작성자는 누구든 다운 가능, 구매자는 본인 구매 건만 가능.
     * 구매자가 처음 다운받으면 downloaded=true로 마킹해 환불 자격을 해제한다.
     */
    @Transactional
    public String issueDownloadUrl(String firebaseUid, Long materialId, FileService fileService) {
        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자 정보를 찾을 수 없습니다."));
        Material material = materialRepository.findById(materialId)
                .orElseThrow(() -> ApiException.notFound("자료를 찾을 수 없습니다."));

        boolean isAuthor = material.getAuthor().getId().equals(user.getId());
        if (!isAuthor) {
            Purchase purchase = purchaseRepository
                    .findByBuyerIdAndMaterialIdAndRefundedFalse(user.getId(), materialId)
                    .orElseThrow(() -> ApiException.forbidden("구매하지 않은 자료입니다."));
            if (!purchase.isDownloaded()) {
                purchase.setDownloaded(true);
                purchase.setDownloadedAt(LocalDateTime.now());
                purchaseRepository.save(purchase);
            }
        }

        return fileService.generateDownloadUrl(material.getFileKey(), material.getFileName());
    }

    /**
     * 환불 처리 (24시간 이내, 미다운로드)
     */
    @Transactional
    public void refundPurchase(String buyerUid, Long purchaseId) {
        User buyer = userRepository.findByFirebaseUid(buyerUid)
                .orElseThrow(() -> ApiException.notFound("사용자 정보를 찾을 수 없습니다."));
        Purchase purchase = purchaseRepository.findById(purchaseId)
                .orElseThrow(() -> ApiException.notFound("구매 기록을 찾을 수 없습니다."));

        if (!purchase.getBuyer().getId().equals(buyer.getId())) {
            throw ApiException.forbidden("본인의 구매만 환불할 수 있습니다.");
        }
        if (purchase.isRefunded()) {
            throw ApiException.badRequest("이미 환불된 구매입니다.");
        }
        if (purchase.isDownloaded()) {
            throw ApiException.badRequest("이미 다운로드한 자료는 환불할 수 없습니다.");
        }

        LocalDateTime deadline = purchase.getCreatedAt().plusHours(REFUND_DEADLINE_HOURS);
        if (LocalDateTime.now().isAfter(deadline)) {
            throw ApiException.badRequest("구매 후 " + REFUND_DEADLINE_HOURS + "시간이 지나 환불할 수 없습니다.");
        }

        BigDecimal price = BigDecimal.valueOf(purchase.getPrice());
        User seller = purchase.getSeller();

        // 판매자 보류 수익금에서 우선 차감
        BigDecimal fromPending = seller.getPendingEarnings().min(price);
        BigDecimal fromEarnings = price.subtract(fromPending);

        if (fromEarnings.compareTo(seller.getEarnings()) > 0) {
            throw ApiException.badRequest("판매자의 수익금이 부족하여 환불할 수 없습니다.");
        }

        // 구매자 포인트 복구
        userRepository.addPoints(buyer.getId(), price);

        // 판매자 수익금 차감
        if (fromPending.compareTo(BigDecimal.ZERO) > 0) {
            seller.setPendingEarnings(seller.getPendingEarnings().subtract(fromPending));
        }
        if (fromEarnings.compareTo(BigDecimal.ZERO) > 0) {
            seller.setEarnings(seller.getEarnings().subtract(fromEarnings));
        }
        seller.setTotalEarned(seller.getTotalEarned().subtract(price));
        userRepository.save(seller);

        // 판매 수 감소
        materialRepository.decrementSalesCount(purchase.getMaterial().getId());

        // 구매 기록에 환불 표시
        purchase.setRefunded(true);
        purchase.setRefundedAt(LocalDateTime.now());
        purchaseRepository.save(purchase);

        // 최신 잔액 조회
        buyer = userRepository.findById(buyer.getId()).orElseThrow();
        seller = userRepository.findById(seller.getId()).orElseThrow();

        // 환불 거래 내역 (구매자)
        transactionRepository.save(Transaction.builder()
                .user(buyer)
                .type("refund")
                .amount(price)
                .balanceAfter(buyer.getPoints())
                .balanceType("points")
                .description("환불 처리 (포인트 전액 환불)")
                .relatedMaterialId(purchase.getMaterial().getId())
                .relatedUserId(seller.getId())
                .status("completed")
                .build());

        // 환불 거래 내역 (판매자)
        transactionRepository.save(Transaction.builder()
                .user(seller)
                .type("refund")
                .amount(price.negate())
                .balanceAfter(seller.getEarnings().add(seller.getPendingEarnings()))
                .balanceType("earnings")
                .description("환불 처리 (구매자 환불)")
                .relatedMaterialId(purchase.getMaterial().getId())
                .relatedUserId(buyer.getId())
                .status("completed")
                .build());
    }

    /**
     * 정산 스케줄러: 24시간 경과한 미정산 구매의 판매자 보류수익금을 확정
     */
    @Transactional
    public int settlePendingPurchases() {
        LocalDateTime cutoff = LocalDateTime.now().minusHours(24);
        List<Purchase> unsettled = purchaseRepository.findUnsettledBefore(cutoff);

        int settled = 0;
        for (Purchase purchase : unsettled) {
            if (purchase.isRefunded()) {
                purchase.setSettled(true);
                purchaseRepository.save(purchase);
                continue;
            }

            User seller = purchase.getSeller();
            BigDecimal price = BigDecimal.valueOf(purchase.getPrice());
            BigDecimal pending = seller.getPendingEarnings();
            BigDecimal settleAmount = pending.min(price);

            if (settleAmount.compareTo(BigDecimal.ZERO) > 0) {
                seller.setPendingEarnings(pending.subtract(settleAmount));
                seller.setEarnings(seller.getEarnings().add(settleAmount));
                userRepository.save(seller);
            }

            purchase.setSettled(true);
            purchaseRepository.save(purchase);
            settled++;
        }

        return settled;
    }
}
