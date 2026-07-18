package com.univmarket.repository;

import com.univmarket.entity.Purchase;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PurchaseRepository extends JpaRepository<Purchase, Long> {

    Optional<Purchase> findByBuyerIdAndMaterialIdAndRefundedFalse(Long buyerId, Long materialId);

    boolean existsByBuyerIdAndMaterialId(Long buyerId, Long materialId);

    // material을 같이 fetch해서 Jackson 직렬화 시점에 LazyInit 폭발 방지.
    @EntityGraph(attributePaths = {"material"})
    List<Purchase> findByBuyerIdOrderByCreatedAtDesc(Long buyerId);

    @Query("SELECT p FROM Purchase p WHERE p.settled = false AND p.createdAt < :cutoff")
    List<Purchase> findUnsettledBefore(@Param("cutoff") LocalDateTime cutoff);

    List<Purchase> findByMaterialIdAndRefundedFalse(Long materialId);

    /**
     * 같은 결제(tid)를 공유하는 다른 구매들 중 이미 환불된 건들의 price 합.
     * 이니시스 부분/전체 취소 판정 시 "이미 환불된 금액"을 구하는 데 쓴다.
     * 현재 구매(excludeId)는 제외 — 호출 시점에 이미 refunded=true 로 저장돼 있을 수 있어 이중 계산을 막는다.
     * 매칭 행이 없으면 null 반환(호출측에서 0 처리).
     */
    @Query("SELECT SUM(p.price) FROM Purchase p WHERE p.tossPaymentKey = :tid AND p.refunded = true AND p.id <> :excludeId")
    Long sumRefundedPriceByTid(@Param("tid") String tid, @Param("excludeId") Long excludeId);
}
