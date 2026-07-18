package com.univmarket.service;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.univmarket.entity.Checkout;
import com.univmarket.entity.Material;
import com.univmarket.entity.Purchase;
import com.univmarket.entity.User;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.*;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisReactiveAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.math.BigDecimal;
import java.util.List;

import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.options;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Phase 0 (E3 보강) 통합 테스트.
 * 로컬 docker-compose PostgreSQL의 전용 DB(univmarket_test, schema.sql 적용) + Toss HTTP 모킹(WireMock).
 * Firebase/보안/Redis/R2 없이 JPA + 결제 서비스 3개만 로드하는 슬라이스 컨텍스트로 구동한다.
 * 테스트 메서드는 비트랜잭션이라 서비스의 독립 트랜잭션 커밋이 그대로 검증된다(이게 핵심).
 *
 * 사전 준비: docker compose up -d postgres  →  CREATE DATABASE univmarket_test + schema.sql 적용.
 */
@SpringBootTest(classes = PaymentConfirmE3IntegrationTest.SliceConfig.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class PaymentConfirmE3IntegrationTest {

    @SpringBootConfiguration
    @EnableAutoConfiguration(exclude = {
            RedisAutoConfiguration.class,
            RedisReactiveAutoConfiguration.class,
            RedisRepositoriesAutoConfiguration.class,
            SecurityAutoConfiguration.class,
            UserDetailsServiceAutoConfiguration.class
    })
    @EntityScan("com.univmarket.entity")
    @EnableJpaRepositories("com.univmarket.repository")
    @Import({PaymentService.class, PurchaseService.class, CheckoutTxService.class})
    static class SliceConfig {
    }

    static final WireMockServer TOSS = new WireMockServer(options().dynamicPort());

    static {
        TOSS.start();
    }

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry reg) {
        reg.add("spring.datasource.url", () -> "jdbc:postgresql://localhost:5432/univmarket_test");
        reg.add("spring.datasource.username", () -> "univmarket");
        reg.add("spring.datasource.password", () -> "devpass");
        reg.add("spring.jpa.hibernate.ddl-auto", () -> "none");
        reg.add("payment.toss.secret-key", () -> "test_sk_dummy");
        reg.add("payment.toss.base-url", TOSS::baseUrl);
    }

    @Autowired PaymentService paymentService;
    @Autowired PurchaseService purchaseService;
    @Autowired UserRepository userRepository;
    @Autowired MaterialRepository materialRepository;
    @Autowired CheckoutRepository checkoutRepository;
    @Autowired PurchaseRepository purchaseRepository;
    @Autowired TransactionRepository transactionRepository;
    @Autowired NotificationRepository notificationRepository;

    @AfterAll
    static void stopWireMock() {
        TOSS.stop();
    }

    @BeforeEach
    void clean() {
        TOSS.resetAll();
        // FK 의존 순서대로 정리
        transactionRepository.deleteAll();
        notificationRepository.deleteAll();
        purchaseRepository.deleteAll();
        checkoutRepository.deleteAll();
        materialRepository.deleteAll();
        userRepository.deleteAll();
    }

    // ---------- fixtures ----------

    private User newUser(String uid) {
        return userRepository.save(User.builder()
                .firebaseUid(uid).email(uid + "@test.com").build());
    }

    private Material newMaterial(User author, int price, boolean hidden) {
        return materialRepository.save(Material.builder()
                .author(author).title("Mat-" + price).price(price).hidden(hidden).build());
    }

    private Material newMaterialWithSales(User author, int price, int sales) {
        return materialRepository.save(Material.builder()
                .author(author).title("Mat-" + price).price(price).salesCount(sales).build());
    }

    private Checkout newPendingCheckout(User buyer, String orderId, String materialIdsCsv, long amount) {
        return checkoutRepository.save(Checkout.builder()
                .user(buyer).orderId(orderId).materialIds(materialIdsCsv)
                .amount(BigDecimal.valueOf(amount)).status("pending").build());
    }

    // ---------- WireMock stubs ----------

    private void stubConfirm(int status, String body) {
        TOSS.stubFor(post(urlPathEqualTo("/v1/payments/confirm"))
                .willReturn(aResponse().withStatus(status)
                        .withHeader("Content-Type", "application/json").withBody(body)));
    }

    private void stubCancel(int status, String body) {
        TOSS.stubFor(post(urlPathMatching("/v1/payments/.*/cancel"))
                .willReturn(aResponse().withStatus(status)
                        .withHeader("Content-Type", "application/json").withBody(body)));
    }

    @SuppressWarnings("unchecked")
    private List<Long> grantedOf(java.util.Map<String, Object> result) {
        return (List<Long>) result.get("materialIds");
    }

    // ---------- tests ----------

    @Test
    void happyPath_confirmGrantsAllAndRecordsEarnings() {
        User seller = newUser("seller1");
        User buyer = newUser("buyer1");
        Material m = newMaterial(seller, 1000, false);
        newPendingCheckout(buyer, "checkout_ok", String.valueOf(m.getId()), 1000);
        stubConfirm(200, "{\"status\":\"DONE\"}");

        var result = paymentService.confirmCheckout(buyer.getFirebaseUid(), "pmt_ok", "checkout_ok", 1000);

        assertThat(grantedOf(result)).containsExactly(m.getId());
        Checkout reloaded = checkoutRepository.findByOrderId("checkout_ok").orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo("completed");
        assertThat(reloaded.getPaymentKey()).isEqualTo("pmt_ok");
        assertThat(purchaseRepository.existsByBuyerIdAndMaterialId(buyer.getId(), m.getId())).isTrue();
        User sellerR = userRepository.findById(seller.getId()).orElseThrow();
        assertThat(sellerR.getPendingEarnings()).isEqualByComparingTo(BigDecimal.valueOf(1000));
        assertThat(sellerR.getTotalEarned()).isEqualByComparingTo(BigDecimal.valueOf(1000));
        TOSS.verify(1, postRequestedFor(urlPathEqualTo("/v1/payments/confirm")));
    }

    /** E3 핵심: Toss 승인 성공 직후 한 자료 지급이 실패해도 결제 확정은 롤백되지 않는다. */
    @Test
    void e3_tossSucceeds_butOneGrantFails_paymentStaysCommitted() {
        User seller = newUser("seller2");
        User buyer = newUser("buyer2");
        Material ok = newMaterial(seller, 1000, false);
        Material hidden = newMaterial(seller, 500, true); // prepare 이후 숨김 처리된 자료 → recordPurchase가 실패
        newPendingCheckout(buyer, "checkout_e3", ok.getId() + "," + hidden.getId(), 1500);
        stubConfirm(200, "{\"status\":\"DONE\"}");

        var result = paymentService.confirmCheckout(buyer.getFirebaseUid(), "pmt_e3", "checkout_e3", 1500);

        // 결제 확정 유지 (구버전이라면 전체 롤백되어 pending + payment_key=null 이었을 것)
        Checkout reloaded = checkoutRepository.findByOrderId("checkout_e3").orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo("completed");
        assertThat(reloaded.getPaymentKey()).isEqualTo("pmt_e3");

        // 정상 자료만 지급
        assertThat(grantedOf(result)).containsExactly(ok.getId());
        assertThat(purchaseRepository.existsByBuyerIdAndMaterialId(buyer.getId(), ok.getId())).isTrue();
        assertThat(purchaseRepository.existsByBuyerIdAndMaterialId(buyer.getId(), hidden.getId())).isFalse();

        // 판매자 수익금은 지급 성공분(1000)만
        User sellerR = userRepository.findById(seller.getId()).orElseThrow();
        assertThat(sellerR.getPendingEarnings()).isEqualByComparingTo(BigDecimal.valueOf(1000));

        TOSS.verify(1, postRequestedFor(urlPathEqualTo("/v1/payments/confirm"))); // 재청구 없음
    }

    /** Toss가 ALREADY_PROCESSED_PAYMENT(이전 시도 성공)를 주면 실패가 아니라 성공으로 처리. */
    @Test
    void alreadyProcessed_treatedAsSuccess() {
        User seller = newUser("seller3");
        User buyer = newUser("buyer3");
        Material m = newMaterial(seller, 1000, false);
        newPendingCheckout(buyer, "checkout_ap", String.valueOf(m.getId()), 1000);
        stubConfirm(400, "{\"code\":\"ALREADY_PROCESSED_PAYMENT\",\"message\":\"이미 처리된 결제 입니다.\"}");

        var result = paymentService.confirmCheckout(buyer.getFirebaseUid(), "pmt_ap", "checkout_ap", 1000);

        Checkout reloaded = checkoutRepository.findByOrderId("checkout_ap").orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo("completed");
        assertThat(reloaded.getPaymentKey()).isEqualTo("pmt_ap");
        assertThat(grantedOf(result)).containsExactly(m.getId());
        assertThat(purchaseRepository.existsByBuyerIdAndMaterialId(buyer.getId(), m.getId())).isTrue();
    }

    /** Toss 일반 실패 시: checkout은 pending 유지(failed로 단정 안 함), 미지급 → 재시도 가능. */
    @Test
    void tossFailure_leavesPending_andGrantsNothing() {
        User seller = newUser("seller4");
        User buyer = newUser("buyer4");
        Material m = newMaterial(seller, 1000, false);
        newPendingCheckout(buyer, "checkout_fail", String.valueOf(m.getId()), 1000);
        stubConfirm(500, "{\"code\":\"UNKNOWN\",\"message\":\"서버 오류\"}");

        assertThrows(ApiException.class, () ->
                paymentService.confirmCheckout(buyer.getFirebaseUid(), "pmt_fail", "checkout_fail", 1000));

        Checkout reloaded = checkoutRepository.findByOrderId("checkout_fail").orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo("pending");
        assertThat(reloaded.getPaymentKey()).isNull();
        assertThat(purchaseRepository.existsByBuyerIdAndMaterialId(buyer.getId(), m.getId())).isFalse();
    }

    /** 금액 위변조: 저장 금액과 다른 amount로 confirm하면 Toss 호출 전에 거부. */
    @Test
    void amountMismatch_rejectedBeforeTossCall() {
        User seller = newUser("seller4b");
        User buyer = newUser("buyer4b");
        Material m = newMaterial(seller, 1000, false);
        newPendingCheckout(buyer, "checkout_amt", String.valueOf(m.getId()), 1000);
        stubConfirm(200, "{\"status\":\"DONE\"}");

        assertThrows(ApiException.class, () ->
                paymentService.confirmCheckout(buyer.getFirebaseUid(), "pmt_amt", "checkout_amt", 1)); // 1원으로 위조

        assertThat(checkoutRepository.findByOrderId("checkout_amt").orElseThrow().getStatus()).isEqualTo("pending");
        assertThat(purchaseRepository.existsByBuyerIdAndMaterialId(buyer.getId(), m.getId())).isFalse();
        TOSS.verify(0, postRequestedFor(urlPathEqualTo("/v1/payments/confirm"))); // Toss 미호출
    }

    /** 이미 completed인데 지급이 안 된 상태(크래시 후) → 재confirm이 재청구 없이 자료를 자가복구. */
    @Test
    void idempotentReconfirm_selfHealsGrant_withoutRecharge() {
        User seller = newUser("seller5");
        User buyer = newUser("buyer5");
        Material m = newMaterial(seller, 1000, false);
        checkoutRepository.save(Checkout.builder().user(buyer).orderId("checkout_done")
                .materialIds(String.valueOf(m.getId())).amount(BigDecimal.valueOf(1000))
                .status("completed").paymentKey("pmt_existing").build());
        stubConfirm(200, "{\"status\":\"DONE\"}"); // 호출되면 안 됨

        var result = paymentService.confirmCheckout(buyer.getFirebaseUid(), "pmt_ignored", "checkout_done", 1000);

        TOSS.verify(0, postRequestedFor(urlPathEqualTo("/v1/payments/confirm"))); // 재청구 없음
        assertThat(grantedOf(result)).containsExactly(m.getId());
        assertThat(purchaseRepository.existsByBuyerIdAndMaterialId(buyer.getId(), m.getId())).isTrue(); // 자가복구
        User sellerR = userRepository.findById(seller.getId()).orElseThrow();
        assertThat(sellerR.getPendingEarnings()).isEqualByComparingTo(BigDecimal.valueOf(1000));
    }

    /** 환불 성공: Toss cancel 호출 + 판매자 수익금 차감 + refunded 표시. */
    @Test
    void refund_success_cancelsTossAndDebitsSeller() {
        User seller = newUser("seller6");
        seller.setPendingEarnings(BigDecimal.valueOf(1000));
        seller.setTotalEarned(BigDecimal.valueOf(1000));
        userRepository.save(seller);
        User buyer = newUser("buyer6");
        Material m = newMaterialWithSales(seller, 1000, 1);
        Purchase p = purchaseRepository.save(Purchase.builder()
                .buyer(buyer).seller(seller).material(m).price(1000)
                .tossPaymentKey("pmt_ref6").tossPaymentAmount(1000L).build());
        stubCancel(200, "{\"status\":\"CANCELED\"}");

        purchaseService.refundPurchase(buyer.getFirebaseUid(), p.getId());

        Purchase reloaded = purchaseRepository.findById(p.getId()).orElseThrow();
        assertThat(reloaded.isRefunded()).isTrue();
        User sellerR = userRepository.findById(seller.getId()).orElseThrow();
        assertThat(sellerR.getPendingEarnings()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(sellerR.getTotalEarned()).isEqualByComparingTo(BigDecimal.ZERO);
        TOSS.verify(1, postRequestedFor(urlPathMatching("/v1/payments/.*/cancel")));
    }

    /** 환불 하드닝: Toss cancel 실패 시 DB 변경(차감/refunded)이 전부 롤백된다(부분상태 없음). */
    @Test
    void refund_tossCancelFails_rollsBackAllDbChanges() {
        User seller = newUser("seller7");
        seller.setPendingEarnings(BigDecimal.valueOf(1000));
        seller.setTotalEarned(BigDecimal.valueOf(1000));
        userRepository.save(seller);
        User buyer = newUser("buyer7");
        Material m = newMaterialWithSales(seller, 1000, 1);
        Purchase p = purchaseRepository.save(Purchase.builder()
                .buyer(buyer).seller(seller).material(m).price(1000)
                .tossPaymentKey("pmt_ref7").tossPaymentAmount(1000L).build());
        stubCancel(500, "{\"code\":\"ERR\",\"message\":\"취소 실패\"}");

        assertThrows(ApiException.class, () ->
                purchaseService.refundPurchase(buyer.getFirebaseUid(), p.getId()));

        Purchase reloaded = purchaseRepository.findById(p.getId()).orElseThrow();
        assertThat(reloaded.isRefunded()).isFalse();
        User sellerR = userRepository.findById(seller.getId()).orElseThrow();
        assertThat(sellerR.getPendingEarnings()).isEqualByComparingTo(BigDecimal.valueOf(1000));
        assertThat(sellerR.getTotalEarned()).isEqualByComparingTo(BigDecimal.valueOf(1000));
    }
}
