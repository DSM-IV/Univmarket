package com.univmarket.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 이니시스 환불(PR3) 순수 단위테스트 — Spring 컨텍스트/DB 불필요.
 * package-private static 유틸(sha512Hex, buildRefundHashPlain, isFullRefund, computeInicisRefundPlan)만 검증한다.
 */
class InicisRefundTest {

    // 공식 문서 골든 벡터 (전체취소 Refund)
    private static final String API_KEY = "ItEQKi3rY7uvDS8l";
    private static final String TIMESTAMP = "20191128121211";
    private static final String CLIENT_IP = "123.123.123.123";
    private static final String MID = "INIpayTest";
    private static final String TID = "StdpayCARDINIpayTest20191128121211123456";
    private static final String GOLDEN_PLAIN =
            "ItEQKi3rY7uvDS8lRefundCard20191128121211123.123.123.123INIpayTestStdpayCARDINIpayTest20191128121211123456";
    private static final String GOLDEN_HASH =
            "b2dc4d4308d836a77187fa1f4ce8c540006a41e6a708a63aded363510c7d4456"
            + "00601c9035825fe32f48fe1b7d2ea130f690a2895a41b6fa0a99c6c5f92d6d69";

    // ── 1. SHA-512 골든 벡터 ──
    @Test
    void sha512Hex_matchesOfficialGoldenVector() {
        assertThat(InicisPaymentService.sha512Hex(GOLDEN_PLAIN)).isEqualTo(GOLDEN_HASH);
    }

    // ── 2. hashData 평문 연접 순서 ──
    @Test
    void buildRefundHashPlain_refund_concatenatesInSpecOrder() {
        String plain = InicisPaymentService.buildRefundHashPlain(
                API_KEY, "Refund", "Card", TIMESTAMP, CLIENT_IP, MID, TID, null, null);
        // key + type + paymethod + timestamp + clientIp + mid + tid (전체취소: price/confirmPrice 없음)
        assertThat(plain).isEqualTo(GOLDEN_PLAIN);
    }

    @Test
    void buildRefundHashPlain_refund_thenHash_matchesGolden() {
        String plain = InicisPaymentService.buildRefundHashPlain(
                API_KEY, "Refund", "Card", TIMESTAMP, CLIENT_IP, MID, TID, null, null);
        assertThat(InicisPaymentService.sha512Hex(plain)).isEqualTo(GOLDEN_HASH);
    }

    @Test
    void buildRefundHashPlain_partial_appendsPriceThenConfirmPrice() {
        String plain = InicisPaymentService.buildRefundHashPlain(
                API_KEY, "PartialRefund", "Card", TIMESTAMP, CLIENT_IP, MID, TID, 1000L, 500L);
        // 부분취소: key + type + paymethod + timestamp + clientIp + mid + tid + price + confirmPrice
        assertThat(plain).isEqualTo(
                API_KEY + "PartialRefund" + "Card" + TIMESTAMP + CLIENT_IP + MID + TID + "1000" + "500");
    }

    @Test
    void buildRefundHashPlain_partial_priceOrderMatters() {
        // price/confirmPrice 순서가 뒤바뀌면 평문이 달라진다(회귀 방지).
        String correct = InicisPaymentService.buildRefundHashPlain(
                API_KEY, "PartialRefund", "Card", TIMESTAMP, CLIENT_IP, MID, TID, 1000L, 500L);
        String swapped = InicisPaymentService.buildRefundHashPlain(
                API_KEY, "PartialRefund", "Card", TIMESTAMP, CLIENT_IP, MID, TID, 500L, 1000L);
        assertThat(correct).isNotEqualTo(swapped);
    }

    // ── 3. 금액 계산 / 전체 vs 부분 판정 ──
    @Test
    void singleMaterialOrder_fullCancel_isFullRefund() {
        PaymentService.InicisRefundPlan plan =
                PaymentService.computeInicisRefundPlan(1000, 0, 1000);
        assertThat(plan.remainAfterCancel()).isZero();
        assertThat(plan.firstCancel()).isTrue();
        assertThat(InicisPaymentService.isFullRefund(plan.firstCancel(), plan.remainAfterCancel())).isTrue();
    }

    @Test
    void multiMaterialOrder_firstOfMany_isPartialWithRemainder() {
        // 총 3000, 아직 환불 없음, 이번에 1000 취소 → 부분취소, 남는 금액 2000
        PaymentService.InicisRefundPlan plan =
                PaymentService.computeInicisRefundPlan(3000, 0, 1000);
        assertThat(plan.remainAfterCancel()).isEqualTo(2000);
        assertThat(plan.firstCancel()).isTrue();
        assertThat(InicisPaymentService.isFullRefund(plan.firstCancel(), plan.remainAfterCancel())).isFalse();
    }

    @Test
    void multiMaterialOrder_middleCancel_isPartial() {
        // 총 3000, 이미 1000 환불됨, 이번에 1000 취소 → 부분취소, 남는 금액 1000
        PaymentService.InicisRefundPlan plan =
                PaymentService.computeInicisRefundPlan(3000, 1000, 1000);
        assertThat(plan.remainAfterCancel()).isEqualTo(1000);
        assertThat(plan.firstCancel()).isFalse();
        assertThat(InicisPaymentService.isFullRefund(plan.firstCancel(), plan.remainAfterCancel())).isFalse();
    }

    @Test
    void multiMaterialOrder_lastCancel_remainZeroButNotFirst_isStillPartial() {
        // 총 3000, 이미 2000 환불됨, 마지막 1000 취소 → 남는 금액 0 이지만 첫 취소가 아니므로 PartialRefund(confirmPrice=0)
        PaymentService.InicisRefundPlan plan =
                PaymentService.computeInicisRefundPlan(3000, 2000, 1000);
        assertThat(plan.remainAfterCancel()).isZero();
        assertThat(plan.firstCancel()).isFalse();
        assertThat(InicisPaymentService.isFullRefund(plan.firstCancel(), plan.remainAfterCancel())).isFalse();
    }

    @Test
    void overRefund_producesNegativeRemainder_forCallerToReject() {
        // 데이터 이상: 총 1000인데 이미 1000 환불 + 또 500 취소 시도 → 음수(호출측이 예외 처리)
        PaymentService.InicisRefundPlan plan =
                PaymentService.computeInicisRefundPlan(1000, 1000, 500);
        assertThat(plan.remainAfterCancel()).isNegative();
    }
}
