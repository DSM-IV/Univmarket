package com.univmarket.service;

import com.univmarket.entity.Material;
import com.univmarket.entity.Review;
import com.univmarket.entity.User;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.MaterialRepository;
import com.univmarket.repository.PurchaseRepository;
import com.univmarket.repository.ReviewRepository;
import com.univmarket.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReviewService {

    private final UserRepository userRepository;
    private final MaterialRepository materialRepository;
    private final PurchaseRepository purchaseRepository;
    private final ReviewRepository reviewRepository;

    /**
     * 리뷰 작성
     */
    @Transactional
    public Review submitReview(String firebaseUid, Long materialId, int rating, String content) {
        if (rating < 1 || rating > 5) {
            throw ApiException.badRequest("평점은 1~5 사이여야 합니다.");
        }
        if (content == null || content.trim().isEmpty() || content.length() > 1000) {
            throw ApiException.badRequest("리뷰 내용은 1~1000자여야 합니다.");
        }

        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));
        Material material = materialRepository.findById(materialId)
                .orElseThrow(() -> ApiException.notFound("자료를 찾을 수 없습니다."));

        // 구매 확인
        if (!purchaseRepository.existsByBuyerIdAndMaterialId(user.getId(), materialId)) {
            throw ApiException.badRequest("구매한 자료에만 리뷰를 작성할 수 있습니다.");
        }

        // 중복 리뷰 확인
        if (reviewRepository.existsByUserIdAndMaterialId(user.getId(), materialId)) {
            throw ApiException.conflict("이미 리뷰를 작성했습니다.");
        }

        return reviewRepository.save(Review.builder()
                .user(user)
                .material(material)
                .rating(rating)
                .content(content.trim())
                .build());
    }

    /**
     * 자료별 리뷰 통계
     */
    @Transactional(readOnly = true)
    public Map<Long, Map<String, Object>> getReviewStats(List<Long> materialIds) {
        Map<Long, Map<String, Object>> result = new HashMap<>();

        for (Long materialId : materialIds) {
            List<Review> reviews = reviewRepository.findByMaterialIdOrderByCreatedAtDesc(
                    materialId,
                    org.springframework.data.domain.PageRequest.of(0, 1000)
            ).getContent();

            if (reviews.isEmpty()) {
                result.put(materialId, Map.of("count", 0, "average", 0.0));
            } else {
                double avg = reviews.stream().mapToInt(Review::getRating).average().orElse(0.0);
                result.put(materialId, Map.of("count", reviews.size(), "average", Math.round(avg * 10.0) / 10.0));
            }
        }

        return result;
    }
}
