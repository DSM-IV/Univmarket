package com.univmarket.controller;

import com.univmarket.security.FirebaseUserPrincipal;
import com.univmarket.service.WithdrawService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/withdrawals")
@RequiredArgsConstructor
public class WithdrawController {

    private final WithdrawService withdrawService;

    /**
     * 출금 요청
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> requestWithdraw(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestBody Map<String, Object> body) {
        int amount = ((Number) body.get("amount")).intValue();
        String bankName = (String) body.get("bankName");
        String accountNumber = (String) body.get("accountNumber");
        String accountHolder = (String) body.get("accountHolder");

        Map<String, Object> result = withdrawService.requestWithdraw(
                principal.getUid(), amount, bankName, accountNumber, accountHolder);
        return ResponseEntity.ok(result);
    }
}
