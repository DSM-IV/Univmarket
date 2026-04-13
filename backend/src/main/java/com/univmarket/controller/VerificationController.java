package com.univmarket.controller;

import com.univmarket.security.FirebaseUserPrincipal;
import com.univmarket.service.VerificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class VerificationController {

    private final VerificationService verificationService;

    /**
     * 카카오 인증번호 발송 (공개)
     */
    @PostMapping("/kakao-verify/send")
    public ResponseEntity<Map<String, Object>> sendKakaoVerification(
            @RequestBody Map<String, String> body) {
        String phone = body.get("phone");
        String name = body.get("name");
        Map<String, Object> result = verificationService.sendKakaoVerification(phone, name);
        return ResponseEntity.ok(result);
    }

    /**
     * 카카오 인증번호 확인 (공개)
     */
    @PostMapping("/kakao-verify/confirm")
    public ResponseEntity<Map<String, Object>> verifyKakaoCode(
            @RequestBody Map<String, String> body) {
        String phone = body.get("phone");
        String code = body.get("code");
        Map<String, Object> result = verificationService.verifyKakaoCode(phone, code);
        return ResponseEntity.ok(result);
    }

    /**
     * 본인인증 요청 (인증 필요)
     */
    @PostMapping("/verify/request")
    public ResponseEntity<Map<String, Object>> requestVerification(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestBody Map<String, String> body) {
        String phone = body.get("phone");
        String name = body.get("name");
        Map<String, Object> result = verificationService.requestIdentityVerification(
                principal.getUid(), phone, name);
        return ResponseEntity.ok(result);
    }

    /**
     * 본인인증 확인 (인증 필요)
     */
    @PostMapping("/verify/confirm")
    public ResponseEntity<Map<String, Object>> confirmVerification(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestBody Map<String, String> body) {
        String phone = body.get("phone");
        String code = body.get("code");
        String name = body.get("name");
        String birth = body.get("birth");
        Map<String, Object> result = verificationService.confirmIdentityVerification(
                principal.getUid(), phone, code, name, birth);
        return ResponseEntity.ok(result);
    }
}
