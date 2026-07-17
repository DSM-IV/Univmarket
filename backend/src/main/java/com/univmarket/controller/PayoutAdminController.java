package com.univmarket.controller;

import com.univmarket.service.PayoutExportService;
import com.univmarket.service.PayoutProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 관리자 지급대행 API.
 * SecurityConfig에서 /api/admin/** 은 ROLE_ADMIN 필요. @PreAuthorize로 이중 검증.
 */
@RestController
@RequestMapping("/api/admin/payouts")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class PayoutAdminController {

    private final PayoutProfileService payoutProfileService;
    private final PayoutExportService payoutExportService;

    /** 전체 지급 프로필 목록 (마스킹 계좌 + status + kycStatus). */
    @GetMapping("/profiles")
    public ResponseEntity<List<Map<String, Object>>> listProfiles() {
        return ResponseEntity.ok(payoutProfileService.listProfilesForAdmin());
    }

    /** 프로필 상태 전환 (REGISTERED / FAILED / DRAFT). */
    @PostMapping("/profiles/{id}/status")
    public ResponseEntity<Map<String, Object>> setStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(payoutProfileService.setStatusByAdmin(id, body.get("status")));
    }

    /** 지급 대상 미리보기. */
    @GetMapping("/export/preview")
    public ResponseEntity<Map<String, Object>> exportPreview(
            @RequestParam("payDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate payDate) {
        return ResponseEntity.ok(payoutExportService.preview(payDate));
    }

    /** 지급데이터 txt (EUC-KR) 다운로드. */
    @GetMapping("/export/payout-data")
    public ResponseEntity<byte[]> exportPayoutData(
            @RequestParam("payDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate payDate) {
        byte[] body = payoutExportService.buildPayoutFile(payDate);
        String filename = "payout_" + payDate.format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd")) + ".txt";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/plain;charset=EUC-KR"));
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        return new ResponseEntity<>(body, headers, org.springframework.http.HttpStatus.OK);
    }
}
