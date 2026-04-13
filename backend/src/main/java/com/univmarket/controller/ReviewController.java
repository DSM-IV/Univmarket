package com.univmarket.controller;

import com.univmarket.entity.Review;
import com.univmarket.security.FirebaseUserPrincipal;
import com.univmarket.service.ReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    /**
     * 리뷰 작성
     */
    @PostMapping
    public ResponseEntity<Review> submitReview(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestBody Map<String, Object> body) {
        Long materialId = ((Number) body.get("materialId")).longValue();
        int rating = ((Number) body.get("rating")).intValue();
        String content = (String) body.get("content");
        Review review = reviewService.submitReview(principal.getUid(), materialId, rating, content);
        return ResponseEntity.ok(review);
    }

    /**
     * 자료별 리뷰 통계
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<Long, Map<String, Object>>> getReviewStats(
            @RequestParam("materialIds") List<Long> materialIds) {
        Map<Long, Map<String, Object>> stats = reviewService.getReviewStats(materialIds);
        return ResponseEntity.ok(stats);
    }
}
