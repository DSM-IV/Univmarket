package com.univmarket.controller;

import com.univmarket.entity.Notification;
import com.univmarket.entity.Purchase;
import com.univmarket.entity.Transaction;
import com.univmarket.entity.User;
import com.univmarket.security.FirebaseUserPrincipal;
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
     * 구매목록 조회
     */
    @GetMapping("/me/purchases")
    public ResponseEntity<List<Purchase>> getPurchases(
            @AuthenticationPrincipal FirebaseUserPrincipal principal) {
        List<Purchase> purchases = userService.getPurchases(principal.getUid());
        return ResponseEntity.ok(purchases);
    }

    /**
     * 알림 목록 조회
     */
    @GetMapping("/me/notifications")
    public ResponseEntity<Page<Notification>> getNotifications(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<Notification> notifications = userService.getNotifications(principal.getUid(), page, size);
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
