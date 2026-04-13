package com.univmarket.controller;

import com.univmarket.security.FirebaseUserPrincipal;
import com.univmarket.service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    /**
     * 카카오페이 결제 준비
     */
    @PostMapping("/kakaopay/ready")
    public ResponseEntity<Map<String, Object>> kakaoPayReady(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestBody Map<String, Object> body) {
        int amount = ((Number) body.get("amount")).intValue();
        Map<String, Object> result = paymentService.createKakaoPaySession(principal.getUid(), amount);
        return ResponseEntity.ok(result);
    }

    /**
     * 카카오페이 결제 승인 콜백 (공개 엔드포인트)
     */
    @GetMapping("/kakaopay/approve")
    public ResponseEntity<Map<String, Object>> kakaoPayApprove(
            @RequestParam("pg_token") String pgToken,
            @RequestParam("tid") String tid) {
        Map<String, Object> result = paymentService.approveKakaoPay(pgToken, tid);
        return ResponseEntity.ok(result);
    }

    /**
     * 토스 결제 준비
     */
    @PostMapping("/toss/ready")
    public ResponseEntity<Map<String, Object>> tossReady(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestBody Map<String, Object> body) {
        int amount = ((Number) body.get("amount")).intValue();
        Map<String, Object> result = paymentService.createTossSession(principal.getUid(), amount);
        return ResponseEntity.ok(result);
    }

    /**
     * 토스 결제 승인
     */
    @PostMapping("/toss/approve")
    public ResponseEntity<Map<String, Object>> tossApprove(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestBody Map<String, Object> body) {
        String paymentKey = (String) body.get("paymentKey");
        String orderId = (String) body.get("orderId");
        int amount = ((Number) body.get("amount")).intValue();
        Map<String, Object> result = paymentService.approveToss(
                principal.getUid(), paymentKey, orderId, amount);
        return ResponseEntity.ok(result);
    }
}
