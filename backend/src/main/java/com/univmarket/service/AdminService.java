package com.univmarket.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.UserRecord;
import com.univmarket.entity.*;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final MaterialRepository materialRepository;
    private final TransactionRepository transactionRepository;
    private final AdminLogRepository adminLogRepository;
    private final ReportRepository reportRepository;
    private final ChargeRequestRepository chargeRequestRepository;
    private final PurchaseRepository purchaseRepository;
    private final FileService fileService;
    private final FirebaseAuth firebaseAuth;
    private final ObjectMapper objectMapper;

    @Transactional
    public void banUser(String adminUid, String targetFirebaseUid, String reason) {
        User target = userRepository.findByFirebaseUid(targetFirebaseUid)
                .orElseThrow(() -> ApiException.notFound("대상 사용자를 찾을 수 없습니다."));

        // Firebase Auth 계정 비활성화
        try {
            UserRecord.UpdateRequest updateRequest = new UserRecord.UpdateRequest(targetFirebaseUid)
                    .setDisabled(true);
            firebaseAuth.updateUser(updateRequest);
        } catch (FirebaseAuthException e) {
            log.error("Firebase Auth 비활성화 실패: {}", e.getMessage());
            throw ApiException.badRequest("계정 비활성화에 실패했습니다.");
        }

        target.setBanned(true);
        target.setBannedAt(LocalDateTime.now());
        target.setBanReason(reason);
        userRepository.save(target);

        // 해당 판매자의 모든 자료 비공개
        int hidden = materialRepository.setHiddenByAuthor(target.getId(), true);

        writeAdminLog(adminUid, "ban_user", Map.of(
                "targetUserId", targetFirebaseUid,
                "reason", reason != null ? reason : "",
                "hiddenMaterials", hidden));
    }

    @Transactional
    public void suspendUser(String adminUid, String targetFirebaseUid, String reason, int days) {
        User target = userRepository.findByFirebaseUid(targetFirebaseUid)
                .orElseThrow(() -> ApiException.notFound("대상 사용자를 찾을 수 없습니다."));

        LocalDateTime suspendUntil = LocalDateTime.now().plusDays(days);
        target.setSuspended(true);
        target.setSuspendedUntil(suspendUntil);
        target.setSuspendReason(reason);
        userRepository.save(target);

        int hidden = materialRepository.setHiddenByAuthor(target.getId(), true);

        writeAdminLog(adminUid, "suspend_user", Map.of(
                "targetUserId", targetFirebaseUid,
                "reason", reason != null ? reason : "",
                "days", days,
                "suspendedUntil", suspendUntil.toString(),
                "hiddenMaterials", hidden));
    }

    @Transactional
    public void unsuspendUser(String adminUid, String targetFirebaseUid) {
        User target = userRepository.findByFirebaseUid(targetFirebaseUid)
                .orElseThrow(() -> ApiException.notFound("대상 사용자를 찾을 수 없습니다."));

        target.setSuspended(false);
        target.setSuspendedUntil(null);
        target.setSuspendReason(null);
        userRepository.save(target);

        materialRepository.setHiddenByAuthor(target.getId(), false);

        writeAdminLog(adminUid, "unsuspend_user", Map.of("targetUserId", targetFirebaseUid));
    }

    @Transactional
    public void grantEarnings(String adminUid, String targetFirebaseUid, int amount, String reason) {
        if (amount == 0 || Math.abs(amount) > 10_000_000) {
            throw ApiException.badRequest("지급 금액은 0이 아닌 정수여야 하며, 절대값 1,000만원 이하여야 합니다.");
        }

        User target = userRepository.findByFirebaseUid(targetFirebaseUid)
                .orElseThrow(() -> ApiException.notFound("대상 사용자를 찾을 수 없습니다."));

        BigDecimal amountBd = BigDecimal.valueOf(amount);
        BigDecimal newEarnings = target.getEarnings().add(amountBd);

        if (newEarnings.compareTo(BigDecimal.ZERO) < 0) {
            throw ApiException.badRequest("차감 후 수익금이 음수가 됩니다.");
        }

        target.setEarnings(newEarnings);
        if (amount > 0) {
            target.setTotalEarned(target.getTotalEarned().add(amountBd));
        }
        userRepository.save(target);

        transactionRepository.save(Transaction.builder()
                .user(target)
                .type("admin_grant")
                .amount(amountBd)
                .balanceAfter(newEarnings)
                .balanceType("earnings")
                .description("관리자 수익금 " + (amount > 0 ? "지급" : "회수") + (reason != null ? " (" + reason + ")" : ""))
                .grantedBy(adminUid)
                .status("completed")
                .build());

        writeAdminLog(adminUid, "grant_earnings", Map.of(
                "targetUserId", targetFirebaseUid,
                "amount", amount,
                "reason", reason != null ? reason : "",
                "balanceAfter", newEarnings));
    }

    @Transactional
    public boolean deleteMaterial(String adminUid, Long materialId, Long reportId, String reason) {
        Material material = materialRepository.findById(materialId)
                .orElseThrow(() -> ApiException.notFound("자료를 찾을 수 없습니다."));

        // R2 파일 삭제
        boolean r2Deleted = false;
        if (material.getFileKey() != null && !material.getFileKey().isEmpty()) {
            r2Deleted = fileService.deleteFile(material.getFileKey());
        }

        boolean isCopyright = "copyright".equals(reason);
        if (isCopyright) {
            material.setHidden(true);
            material.setCopyrightDeleted(true);
            material.setFileUrl("");
            material.setFileKey("");
            materialRepository.save(material);
        } else {
            materialRepository.delete(material);
        }

        writeAdminLog(adminUid, "delete_material", Map.of(
                "materialId", materialId,
                "reason", reason != null ? reason : "",
                "r2Deleted", r2Deleted));

        return r2Deleted;
    }

    // ─── 출금 관리 ───

    @Transactional(readOnly = true)
    public List<Transaction> listWithdrawals(String status) {
        if ("all".equals(status)) {
            return transactionRepository.findTop200ByTypeOrderByCreatedAtDesc("withdraw");
        }
        return transactionRepository.findByTypeAndStatusOrderByCreatedAtDesc("withdraw", status);
    }

    @Transactional
    public void completeWithdrawal(String adminUid, Long transactionId) {
        Transaction tx = transactionRepository.findById(transactionId)
                .orElseThrow(() -> ApiException.notFound("출금 요청을 찾을 수 없습니다."));

        if (!"withdraw".equals(tx.getType()) || !"pending".equals(tx.getStatus())) {
            throw ApiException.badRequest("처리할 수 없는 출금 요청입니다.");
        }

        tx.setStatus("completed");
        tx.setCompletedBy(adminUid);
        tx.setCompletedAt(LocalDateTime.now());
        transactionRepository.save(tx);

        writeAdminLog(adminUid, "complete_withdrawal", Map.of(
                "transactionId", transactionId,
                "userId", tx.getUser().getId(),
                "amount", tx.getAmount()));
    }

    @Transactional
    public void rejectWithdrawal(String adminUid, Long transactionId, String reason) {
        Transaction tx = transactionRepository.findById(transactionId)
                .orElseThrow(() -> ApiException.notFound("출금 요청을 찾을 수 없습니다."));

        if (!"withdraw".equals(tx.getType()) || !"pending".equals(tx.getStatus())) {
            throw ApiException.badRequest("처리할 수 없는 출금 요청입니다.");
        }

        // 수익금 복구
        BigDecimal refundAmount = tx.getAmount().abs();
        User user = tx.getUser();
        user.setEarnings(user.getEarnings().add(refundAmount));
        userRepository.save(user);

        tx.setStatus("rejected");
        tx.setRejectedBy(adminUid);
        tx.setRejectedAt(LocalDateTime.now());
        tx.setRejectReason(reason);
        transactionRepository.save(tx);

        writeAdminLog(adminUid, "reject_withdrawal", Map.of(
                "transactionId", transactionId,
                "reason", reason != null ? reason : "",
                "refundAmount", refundAmount));
    }

    // ─── 신고 관리 ───

    @Transactional(readOnly = true)
    public Page<Report> listReports(int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, Math.min(size, 50),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        return reportRepository.findAllByOrderByCreatedAtDesc(pageRequest);
    }

    @Transactional
    public void updateReportStatus(String adminUid, Long reportId, String status, String resolution) {
        Report report = reportRepository.findById(reportId)
                .orElseThrow(() -> ApiException.notFound("신고를 찾을 수 없습니다."));

        report.setStatus(status);
        report.setResolution(resolution);
        report.setResolvedBy(adminUid);
        report.setResolvedAt(LocalDateTime.now());
        reportRepository.save(report);

        writeAdminLog(adminUid, "update_report_status", Map.of(
                "reportId", reportId,
                "status", status,
                "resolution", resolution != null ? resolution : ""));
    }

    @Transactional
    public void approveDefectReport(String adminUid, Long reportId) {
        Report report = reportRepository.findById(reportId)
                .orElseThrow(() -> ApiException.notFound("신고를 찾을 수 없습니다."));

        if (!"defect".equals(report.getType())) {
            throw ApiException.badRequest("불량 신고만 승인할 수 있습니다.");
        }

        // 구매자 환불 처리
        if (report.getPurchaseId() != null) {
            Purchase purchase = purchaseRepository.findById(report.getPurchaseId()).orElse(null);
            if (purchase != null && !purchase.isRefunded()) {
                BigDecimal price = BigDecimal.valueOf(purchase.getPrice());
                userRepository.addPoints(purchase.getBuyer().getId(), price);

                purchase.setRefunded(true);
                purchase.setRefundedAt(LocalDateTime.now());
                purchase.setRefundReason("관리자 불량 승인에 의한 환불");
                purchaseRepository.save(purchase);
            }
        }

        report.setStatus("resolved");
        report.setResolution("defect_approved");
        report.setResolvedBy(adminUid);
        report.setResolvedAt(LocalDateTime.now());
        reportRepository.save(report);

        writeAdminLog(adminUid, "approve_defect_report", Map.of(
                "reportId", reportId,
                "materialId", report.getMaterial().getId()));
    }

    // ─── 충전 요청 관리 ───

    @Transactional(readOnly = true)
    public Page<ChargeRequest> listChargeRequests(int page, int size, String status) {
        PageRequest pageRequest = PageRequest.of(page, Math.min(size, 50),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        if ("all".equals(status)) {
            return chargeRequestRepository.findAllByOrderByCreatedAtDesc(pageRequest);
        }
        return chargeRequestRepository.findByStatusOrderByCreatedAtDesc(status, pageRequest);
    }

    @Transactional
    public void approveChargeRequest(String adminUid, Long requestId) {
        ChargeRequest request = chargeRequestRepository.findById(requestId)
                .orElseThrow(() -> ApiException.notFound("충전 요청을 찾을 수 없습니다."));

        if (!"pending".equals(request.getStatus())) {
            throw ApiException.badRequest("이미 처리된 요청입니다.");
        }

        request.setStatus("approved");
        chargeRequestRepository.save(request);

        // 포인트 충전
        User user = request.getUser();
        userRepository.addPoints(user.getId(), request.getAmount());

        user = userRepository.findById(user.getId()).orElseThrow();

        transactionRepository.save(Transaction.builder()
                .user(user)
                .type("charge")
                .amount(request.getAmount())
                .balanceAfter(user.getPoints())
                .balanceType("points")
                .description("계좌이체 충전 (관리자 승인)")
                .status("completed")
                .build());

        writeAdminLog(adminUid, "approve_charge_request", Map.of(
                "requestId", requestId,
                "userId", user.getId(),
                "amount", request.getAmount()));
    }

    @Transactional
    public void rejectChargeRequest(String adminUid, Long requestId, String reason) {
        ChargeRequest request = chargeRequestRepository.findById(requestId)
                .orElseThrow(() -> ApiException.notFound("충전 요청을 찾을 수 없습니다."));

        if (!"pending".equals(request.getStatus())) {
            throw ApiException.badRequest("이미 처리된 요청입니다.");
        }

        request.setStatus("rejected");
        chargeRequestRepository.save(request);

        writeAdminLog(adminUid, "reject_charge_request", Map.of(
                "requestId", requestId,
                "reason", reason != null ? reason : ""));
    }

    // ─── 유틸리티 ───

    private void writeAdminLog(String adminUid, String action, Map<String, Object> details) {
        String detailsJson;
        try {
            detailsJson = objectMapper.writeValueAsString(details);
        } catch (JsonProcessingException e) {
            detailsJson = details.toString();
        }

        adminLogRepository.save(AdminLog.builder()
                .adminUid(adminUid)
                .action(action)
                .details(detailsJson)
                .build());
    }
}
