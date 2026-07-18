package com.univmarket.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.univmarket.entity.Checkout;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.CheckoutRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

import java.net.InetAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 이니시스 INIStdPay 결제 어댑터.
 *
 * <p>코어(Checkout 생성 / 멱등 확정 / 자료 지급)는 {@link PaymentService} · {@link CheckoutTxService}를
 * 그대로 재사용하고, 이 클래스는 "이니시스에 특화된 부분"만 담당한다:
 * <ul>
 *   <li>preparePayment — 결제창 서명 파라미터(signature/verification/mKey) 생성</li>
 *   <li>handleReturn  — 이니시스 returnUrl POST 처리 = 서버 승인 + 자료 지급(멱등) + 실패 시 망취소</li>
 * </ul>
 *
 * <p>Toss와의 핵심 차이: Toss는 클라가 successUrl로 와서 confirm을 호출하지만, 이니시스는
 * 브라우저가 백엔드 returnUrl로 직접 POST하고 그 안에서 서버가 승인한다. returnUrl엔 Firebase
 * 토큰이 없으므로 사용자는 oid→Checkout으로 식별한다.
 *
 * <p>⚠️ 서명/응답 필드명은 manual.inicis.com 기준으로 e2e 시 교차검증할 것.
 */
@Slf4j
@Service
public class InicisPaymentService {

    private final PaymentService paymentService;
    private final CheckoutTxService checkoutTxService;
    private final CheckoutRepository checkoutRepository;
    private final ObjectMapper objectMapper;

    private final String mid;
    private final String signKey;
    private final String backendUrl;
    private final String frontendUrl;
    private final String iniapiBase;
    private final String iniapiKey;
    private final String clientIp;
    private final WebClient inicisClient;

    public InicisPaymentService(
            PaymentService paymentService,
            CheckoutTxService checkoutTxService,
            CheckoutRepository checkoutRepository,
            ObjectMapper objectMapper,
            @Value("${payment.inicis.mid:INIpayTest}") String mid,
            @Value("${payment.inicis.sign-key:SU5JTElURV9UUklQTEVERVNfS0VZU1RS}") String signKey,
            @Value("${app.backend-url:https://api.unifile.store}") String backendUrl,
            @Value("${app.frontend-url:https://unifile.store}") String frontendUrl,
            @Value("${payment.inicis.iniapi-base:https://iniapi.inicis.com}") String iniapiBase,
            @Value("${payment.inicis.api-key:ItEQKi3rY7uvDS8l}") String iniapiKey,
            @Value("${payment.inicis.client-ip:}") String clientIp) {
        this.paymentService = paymentService;
        this.checkoutTxService = checkoutTxService;
        this.checkoutRepository = checkoutRepository;
        this.objectMapper = objectMapper;
        this.mid = mid;
        this.signKey = signKey;
        this.backendUrl = backendUrl;
        this.frontendUrl = frontendUrl;
        this.iniapiBase = iniapiBase;
        this.iniapiKey = iniapiKey;
        this.clientIp = clientIp;
        this.inicisClient = WebClient.builder().build();
    }

