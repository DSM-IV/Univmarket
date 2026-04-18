package com.univmarket.controller;

import com.univmarket.entity.ChargeRequest;
import com.univmarket.security.FirebaseUserPrincipal;
import com.univmarket.service.ChargeRequestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/charge-requests")
@RequiredArgsConstructor
public class ChargeRequestController {

    private final ChargeRequestService chargeRequestService;

    /**
     * 충전 요청 생성 (계좌이체 수동 충전)
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> submit(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestBody Map<String, Object> body) {
        Number amountRaw = (Number) body.get("amount");
        if (amountRaw == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "금액이 누락되었습니다."));
        }
        ChargeRequest created = chargeRequestService.submit(
                principal.getUid(),
                BigDecimal.valueOf(amountRaw.longValue()),
                (String) body.get("senderName"),
                (String) body.get("senderPhone"),
                (String) body.get("receiptNumber"),
                (String) body.get("receiptType"));
        return ResponseEntity.ok(Map.of(
                "id", created.getId(),
                "status", created.getStatus(),
                "transferAmount", created.getTransferAmount()));
    }

    /**
     * 본인의 충전 요청 목록
     */
    @GetMapping("/me")
    public ResponseEntity<List<ChargeRequest>> listMine(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(chargeRequestService.listMine(principal.getUid(), limit));
    }
}
