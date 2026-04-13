package com.univmarket.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class ScheduledTasks {

    private final PurchaseService purchaseService;

    /**
     * 보류 수익금 정산 (매시간 실행)
     * 24시간 경과한 미정산 구매의 판매자 보류수익금을 확정한다.
     */
    @Scheduled(cron = "0 0 * * * *") // 매 시 정각
    public void settlePendingPurchases() {
        try {
            int settled = purchaseService.settlePendingPurchases();
            if (settled > 0) {
                log.info("[정산] {}건 정산 완료", settled);
            }
        } catch (Exception e) {
            log.error("[정산] 정산 처리 중 오류", e);
        }
    }
}
