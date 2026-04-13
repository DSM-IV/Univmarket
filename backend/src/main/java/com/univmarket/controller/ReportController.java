package com.univmarket.controller;

import com.univmarket.entity.Report;
import com.univmarket.security.FirebaseUserPrincipal;
import com.univmarket.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    /**
     * 신고 접수
     */
    @PostMapping
    public ResponseEntity<Report> submitReport(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestBody Map<String, Object> body) {
        Long materialId = ((Number) body.get("materialId")).longValue();
        String type = (String) body.get("type");
        String reason = (String) body.get("reason");
        String description = (String) body.get("description");
        String originalSource = (String) body.get("originalSource");
        String contactEmail = (String) body.get("contactEmail");
        boolean isRightsHolder = Boolean.TRUE.equals(body.get("isRightsHolder"));
        Long purchaseId = body.get("purchaseId") != null ? ((Number) body.get("purchaseId")).longValue() : null;

        Report report = reportService.submitReport(
                principal.getUid(), materialId, type, reason,
                description, originalSource, contactEmail, isRightsHolder, purchaseId);
        return ResponseEntity.ok(report);
    }
}
