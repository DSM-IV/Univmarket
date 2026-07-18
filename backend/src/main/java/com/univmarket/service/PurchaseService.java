package com.univmarket.service;

import com.univmarket.entity.*;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
public class PurchaseService {

    private final UserRepository userRepository;
    private final MaterialRepository materialRepository;
    private final PurchaseRepository purchaseRepository;
    private final TransactionRepository transactionRepository;
    private final NotificationRepository notificationRepository;
    private final PaymentService paymentService;

    public PurchaseService(
            UserRepository userRepository,
            MaterialRepository materialRepository,
            PurchaseRepository purchaseRepository,
            TransactionRepository transactionRepository,
            NotificationRepository notificationRepository,
            @Lazy PaymentService paymentService) {
        this.userRepository = userRepository;
        this.materialRepository = materialRepository;
        this.purchaseRepository = purchaseRepository;
        this.transactionRepository = transactionRepository;
        this.notificationRepository = notificationRepository;
        this.paymentService = paymentService;
    }

    private static final int REFUND_DEADLINE_HOURS = 24;

    /**
     * 직접결제 후 자료 지급. Purchase 레코드 생성 + 판매자 pendingEarnings 증가.
     * 결제 검증은 호출 측(PaymentService.confirmCheckout)이 이미 완료했다고 가정.
     */
    @Transactional
    public void recordPurchase(String buyerUid, Long materialId, String tossPaymentKey, long paidAmount, String pg) {
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

        userRepository.addPendingEarnings(seller.getId(), price);
        materialRepository.incrementSalesCount(materialId);

        buyer = userRepository.findById(buyer.getId()).orElseThrow();
        seller = userRepository.findById(seller.getId()).orElseThrow();

        transactionRepository.save(Transaction.builder()
                .user(buyer)
                .type("purchase")
                .amount(price.negate())
                .balanceType("cash")
                .description("\"" + material.getTitle() + "\" 구매")
                .relatedMaterialId(materialId)
                .relatedUserId(seller.getId())
                .tossPaymentKey(tossPaymentKey)
                .tossPaymentAmount(BigDecimal.valueOf(paidAmount))
                .status("completed")
                .build());

        transactionRepository.save(Transaction.builder()
                .user(seller)
                .type("sale")
                .amount(price)
                .balanceAfter(seller.getEarnings().add(seller.getPendingEarnings()))
                .balanceType("earnings")
                .description("\"" + material.getTitle() + "\" 판매 (정산 보류 중)")
                .relatedMaterialId(materialId)
                .relatedUserId(buyer.getId())
                .tossPaymentKey(tossPaymentKey)
                .status("completed")
                .build());

        try {
            purchaseRepository.saveAndFlush(Purchase.builder()
                    .buyer(buyer)
                    .seller(seller)
                    .material(material)
                    .price(material.getPrice())
                    .settled(false)
                    .tossPaymentKey(tossPaymentKey)
                    .tossPaymentAmount(paidAmount)
                    .pg(pg)
                    .build());
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            throw ApiException.conflict("이미 구매한 자료입니다.");
        }

        notificationRepository.save(Notification.builder()
                .user(seller)
                .type("sale")
                .title("자료가 판매되었어요!")
                .message("\"" + material.getTitle() + "\" 자료가 판매되었습니다. (+" + price + "원)")
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
        return issueDownloadUrl(firebaseUid, materialId, null, fileService);
    }

    @Transactional
    public String issueDownloadUrl(String firebaseUid, Long materialId, String fileKey, FileService fileService) {
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

        // fileKey가 지정되면 자료에 속한 파일인지 검증 후 해당 파일 다운로드 URL 발급
        if (fileKey != null && !fileKey.isBlank()) {
            MaterialFile target = material.getFiles().stream()
                    .filter(f -> fileKey.equals(f.getFileKey()))
                    .findFirst()
                    .orElse(null);
            if (target == null && fileKey.equals(material.getFileKey())) {
                return fileService.generateDownloadUrl(material.getFileKey(), material.getFileName());
            }
            if (target == null) {
                throw ApiException.badRequest("해당 파일이 자료에 포함되지 않습니다.");
            }
            return fileService.generateDownloadUrl(target.getFileKey(), target.getFileName());
        }

        return fileService.generateDownloadUrl(material.getFileKey(), material.getFileName());
    }

    /**
     * 환불 처리 (24시간 이내, 미다운로드).
     * Toss 부분환불 API 를 호출해 구매자 결제수단으로 직접 환불하고, 판매자 수익금에서 동일액 차감.
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

        // 직접결제(Toss)로 결제된 구매만 자동 환불 가능. 옛 포인트 구매는 관리자 수동 처리.
        String paymentKey = purchase.getTossPaymentKey();
        if (paymentKey == null || paymentKey.isBlank()) {
            throw ApiException.badRequest("결제 정보가 없어 자동 환불할 수 없습니다. 관리자에게 문의해 주세요.");
        }

        BigDecimal price = BigDecimal.valueOf(purchase.getPrice());
        User seller = purchase.getSeller();

        // 판매자 보류 수익금에서 우선 차감
        BigDecimal fromPending = seller.getPendingEarnings().min(price);
        BigDecimal fromEarnings = price.subtract(fromPending);

        if (fromEarnings.compareTo(seller.getEarnings()) > 0) {
            throw ApiException.badRequest("판매자의 수익금이 부족하여 환불할 수 없습니다.");
        }

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

        seller = userRepository.findById(seller.getId()).orElseThrow();

        // 환불 거래 내역 (구매자) — 결제 카드/계좌로 직접 환불되므로 잔액 변동 없음
        transactionRepository.save(Transaction.builder()
                .user(buyer)
                .type("refund")
                .amount(price)
                .balanceType("cash")
                .description("환불 처리 (결제 수단으로 환불)")
                .relatedMaterialId(purchase.getMaterial().getId())
                .relatedUserId(seller.getId())
                .tossPaymentKey(paymentKey)
                .tossPaymentAmount(price)
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
                .tossPaymentKey(paymentKey)
                .status("completed")
                .build());

        // PG 부분환불 — 회복 가능한 DB 변경을 모두 마친 뒤 마지막(비가역)에 호출.
        // DB 작업이 먼저 실패하면 환불 전에 트랜잭션이 롤백되고, cancel 실패 시엔 위 DB 변경도 전부 롤백된다.
        // (cancel 성공 후 commit 실패의 잔여 창은 webhook 도입 전까지 대사 쿼리로 탐지 — 환불됐는데 미차감.)
        // 디스패처가 purchase.pg 로 Toss/이니시스 경로를 자동 선택한다.
        paymentService.cancelPayment(purchase, "구매 후 24시간 이내 환불");
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
