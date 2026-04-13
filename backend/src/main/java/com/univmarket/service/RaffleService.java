package com.univmarket.service;

import com.univmarket.entity.RaffleEntry;
import com.univmarket.entity.Transaction;
import com.univmarket.entity.User;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.RaffleEntryRepository;
import com.univmarket.repository.TransactionRepository;
import com.univmarket.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class RaffleService {

    private final UserRepository userRepository;
    private final RaffleEntryRepository raffleEntryRepository;
    private final TransactionRepository transactionRepository;

    private static final BigDecimal RAFFLE_COST = BigDecimal.valueOf(100);

    @Transactional
    public Map<String, Object> enterRaffle(String firebaseUid, String productId, int count) {
        if (count < 1 || count > 100) {
            throw ApiException.badRequest("응모 수는 1~100 사이여야 합니다.");
        }
        final int entryCount = count;

        final User initialUser = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));
        final Long userId = initialUser.getId();

        BigDecimal totalCost = RAFFLE_COST.multiply(BigDecimal.valueOf(entryCount));

        if (initialUser.getPoints().compareTo(totalCost) < 0) {
            throw ApiException.badRequest("포인트가 부족합니다.");
        }

        // 포인트 차감
        int updated = userRepository.deductPoints(userId, totalCost);
        if (updated == 0) {
            throw ApiException.badRequest("포인트가 부족합니다. (동시 처리 충돌)");
        }

        // 기존 응모가 있으면 count 추가
        RaffleEntry entry = raffleEntryRepository.findByUserIdAndProductId(userId, productId)
                .map(existing -> {
                    existing.setCount(existing.getCount() + entryCount);
                    return raffleEntryRepository.save(existing);
                })
                .orElseGet(() -> raffleEntryRepository.save(RaffleEntry.builder()
                        .user(initialUser)
                        .productId(productId)
                        .count(entryCount)
                        .build()));

        User user = userRepository.findById(userId).orElseThrow();

        // 거래내역
        transactionRepository.save(Transaction.builder()
                .user(user)
                .type("raffle_entry")
                .amount(totalCost.negate())
                .balanceAfter(user.getPoints())
                .balanceType("points")
                .description("래플 응모 (" + entryCount + "구)")
                .status("completed")
                .build());

        return Map.of(
                "success", true,
                "entryId", entry.getId(),
                "totalCount", entry.getCount(),
                "pointsUsed", totalCost
        );
    }

    @Transactional(readOnly = true)
    public List<RaffleEntry> getMyEntries(String firebaseUid) {
        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));

        return raffleEntryRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
    }
}
