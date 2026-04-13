package com.univmarket.controller;

import com.univmarket.entity.RaffleEntry;
import com.univmarket.security.FirebaseUserPrincipal;
import com.univmarket.service.RaffleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/raffle")
@RequiredArgsConstructor
public class RaffleController {

    private final RaffleService raffleService;

    /**
     * 래플 응모
     */
    @PostMapping("/enter")
    public ResponseEntity<Map<String, Object>> enterRaffle(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestBody Map<String, Object> body) {
        String productId = (String) body.get("productId");
        int count = body.containsKey("count") ? ((Number) body.get("count")).intValue() : 1;
        Map<String, Object> result = raffleService.enterRaffle(principal.getUid(), productId, count);
        return ResponseEntity.ok(result);
    }

    /**
     * 내 래플 응모 내역
     */
    @GetMapping("/my-entries")
    public ResponseEntity<List<RaffleEntry>> getMyEntries(
            @AuthenticationPrincipal FirebaseUserPrincipal principal) {
        List<RaffleEntry> entries = raffleService.getMyEntries(principal.getUid());
        return ResponseEntity.ok(entries);
    }
}