    /**
     * 결제창 파라미터 생성. 자료 검증 + Checkout(pending) 저장(PaymentService 재사용) 후
     * INIStdPay에 넘길 서명 파라미터 일체를 반환한다. 프론트는 이걸 숨은 form으로 만들어
     * INIStdPay.pay(formId)를 호출한다.
     */
    public Map<String, Object> preparePayment(String firebaseUid, List<Long> materialIds,
                                              String buyerName, String buyerTel, String buyerEmail) {
        Map<String, Object> session = paymentService.createPendingCheckout(firebaseUid, materialIds);
        String oid = (String) session.get("orderId");
        long price = ((Number) session.get("amount")).longValue();
        String goodName = (String) session.get("orderName");

        String timestamp = String.valueOf(System.currentTimeMillis());
        String signature = sha256Hex("oid=" + oid + "&price=" + price + "&timestamp=" + timestamp);
        String verification = sha256Hex("oid=" + oid + "&price=" + price + "&signKey=" + signKey + "&timestamp=" + timestamp);
        String mKey = sha256Hex(signKey);

        Map<String, Object> params = new LinkedHashMap<>();
        params.put("version", "1.0");
        params.put("mid", mid);
        params.put("oid", oid);
        params.put("price", price);
        params.put("timestamp", timestamp);
        params.put("signature", signature);
        params.put("verification", verification);
        params.put("mKey", mKey);
        params.put("currency", "WON");
        params.put("goodName", goodName);
        params.put("buyerName", isBlank(buyerName) ? "구매자" : buyerName);
        params.put("buyerTel", buyerTel == null ? "" : buyerTel);
        params.put("buyerEmail", buyerEmail == null ? "" : buyerEmail);
        params.put("returnUrl", backendUrl + "/api/payments/inicis/return");
        params.put("closeUrl", frontendUrl + "/purchase/fail?reason=closed");
        params.put("gopaymethod", "Card");
        return params;
    }

    /**
     * 이니시스 인증결과(returnUrl POST) 처리.
     * 인증성공 검증 → 서버 승인(callInicisApprove) → 완료표시 → 자료 지급. 모두 멱등.
     * 승인 후 완료표시가 실패하면 망취소로 청구를 되돌린다.
     *
     * @return 브라우저를 보낼 SPA 결과 URL(성공/실패)
     */
    public String handleReturn(Map<String, String> p) {
        String resultCode = p.get("resultCode");
        String oid = p.get("orderNumber");

        if (isBlank(oid)) {
            log.error("[이니시스] returnUrl에 orderNumber 없음 (keys={})", p.keySet());
            return failUrl(null, "invalid");
        }
        if (!"0000".equals(resultCode)) {
            log.warn("[이니시스] 인증 실패 (oid={}, code={}, msg={})", oid, resultCode, p.get("resultMsg"));
            return failUrl(oid, "auth");
        }

        Checkout checkout = checkoutRepository.findByOrderId(oid).orElse(null);
        if (checkout == null) {
            log.error("[이니시스] Checkout 없음 (oid={})", oid);
            return failUrl(oid, "notfound");
        }
        String firebaseUid = checkout.getUser().getFirebaseUid();
        long price = checkout.getAmount().longValue();

        try {
            CheckoutTxService.ConfirmContext ctx = checkoutTxService.beginConfirm(firebaseUid, oid, price);

            String tid = ctx.alreadyCompleted()
                    ? ctx.paymentKey() // 이미 완료된 결제 — 이전에 저장한 tid 재사용 (재청구 없음)
                    : approveAndMarkCompleted(p, oid, price);

            paymentService.grantMaterials(firebaseUid, ctx.materialIds(), tid, price, oid, "inicis");
            return frontendUrl + "/purchase/success?orderId=" + oid;
        } catch (ApiException e) {
            log.warn("[이니시스] 확정 실패 (oid={}): {}", oid, e.getMessage());
            return failUrl(oid, "confirm");
        } catch (Exception e) {
            log.error("[이니시스] 확정 오류 (oid={}): {}", oid, e.getMessage(), e);
            return failUrl(oid, "error");
        }
    }

    /**
     * 신규 결제의 승인 + 완료표시. 승인은 됐는데 완료표시 커밋이 실패하면
     * 망취소로 비가역 청구를 되돌린 뒤 예외를 다시 던진다.
     */
    private String approveAndMarkCompleted(Map<String, String> p, String oid, long price) {
        String authToken = p.get("authToken");
        String tid = callInicisApprove(p.get("authUrl"), authToken, price);
        try {
            checkoutTxService.markCompleted(oid, tid);
        } catch (Exception e) {
            log.error("[이니시스] markCompleted 실패 → 망취소 시도 (oid={}): {}", oid, e.getMessage());
            netCancel(p.get("netCancelUrl"), authToken);
            throw e;
        }
        return tid;
    }

