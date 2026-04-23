package com.univmarket.controller;

import com.univmarket.entity.ChargeRequest;
import com.univmarket.entity.Report;
import com.univmarket.entity.Transaction;
import com.univmarket.security.FirebaseUserPrincipal;
import com.univmarket.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 관리자 전용 API.
 * SecurityConfig에서 /api/admin/** 은 ROLE_ADMIN 필요.
 * 추가로 @PreAuthorize로 이중 검증.
 */
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @PostMapping("/users/{uid}/ban")
    public ResponseEntity<Map<String, Boolean>> banUser(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @PathVariable String uid,
            @RequestBody Map<String, String> body) {
        adminService.banUser(principal.getUid(), uid, body.getOrDefault("reason", ""));
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/users/{uid}/suspend")
    public ResponseEntity<Map<String, Boolean>> suspendUser(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @PathVariable String uid,
            @RequestBody Map<String, Object> body) {
        String reason = (String) body.getOrDefault("reason", "");
        int days = body.containsKey("days") ? ((Number) body.get("days")).intValue() : 7;
        adminService.suspendUser(principal.getUid(), uid, reason, days);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/users/{uid}/unsuspend")
    public ResponseEntity<Map<String, Boolean>> unsuspendUser(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @PathVariable String uid) {
        adminService.unsuspendUser(principal.getUid(), uid);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/users/{uid}/grant-earnings")
    public ResponseEntity<Map<String, Object>> grantEarnings(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @PathVariable String uid,
            @RequestBody Map<String, Object> body) {
        int amount = ((Number) body.get("amount")).intValue();
        String reason = (String) body.getOrDefault("reason", "");
        java.math.BigDecimal newBalance = adminService.grantEarnings(principal.getUid(), uid, amount, reason);
        return ResponseEntity.ok(Map.of("success", true, "balanceAfter", newBalance));
    }

    @DeleteMapping("/materials/{id}")
    public ResponseEntity<Map<String, Object>> deleteMaterial(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body) {
        Long reportId = body != null && body.containsKey("reportId") ? ((Number) body.get("reportId")).longValue() : null;
        String reason = body != null ? (String) body.getOrDefault("reason", "") : "";
        boolean r2Deleted = adminService.deleteMaterial(principal.getUid(), id, reportId, reason);
        return ResponseEntity.ok(Map.of("success", true, "r2Deleted", r2Deleted));
    }

    // ─── 출금 관리 ───

    @GetMapping("/withdrawals")
    public ResponseEntity<List<Transaction>> listWithdrawals(
            @RequestParam(defaultValue = "pending") String status) {
        List<Transaction> withdrawals = adminService.listWithdrawals(status);
        return ResponseEntity.ok(withdrawals);
    }

    @PostMapping("/withdrawals/{id}/complete")
    public ResponseEntity<Map<String, Boolean>> completeWithdrawal(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @PathVariable Long id) {
        adminService.completeWithdrawal(principal.getUid(), id);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/withdrawals/{id}/reject")
    public ResponseEntity<Map<String, Boolean>> rejectWithdrawal(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        adminService.rejectWithdrawal(principal.getUid(), id, body.getOrDefault("reason", ""));
        return ResponseEntity.ok(Map.of("success", true));
    }

    // ─── 신고 관리 ───

    @GetMapping("/reports")
    public ResponseEntity<Page<Report>> listReports(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<Report> reports = adminService.listReports(page, size);
        return ResponseEntity.ok(reports);
    }

    @PostMapping("/reports/{id}/status")
    public ResponseEntity<Map<String, Boolean>> updateReportStatus(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        adminService.updateReportStatus(principal.getUid(), id, body.get("status"), body.get("resolution"));
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/reports/{id}/approve-defect")
    public ResponseEntity<Map<String, Boolean>> approveDefectReport(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @PathVariable Long id) {
        adminService.approveDefectReport(principal.getUid(), id);
        return ResponseEntity.ok(Map.of("success", true));
    }

    // ─── 성적 인증 요청 관리 (스텁 — 미구현) ───

    @GetMapping("/grade-requests")
    public ResponseEntity<List<Map<String, Object>>> listGradeRequests() {
        // TODO: 성적 인증 기능 미구현. 일단 빈 배열로 응답해 어드민 페이지가
        // 깨지지 않게 함. 정식 구현 시 grade_requests 테이블/엔티티 필요.
        return ResponseEntity.ok(List.of());
    }

    // ─── 충전 요청 관리 ───

    @GetMapping("/charge-requests")
    public ResponseEntity<Page<ChargeRequest>> listChargeRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "pending") String status) {
        Page<ChargeRequest> requests = adminService.listChargeRequests(page, size, status);
        return ResponseEntity.ok(requests);
    }

    @PostMapping("/charge-requests/{id}/approve")
    public ResponseEntity<Map<String, Boolean>> approveChargeRequest(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @PathVariable Long id) {
        adminService.approveChargeRequest(principal.getUid(), id);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/charge-requests/{id}/reject")
    public ResponseEntity<Map<String, Boolean>> rejectChargeRequest(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body) {
        String reason = body != null ? body.getOrDefault("reason", "") : "";
        adminService.rejectChargeRequest(principal.getUid(), id, reason);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
