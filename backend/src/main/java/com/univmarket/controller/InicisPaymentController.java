package com.univmarket.controller;

import com.univmarket.security.FirebaseUserPrincipal;
import com.univmarket.service.InicisPaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/payments/inicis")
@RequiredArgsConstructor
public class InicisPaymentController {

    private final InicisPaymentService inicisPaymentService;

    /**
     * 결제창 파라미터 발급. SPA가 INIStdPay 폼을 구성하려고 호출한다(인증 필요).
     */
    @PostMapping("/prepare")
    public ResponseEntity<Map<String, Object>> prepare(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<Number> raw = (List<Number>) body.get("materialIds");
        List<Long> materialIds = raw == null ? List.of()
                : raw.stream().map(Number::longValue).toList();
        Map<String, Object> params = inicisPaymentService.preparePayment(
                principal.getUid(),
                materialIds,
                (String) body.get("buyerName"),
                (String) body.get("buyerTel"),
                (String) body.get("buyerEmail"));
        return ResponseEntity.ok(params);
    }

    /**
     * 이니시스 인증결과 수신. 이니시스 결제창 → 브라우저가 form-urlencoded로 POST한다(인증 없음 —
     * SecurityConfig에서 permitAll). 서버 승인 + 자료 지급 후 SPA 결과 페이지로 302 redirect.
     */
    @PostMapping(value = "/return", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public ResponseEntity<Void> inicisReturn(@RequestParam Map<String, String> params) {
        String redirect = inicisPaymentService.handleReturn(params);
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(redirect)).build();
    }
}
