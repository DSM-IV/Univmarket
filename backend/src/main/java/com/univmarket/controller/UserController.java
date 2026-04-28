package com.univmarket.controller;

import com.univmarket.entity.Material;
import com.univmarket.entity.Notification;
import com.univmarket.entity.Purchase;
import com.univmarket.entity.Transaction;
import com.univmarket.entity.User;
import com.univmarket.security.FirebaseUserPrincipal;
import com.univmarket.service.MaterialService;
import com.univmarket.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final MaterialService materialService;

    /**
     * 프로필 생성
     */
    @PostMapping("/profile")
    public ResponseEntity<User> createProfile(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestBody Map<String, String> body) {
        User user = userService.createProfile(
                principal.getUid(),
                principal.getEmail(),
                body.get("displayName"),
                body.get("nickname"));
        return ResponseEntity.ok(user);
    }

    /**
     * 닉네임 변경
     */
    @PatchMapping("/nickname")
    public ResponseEntity<User> updateNickname(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestBody Map<String, String> body) {
        User user = userService.updateNickname(principal.getUid(), body.get("nickname"));
        return ResponseEntity.ok(user);
    }

    /**
     * 내 프로필 조회
     */
    @GetMapping("/me")
    public ResponseEntity<User> getMyProfile(
            @AuthenticationPrincipal FirebaseUserPrincipal principal) {
        User user = userService.getMyProfile(principal.getUid());
        return ResponseEntity.ok(user);
    }

    /**
     * 판매자 공개 프로필 (인증 불필요) — 닉네임 + 판매중인 자료 목록
     */
    @GetMapping("/{firebaseUid}/profile")
    public ResponseEntity<Map<String, Object>> getSellerProfile(@PathVariable String firebaseUid) {
        return ResponseEntity.ok(userService.getSellerProfile(firebaseUid));
    }

    /**
     * 거래내역 조회
     */
    @GetMapping("/me/transactions")
    public ResponseEntity<Page<Transaction>> getTransactions(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<Transaction> transactions = userService.getTransactions(principal.getUid(), page, size);
        return ResponseEntity.ok(transactions);
    }

    /**
     * 내 자료 목록 (쿨다운 체크용)
     */
    @GetMapping("/me/materials")
    public ResponseEntity<List<Material>> getMyMaterials(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(materialService.listMyMaterials(principal.getUid(), limit));
    }

    /**
     * 구매목록 조회
     */
    @GetMapping("/me/purchases")
    public ResponseEntity<List<Purchase>> getPurchases(
            @AuthenticationPrincipal FirebaseUserPrincipal principal) {
        List<Purchase> purchases = userService.getPurchases(principal.getUid());
        return ResponseEntity.ok(purchases);
    }

    /**
     * 특정 자료를 이미 구매했는지 체크 (장바구니 결제 전 중복 방지)
     */
    @GetMapping("/me/purchases/check")
    public ResponseEntity<Map<String, Boolean>> checkPurchased(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestParam("materialId") Long materialId) {
        boolean purchased = userService.hasPurchased(principal.getUid(), materialId);
        return ResponseEntity.ok(Map.of("purchased", purchased));
    }

    /**
     * 알림 목록 조회
     */
    @GetMapping("/me/notifications")
    public ResponseEntity<List<Notification>> getNotifications(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestParam(defaultValue = "30") int limit) {
        List<Notification> notifications = userService.getNotifications(principal.getUid(), limit);
        return ResponseEntity.ok(notifications);
    }

    /**
     * 알림 읽음 처리
     */
    @PatchMapping("/me/notifications/{id}/read")
    public ResponseEntity<Map<String, Boolean>> markNotificationRead(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @PathVariable Long id) {
        userService.markNotificationRead(principal.getUid(), id);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
