package com.univmarket.service;

import com.univmarket.entity.User;
import com.univmarket.entity.VerificationSession;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.UserRepository;
import com.univmarket.repository.VerificationSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class VerificationService {

    private final VerificationSessionRepository verificationSessionRepository;
    private final UserRepository userRepository;

    private static final int CODE_LENGTH = 6;
    private static final int EXPIRY_MINUTES = 5;
    private static final int MAX_ATTEMPTS = 5;
    private static final int MAX_REQUESTS_PER_HOUR = 5;

    /**
     * 카카오 인증번호 전송
     */
    @Transactional
    public Map<String, Object> sendKakaoVerification(String phone, String name) {
        if (phone == null || phone.isBlank()) {
            throw ApiException.badRequest("전화번호를 입력해주세요.");
        }

        // Rate limit
        long recentCount = verificationSessionRepository.countByPhoneAndCreatedAtAfter(
                phone, LocalDateTime.now().minusHours(1));
        if (recentCount >= MAX_REQUESTS_PER_HOUR) {
            throw ApiException.tooManyRequests("인증 요청이 너무 많습니다. 1시간 후 다시 시도해주세요.");
        }

        String code = generateCode();
        String codeHash = hashCode(code);

        verificationSessionRepository.save(VerificationSession.builder()
                .phone(phone)
                .name(name)
                .codeHash(codeHash)
                .expiresAt(LocalDateTime.now().plusMinutes(EXPIRY_MINUTES))
                .build());

        // TODO: 실제 카카오 알림톡 API로 인증번호 발송
        log.info("인증번호 발송: phone={}, code={}", phone, code);

        return Map.of("success", true, "expiresIn", EXPIRY_MINUTES * 60);
    }

    /**
     * 카카오 인증번호 확인
     */
    @Transactional
    public Map<String, Object> verifyKakaoCode(String phone, String code) {
        VerificationSession session = verificationSessionRepository
                .findTopByPhoneAndExpiresAtAfterOrderByCreatedAtDesc(phone, LocalDateTime.now())
                .orElseThrow(() -> ApiException.badRequest("인증 세션이 만료되었거나 존재하지 않습니다."));

        if (session.getAttempts() >= MAX_ATTEMPTS) {
            throw ApiException.tooManyRequests("인증 시도 횟수를 초과했습니다. 새로운 인증번호를 요청해주세요.");
        }

        session.setAttempts(session.getAttempts() + 1);
        verificationSessionRepository.save(session);

        String codeHash = hashCode(code);
        if (!codeHash.equals(session.getCodeHash())) {
            throw ApiException.badRequest("인증번호가 일치하지 않습니다.");
        }

        return Map.of("success", true, "verified", true);
    }

    /**
     * 본인인증 요청
     */
    @Transactional
    public Map<String, Object> requestIdentityVerification(String firebaseUid, String phone, String name) {
        // 인증번호 발송과 동일한 로직
        return sendKakaoVerification(phone, name);
    }

    /**
     * 본인인증 확인 및 사용자 정보 업데이트
     */
    @Transactional
    public Map<String, Object> confirmIdentityVerification(String firebaseUid, String phone, String code, String name, String birth) {
        Map<String, Object> verifyResult = verifyKakaoCode(phone, code);

        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));

        user.setIdentityVerified(true);
        user.setIdentityVerifiedAt(LocalDateTime.now());
        user.setVerifiedName(name);
        user.setVerifiedPhone(phone);
        user.setVerifiedBirth(birth);
        userRepository.save(user);

        return Map.of("success", true, "verified", true);
    }

    private String generateCode() {
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(random.nextInt(10));
        }
        return sb.toString();
    }

    private String hashCode(String code) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(code.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}