    /**
     * 이니시스 승인요청 (returnUrl이 준 authUrl로 서버-서버 POST).
     * resultCode=0000 & 금액 일치 확인 후 tid를 반환한다. 실패 시 ApiException.
     */
    private String callInicisApprove(String authUrl, String authToken, long expectedPrice) {
        if (isBlank(authUrl) || isBlank(authToken)) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "결제 승인 정보가 없습니다.");
        }
        // SSRF 방지: authUrl은 반드시 이니시스 도메인 https. 파싱된 host로 검증해야
        // https://x.inicis.com.attacker.tld 같은 substring 우회를 막는다.
        if (!isInicisHttpsUrl(authUrl)) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "유효하지 않은 승인 URL입니다.");
        }

        String timestamp = String.valueOf(System.currentTimeMillis());
        String signature = sha256Hex("authToken=" + authToken + "&timestamp=" + timestamp);
        String verification = sha256Hex("authToken=" + authToken + "&signKey=" + signKey + "&timestamp=" + timestamp);

        Map<String, Object> res = postForm(authUrl,
                "mid", mid,
                "authToken", authToken,
                "timestamp", timestamp,
                "signature", signature,
                "verification", verification,
                "charset", "UTF-8",
                "format", "JSON");

        if (res == null || !"0000".equals(String.valueOf(res.get("resultCode")))) {
            log.error("[이니시스] 승인 거절 (oid 추정 authToken 기반): {}", res);
            throw new ApiException(HttpStatus.BAD_GATEWAY, "결제 승인이 거절되었습니다.");
        }
        long approvedPrice = parseLong(res.get("TotPrice"));
        if (approvedPrice != expectedPrice) {
            log.error("[이니시스] 승인 금액 불일치 expected={} actual={} (tid={})",
                    expectedPrice, approvedPrice, res.get("tid"));
            throw new ApiException(HttpStatus.BAD_GATEWAY, "결제 금액이 일치하지 않습니다.");
        }
        return String.valueOf(res.get("tid"));
    }

    /** 승인 후 DB 커밋 실패 시 비가역 청구를 되돌리는 망취소. 실패해도 예외를 던지지 않는다(로그만). */
    private void netCancel(String netCancelUrl, String authToken) {
        if (!isInicisHttpsUrl(netCancelUrl)) {
            log.error("[이니시스] 망취소 URL 없음/유효하지 않음 — 수동 확인 필요");
            return;
        }
        try {
            String timestamp = String.valueOf(System.currentTimeMillis());
            String signature = sha256Hex("authToken=" + authToken + "&timestamp=" + timestamp);
            String verification = sha256Hex("authToken=" + authToken + "&signKey=" + signKey + "&timestamp=" + timestamp);
            postForm(netCancelUrl,
                    "mid", mid,
                    "authToken", authToken,
                    "timestamp", timestamp,
                    "signature", signature,
                    "verification", verification,
                    "charset", "UTF-8",
                    "format", "JSON");
            log.warn("[이니시스] 망취소 실행 완료");
        } catch (Exception e) {
            log.error("[이니시스] 망취소 실패 — 수동 확인 필요: {}", e.getMessage());
        }
    }

    /**
     * INIAPI v1 환불(취소). 전체취소(Refund) / 부분취소(PartialRefund)를 모두 처리한다.
     *
     * <p>판정 규칙: {@code firstCancel && remainAfterCancel == 0} → 전체취소(Refund),
     * 그 외 → 부분취소(PartialRefund, price=이번취소액 / confirmPrice=취소 후 남는 금액).
     *
     * <p>이 요청 URL은 승인 URL 화이트리스트(isInicisHttpsUrl)와 무관하게 설정값
     * {@code payment.inicis.iniapi-base} 기반이므로(외부 응답에서 온 값이 아님) 별도 검증하지 않는다.
     *
     * @param tid              원결제 거래번호
     * @param cancelAmount     이번에 취소할 금액
     * @param remainAfterCancel 이번 취소 후 남는 금액(전체취소면 0)
     * @param firstCancel      이 tid에 대한 첫 취소인지
     * @param reason           취소 사유(80byte 초과 시 잘림)
     */
    public void refundInicisPayment(String tid, long cancelAmount, long remainAfterCancel,
                                    boolean firstCancel, String reason) {
        if (isBlank(tid)) {
            throw ApiException.badRequest("결제 키(tid)가 없어 환불할 수 없습니다.");
        }
        if (cancelAmount <= 0) {
            throw ApiException.badRequest("환불 금액이 올바르지 않습니다.");
        }
        if (remainAfterCancel < 0) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "환불 금액 계산이 올바르지 않습니다.");
        }

        boolean fullRefund = isFullRefund(firstCancel, remainAfterCancel);
        String type = fullRefund ? "Refund" : "PartialRefund";
        String paymethod = "Card";
        // 서버 TZ가 UTC일 수 있어 Asia/Seoul을 명시한다.
        String timestamp = LocalDateTime.now(ZoneId.of("Asia/Seoul"))
                .format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String ip = resolveClientIp();
        String msg = truncateToBytes(isBlank(reason) ? "구매자 요청 환불" : reason, 80);

        Long price = fullRefund ? null : cancelAmount;
        Long confirmPrice = fullRefund ? null : remainAfterCancel;

        String hashData = sha512Hex(
                buildRefundHashPlain(iniapiKey, type, paymethod, timestamp, ip, mid, tid, price, confirmPrice));

        String url = iniapiBase + "/api/v1/refund";
        Map<String, Object> res;
        if (fullRefund) {
            res = postForm(url,
                    "type", type,
                    "paymethod", paymethod,
                    "timestamp", timestamp,
                    "clientIp", ip,
                    "mid", mid,
                    "tid", tid,
                    "msg", msg,
                    "hashData", hashData);
        } else {
            res = postForm(url,
                    "type", type,
                    "paymethod", paymethod,
                    "timestamp", timestamp,
                    "clientIp", ip,
                    "mid", mid,
                    "tid", tid,
                    "price", String.valueOf(cancelAmount),
                    "confirmPrice", String.valueOf(remainAfterCancel),
                    "msg", msg,
                    "hashData", hashData);
        }

        // 성공 = resultCode "00". 그 외/무응답 = 실패. (키·hashData는 로그 금지, resultCode/resultMsg만)
        if (res == null || !"00".equals(String.valueOf(res.get("resultCode")))) {
            log.error("[이니시스] 환불 실패 (tid={}, type={}, resultCode={}, resultMsg={})",
                    tid, type,
                    res == null ? null : res.get("resultCode"),
                    res == null ? null : res.get("resultMsg"));
            throw new ApiException(HttpStatus.BAD_GATEWAY, "환불 처리에 실패했습니다.");
        }
        log.info("[이니시스] 환불 성공 (tid={}, type={}, resultCode=00)", tid, type);
    }

    /**
     * INIAPI 환불 hashData 입력 평문 생성.
     * Refund:        key + type + paymethod + timestamp + clientIp + mid + tid
     * PartialRefund: 위 + price + confirmPrice
     * (price/confirmPrice가 null이면 전체취소로 보고 두 값을 붙이지 않는다.)
     * 연접 순서 검증을 위해 package-private static 으로 분리.
     */
    static String buildRefundHashPlain(String apiKey, String type, String paymethod, String timestamp,
                                       String clientIp, String mid, String tid,
                                       Long price, Long confirmPrice) {
        StringBuilder sb = new StringBuilder()
                .append(apiKey).append(type).append(paymethod)
                .append(timestamp).append(clientIp).append(mid).append(tid);
        if (price != null && confirmPrice != null) {
            sb.append(price).append(confirmPrice);
        }
        return sb.toString();
    }

    /** 전체취소(Refund) 여부: 첫 취소이고 취소 후 남는 금액이 0. 그 외는 부분취소(PartialRefund). */
    static boolean isFullRefund(boolean firstCancel, long remainAfterCancel) {
        return firstCancel && remainAfterCancel == 0;
    }

    /** clientIp: 설정값 우선, 없으면 로컬 호스트 IP 폴백. */
    private String resolveClientIp() {
        if (!isBlank(clientIp)) {
            return clientIp;
        }
        try {
            return InetAddress.getLocalHost().getHostAddress();
        } catch (Exception e) {
            log.warn("[이니시스] clientIp 확인 실패 — 127.0.0.1 폴백: {}", e.getMessage());
            return "127.0.0.1";
        }
    }

    /** UTF-8 바이트 기준 최대 길이로 자른다(문자 경계 보존). 이니시스 msg(80byte) 제한 대응. */
    private static String truncateToBytes(String s, int maxBytes) {
        if (s == null) {
            return "";
        }
        if (s.getBytes(StandardCharsets.UTF_8).length <= maxBytes) {
            return s;
        }
        StringBuilder sb = new StringBuilder();
        int used = 0;
        for (int i = 0; i < s.length(); i++) {
            int cb = String.valueOf(s.charAt(i)).getBytes(StandardCharsets.UTF_8).length;
            if (used + cb > maxBytes) {
                break;
            }
            used += cb;
            sb.append(s.charAt(i));
        }
        return sb.toString();
    }

    /** form-urlencoded POST 후 JSON 응답을 Map으로 파싱. 이니시스의 content-type 변동에 견디도록 String→Jackson. */
    @SuppressWarnings("unchecked")
    private Map<String, Object> postForm(String url, String... kv) {
        BodyInserters.FormInserter<String> form = BodyInserters.fromFormData(kv[0], kv[1]);
        for (int i = 2; i + 1 < kv.length; i += 2) {
            form = form.with(kv[i], kv[i + 1]);
        }
        try {
            String raw = inicisClient.post()
                    .uri(url)
                    .body(form)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(Duration.ofSeconds(15));
            if (raw == null || raw.isBlank()) {
                return null;
            }
            return objectMapper.readValue(raw, Map.class);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("[이니시스] API 통신 실패 (url={}): {}", url, e.getMessage());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "결제 처리에 실패했습니다.");
        }
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(input.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "서명 생성에 실패했습니다.");
        }
    }

    /** INIAPI 환불 hashData용 SHA-512 소문자 hex. 테스트(골든 벡터)에서 호출하도록 package-private. */
    static String sha512Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-512");
            return HexFormat.of().formatHex(md.digest(input.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "서명 생성에 실패했습니다.");
        }
    }

    private String failUrl(String oid, String reason) {
        return frontendUrl + "/purchase/fail?reason=" + reason + (oid == null ? "" : "&orderId=" + oid);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    /**
     * SSRF 방지용 이니시스 URL 검증. https 스킴 + 파싱된 host가 inicis.com(또는 그 하위도메인)인지 확인한다.
     * substring 검사와 달리 https://x.inicis.com.attacker.tld, https://attacker.tld/.inicis.com 등을 모두 차단.
     */
    private static boolean isInicisHttpsUrl(String url) {
        if (isBlank(url)) {
            return false;
        }
        try {
            URI uri = URI.create(url.trim());
            if (!"https".equalsIgnoreCase(uri.getScheme())) {
                return false;
            }
            String host = uri.getHost();
            return host != null && (host.equalsIgnoreCase("inicis.com") || host.toLowerCase().endsWith(".inicis.com"));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static long parseLong(Object o) {
        if (o == null) return -1L;
        try {
            return Long.parseLong(String.valueOf(o).trim());
        } catch (NumberFormatException e) {
            return -1L;
        }
    }
}
