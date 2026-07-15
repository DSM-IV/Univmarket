# 이니시스(INIStdPay) 결제 연동 설계

> 현재 결제는 Toss SDK 기반(테스트 모드). 이니시스 결제 가맹 진행 + MID 발급(`unifiles25`)에 따라
> **PG 어댑터를 Toss → 이니시스로 교체**한다. PG 무관 코어(Checkout / CheckoutTxService / 자료지급)는 보존.

## 0. 보존 vs 교체

| 보존 (PG 무관) | 교체 (Toss → 이니시스) |
|---|---|
| `Checkout` 엔티티 | 결제창 호출: Toss SDK → INIStdPay |
| `createCheckoutSession`(자료검증·금액·oid·pending) | 승인: `callTossConfirm`(paymentKey) → `callInicisApprove`(authToken+authUrl) |
| `CheckoutTxService`(beginConfirm 멱등 / markCompleted 앵커) | 취소/환불: `cancelTossPayment` → INIAPI(인증서 mcert/mpriv/keypass) |
| 자료 지급(`grantMaterials`, 멱등) | 성공 흐름: 클라 confirm → **서버 returnUrl** |

## 1. 핵심 구조 차이

- **Toss**: 결제 성공 → 클라가 `successUrl`로 와서 `paymentKey`를 `/checkout/confirm`에 POST → 서버 승인
- **이니시스**: 결제 성공 → 브라우저가 **백엔드 `returnUrl`로 직접 POST** → 서버가 거기서 승인 → 브라우저를 SPA 결과페이지로 302 redirect

영향:
1. 승인 로직이 클라 트리거 → **서버 returnUrl**로 이동 (클라가 승인 스킵 불가 → 더 안전)
2. returnUrl POST엔 **Firebase 토큰 없음** → 사용자 식별을 `oid → Checkout → owner`로. 신뢰 앵커 = 이니시스 서명 + 서버가 만든 Checkout 레코드
3. `PurchaseSuccessPage`는 "confirm 호출" → "결과 표시"로 단순화

## 2. 결제 플로우

### ① prepare (결제창 파라미터)
- `POST /api/payments/inicis/prepare` → `createPendingCheckout`(자료검증 + Checkout pending 저장, PG무관) → INIStdPay 서명 파라미터 생성
- 파라미터: `version=1.0`, `mid=unifiles25`, `oid`, `price`, `timestamp`, `signature=SHA256("oid=&price=&timestamp=")`, `mKey=SHA256(signKey)`, `currency=WON`, `goodname`, `buyername/tel/email`, `returnUrl`, `closeUrl`, `gopaymethod`
- 프론트: 숨은 form + `INIStdPay.js` 로드 + `INIStdPay.pay(formId)`

### ② returnUrl (서버 승인)
- `POST /api/payments/inicis/return` (인증 없음)
  1. `resultCode != "0000"` → `/purchase/fail` redirect
  2. `oid`로 Checkout 로드 → owner 식별
  3. 멱등 확정(기존 골격 재사용): `beginConfirm(owner, oid, price)` → not completed면 **승인요청** `POST {authUrl} {mid, authToken, timestamp, signature=SHA256("authToken=&timestamp="), charset=UTF-8, format=JSON}` → `resultCode="0000"` & price 일치 검증 → `tid` 추출 → `markCompleted(oid, tid)` (저장 실패 시 **망취소** `netCancelUrl`) → `grantMaterials`
  4. 브라우저 302 redirect → 성공 `/purchase/success?orderId=` / 실패 `/purchase/fail`

### ③ 결과 표시
- `PurchaseSuccessPage`: confirm 호출 제거 → orderId로 지급결과 가벼운 GET 조회 or redirect 쿼리로 표시

## 3. 취소/환불 (INIAPI)
- `cancelTossPayment(paymentKey,…)` → `cancelInicisPayment(tid, amount, reason)`: INIAPI 환불(인증서 mcert/mpriv/keypass 서명, `manual.inicis.com` 기준). 부분취소 파라미터 확인.
- 호출부 `refundPurchase` / `AdminService.approveDefectReport` — 시그니처 맞추면 최소 변경

## 4. 엔티티/DB (스키마 변경 거의 없음)
- `Checkout.paymentKey` → 이니시스 `tid` 저장 (컬럼 재사용, 의미만 PG중립)
- `Purchase.toss_payment_key` → `tid` 저장 (환불이 tid 기반이라 매핑 유지 필수)

## 5. 설정/시크릿 (백엔드 env only)
```
payment.inicis.mid=unifiles25
payment.inicis.sign-key=<가맹점관리자 발급>     # INIStdPay 서명
payment.inicis.iniapi-key=<가맹점관리자 발급>   # 환불
payment.inicis.cert-path / key-path / keypass   # mcert/mpriv/keypass (환불)
payment.inicis.return-base=https://unifile.store
```
- ⚠️ 키파일은 EC2 서버에만. git·프론트 절대 금지.
- 테스트: 이니시스 테스트 MID `INIpayTest` + 공개 signkey `SU5JTElURV9UUklQTEVERVNfS0VZU1RS` 로 e2e → 실 MID 전환

## 6. 작업 순서 (PR 분할)
1. ✅ **백엔드 어댑터** — prepare 서명 + returnUrl 승인 + 망취소 작성·컴파일 통과. (e2e 미실시 — 공개 returnUrl 필요)
   - 신규: `service/InicisPaymentService.java`, `controller/InicisPaymentController.java`
   - 수정: `PaymentService`(createPendingCheckout 추출·grantMaterials 공개), `SecurityConfig`(/inicis/return permitAll), `application.yml`(payment.inicis.* + app.backend-url)
2. **프론트** — checkoutService → INIStdPay + SuccessPage 단순화
3. **환불** — INIAPI 교체
4. 실 MID 전환 + 배포 (Toss 코드는 검증 후 제거 — 롤백 여지 유지)

## 7. 주의
- 이니시스 실 MID 최종 활성화는 통신판매업 신고번호 필요할 수 있음 → 은행/신고 트랙 병행
- 키/서명 값은 절대 로그·커밋·프론트 노출 금지
