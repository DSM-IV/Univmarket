package com.univmarket.controller;

import com.univmarket.security.FirebaseUserPrincipal;
import com.univmarket.service.PayoutProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 셀러 지급 프로필(이니시스 서브몰) — 본인용.
 * /api/** 기본 인증이 적용된다(SecurityConfig anyRequest().authenticated()).
 */
@RestController
@RequestMapping("/api/payout-profile")
@RequiredArgsConstructor
public class PayoutProfileController {

    private final PayoutProfileService payoutProfileService;

    /** 본인 프로필 (마스킹 계좌만). 없으면 null 바디. */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getMyProfile(
            @AuthenticationPrincipal FirebaseUserPrincipal principal) {
        return ResponseEntity.ok(payoutProfileService.getMyProfile(principal.getUid()));
    }

    /** 프로필 upsert. */
    @PutMapping
    public ResponseEntity<Map<String, Object>> upsert(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(payoutProfileService.upsertProfile(principal.getUid(), body));
    }

    /** 은행 선택 목록 [{name, codeConfirmed}]. */
    @GetMapping("/banks")
    public ResponseEntity<List<Map<String, Object>>> banks() {
        return ResponseEntity.ok(payoutProfileService.listBanks());
    }
}
