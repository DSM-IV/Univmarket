# 이니시스 지급대행(분리정산) 연동 설계

> 결제(INIStdPay, `docs/inicis-integration.md`)와 별개 워크스트림. 판매자 수익금 출금을
> 수동 은행이체에서 **KG이니시스 지급대행**(서브몰 송금 대행)으로 전환한다.
> 근거 자료: 「지급대행서비스 소개서(2025) v1.1」 + [지급대행 웹매뉴얼](https://manual.inicis.com/iniweb/opmall.html).

## 0. 용어 정리 (정산 vs 지급)

| 우리 용어 | 실체 | 담당 |
|---|---|---|
| 정산 | 구매 → 판매자 귀속액 계산·확정 (`pendingEarnings` → 24h 후 `earnings`, 수수료 10%·세금 8.8%·출금수수료 500원 차감) | **우리 서버** (이미 구현: `PurchaseService.settlePendingPurchases`, `WithdrawService`) |
| 지급 | 확정된 실수령액(`received`)을 판매자 계좌로 송금 | **이니시스 지급대행** (신규 연동) |

이니시스 상품명은 "지급대행" 하나다. "분리정산/정산대행"은 이 서비스 안에서
**정산대금이 가맹점 계좌가 아닌 이니시스 자금현황 잔액에 쌓이고**, 가맹점이 지급데이터로
서브몰(판매자)·메인몰수수료(플랫폼 몫)를 각각 지급 요청하는 구조로 구현된다.

## 1. 전제 (자금 흐름)

- 지급대행의 자금 원천 = **이니시스 결제 정산대금**. 결제가 이니시스로 라이브되어야 자금현황 잔액이 쌓인다.
  Toss로 결제받으면 잔액이 없어 지급일 전일 18시까지 현금 입금(하나은행 177-910007-19004)해야 함.
  → **결제 PR2/PR3(이니시스 전환) 완료가 사실상 선행조건.**
- 플랫폼 수수료(우리 몫)는 "메인몰수수료" 지급데이터로 별도 요청해야 우리 계좌로 들어온다 (운영 절차).
- 서비스 요금: 기본요금 + 송금수수료(계약 조건: 건당 500원 or 월정액 30만/≤2,000건), 익월 10일 세금계산서 → 익월 20일까지 납부.

## 2. 이니시스 측 프로세스 (소개서 요약)

1. **서브몰 정보등록** — 판매자 사전 등록. 등록 정보: 상호, 사업자번호(**개인 판매자는 공란**), **생년월일**,
   판매자ID(가맹점이 임의생성·중복불가), 사업주, 휴대폰, 이메일, 계좌(예금주/은행/계좌번호).
   등록 시 **계좌 실명조회**로 명의 일치 검증(불일치 = 등록 실패).
2. **지급데이터 등록** — 지급일 + 판매자ID + 지급액(+계좌 스냅샷). 서브몰 등록정보와 매칭돼야 확정.
   상태 '매칭' + 저장 '저장' 건만 송금됨.
3. **송금** — 지급일(금융기관 영업일)에 이체. 실패 건은 **반려내역**으로 조회(수동 복구 대상).
4. **KYC(고객확인)** — 7일 합산(지급+환불) 1천만원 이상 서브몰만, 최초 1회. 이니시스가 SMS/메일 자동 발송,
   미이행 시 그 건 지급 불가. 기준: 사업자번호/생년월일.

### 운영 제약 (코드/운영 설계에 반영)
- **지급데이터 요청 후 지급일 전까지 해당 서브몰 정보 변경·삭제 불가.** 정보 수정 = 삭제 후 재등록.
- 수정 마감: 당일지급 13시 / 익일지급 17시(저장 후에도 재업로드 가능), KYC 마감 동일.
- 가맹점관리자 "2그룹 패스워드"가 지급데이터 확정용 2차 패스워드 — 별도 엄격 관리.

## 3. 연동 채널

| 채널 | 상태 | 용도 |
|---|---|---|
| 가맹점관리자 사이트 (단건/일괄 txt·xlsx 업로드) | 즉시 사용 가능 | Phase P0 (수동 운영) |
| 웹서버 통신 API | ⚠️ 공개 웹매뉴얼(OpMall URL Connection)은 "신규 이용신청 종료, 기존 가맹점만" 표기. 2025 소개서엔 웹서버 통신이 여전히 명시 → **현행 스펙은 기술매뉴얼(ts@kggroup.co.kr) 수령 후 확정** | Phase P1 (자동화) |

### 일괄 업로드 파일 포맷 (소개서 명시 — P0에서 사용)
- 지급데이터 txt (파이프 구분, 한 줄 1건):
  `지급일(yyyymmdd)|판매자ID|사업자번호|생년월일|지급액|예금주|은행코드|계좌번호`
- xlsx 간이 포맷: `판매자ID|지급금액` 2열 (서브몰 등록정보 자동 매칭)
- 환불데이터 txt (`MID_YYMMDD.txt`): `지급일|구매자ID|지급액|예금주|은행코드|계좌번호|환불사유` — EUC-KR, 한글 2byte 계산 주의
- 은행코드: 금융결제원 표준 2자리 (04 국민, 11 농협, 20 우리, 88 신한, 81 하나 등 — 소개서 p.26 표 참조, 프론트 은행 선택 UI에 코드 매핑 필요)

### 레거시 웹서버 API (참고 — 현행 여부 기술매뉴얼로 검증)
- 서브몰 등록/갱신: `POST https://iniweb.inicis.com/DefaultWebApp/mall/cr/open/OpMallUrlConnection.jsp`
  (`id_merchant`=MID, `id_mall`=판매자ID, `cl_id`, `no_comp`, `nm_comp`, `nm_boss`, `nm_regist`, `cd_bank`, `no_acct`, `no_tel`, `cl_gubun`=1등록/2갱신) → `resultcode/resultmsg`, EUC-KR
- 지급 요청: `.../OpMallReqUrlConnection.jsp` (`id_mall`, `dt_pay`=YYYYMMDD, `nm_regist`, `cd_bank`, `no_acct`, `amt_supply`, `cl_status`=I등록/D삭제)
- 환불 요청: `.../OpMallRefundUrlConnection.jsp`
- 송금결과 조회: `https://iniweb.inicis.com/service/open/remit_result.jsp` / 잔액: `.../remit_funds.jsp`
- 서명·인증 파라미터가 없음 → 서버 IP 등록(화이트리스트) 기반으로 추정. 기술매뉴얼에서 확인.

## 4. 현행 코드 구조 (삽입 지점)

- 수익금: `User.earnings/pendingEarnings/totalEarned` + `Purchase.settled`, 원자적 갱신은 `UserRepository.addPendingEarnings/deductEarnings`
- 출금: 전용 엔티티 없음 — `Transaction(type="withdraw")`(마스킹 계좌·수수료·상태) + `WithdrawSecret`(AES-GCM 암호화 원본 계좌, `EncryptionService`)
- **`AdminService.completeWithdrawal`은 상태 전이만 하고 실제 송금은 수동** ← 지급대행 삽입 지점
- `rejectWithdrawal` = 수익금 복구 로직 보유 (반려 처리에 재사용)
- 배치 슬롯: `ScheduledTasks`(@EnableScheduling, 매시 정산 배치 1개 존재)
- HTTP 관례: `WebClient` + `.block()`, 이니시스 SSRF 가드 `isInicisHttpsUrl`·`sha256Hex`는 `InicisPaymentService` private → 공용 유틸 추출 필요
- 출금 게이트: `betaWithdrawDisabled` 기본 true (본인인증 체크는 주석 처리 상태)

## 5. 도메인 설계 (신규/변경)

### SellerPayoutProfile (신규 엔티티 — "서브몰")
| 필드 | 비고 |
|---|---|
| userId (unique) | |
| submallId | 판매자ID. 우리가 생성 (예: `uf{userId}`), **이니시스에 등록 후 불변** |
| displayName(상호) | 개인 셀러는 성명 사용 (이니시스에 개인 표기 관례 확인) |
| businessNo | 개인은 null → 공란 전송 |
| birthDate | **신규 수집 필요** (계좌 실명조회·KYC 기준값) |
| phone, email | 기존 User에서 승계 or 입력 |
| accountHolder / bankCode / accountNumber | 계좌번호는 AES-GCM 암호화 (`EncryptionService` 재사용), 표시용 마스킹 별도 |
| status | `DRAFT` → `REGISTERED`(실명조회 통과) → `UPDATE_REQUIRED` / `FAILED` |
| kycStatus | `NONE`/`REQUIRED`/`DONE` (조회 반영) |
| registeredAt, updatedAt | |

- 서브몰 정보 변경 제약(지급 요청 후 지급일 전 변경 불가) → **미완료 지급 건 존재 시 프로필 수정 차단** 상태 머신.

### Transaction(withdraw) 확장
- `payoutStatus`: `NONE`(수동) / `QUEUED` / `SENT`(지급데이터 등록됨) / `PAID` / `RETURNED`(반려)
- `payoutDate`(dt_pay), `submallId` 스냅샷
- 기존 `status`(pending/completed/rejected)는 유지 — `PAID` 확인 시 completed, `RETURNED` 시 reject 플로우(수익금 복구) 재사용

### 프론트 변경
- 셀러 지급 프로필 등록 UI: 생년월일 + 은행 **선택**(코드 매핑) + 계좌 + 예금주. 기존 출금 신청 폼의 자유입력 은행명 대체.
- 관리자: 출금 탭에 지급대행 상태 표시, (P0) 지급데이터 파일 내보내기 버튼.

## 6. 지급 흐름 (목표 상태)

```
셀러: 지급 프로필 저장 ──▶ [P1] 서브몰 등록 API(실명조회) ──▶ REGISTERED
셀러: 출금 신청(earnings 차감, 기존 로직) ──▶ pending
관리자: 승인 ──▶ payoutStatus=QUEUED
배치(ScheduledTasks): QUEUED 건 → 지급데이터 등록(dt_pay=익영업일) ──▶ SENT
배치: 송금결과 조회 ──▶ PAID → completeWithdrawal / RETURNED → rejectWithdrawal(수익금 복구) + 알림
월 운영: 메인몰수수료 지급 요청(플랫폼 몫 인출) — 관리자 수동 or 배치
```

- 환불(구매자)은 지급대행 환불데이터가 아니라 **INIAPI 카드취소(결제 PR3)** 로 처리 — 지급대행 환불 채널은 카드취소 불가 케이스 대비 예비.
- 멱등성: 지급데이터 등록은 `(submallId, dt_pay)` 단위 — 재시도 시 중복 등록 방지 키를 Transaction에 보관.

## 7. PR 분할

| PR | 내용 | 의존성 |
|---|---|---|
| **P0 — 지급 준비(수동 운영)** | SellerPayoutProfile 엔티티+등록 UI(생년월일·은행코드), 은행코드 테이블, 관리자 "지급데이터 txt/xlsx 내보내기"(pending 출금 → 소개서 포맷, EUC-KR), 서브몰 일괄등록 파일 내보내기 | 없음 — 소개서 포맷만으로 구현 가능. 업로드·확정은 가맹점관리자에서 수동 |
| **P1 — 자동화 어댑터** | `InicisPayoutService`(서브몰 등록/갱신, 지급 등록/삭제, 결과 조회) + `ScheduledTasks` 배치 + payoutStatus 상태머신 + 반려 복구 | **기술매뉴얼**(현행 API 스펙·인증 방식) 필수 |
| **P2 — 운영 보강** | 잔액 대사(자금현황 vs 우리 원장), KYC 상태 동기화, 메인몰수수료 자동 인출, 관리자 대시보드 | P1 |

공통 선행 리팩토링: `sha256Hex`/`isInicisHttpsUrl`을 `InicisSupport`(가칭) 유틸로 추출해 결제·지급 어댑터가 공유.

## 8. 키·계정 (사용자 준비물)

| 항목 | 어디서 | 용도 |
|---|---|---|
| signkey | 가맹점관리자 | 결제 PR2 (INIStdPay) |
| INIAPI key(+iv) | 가맹점관리자 | 결제 PR3 (환불) |
| **지급대행 서비스 신청/계약** | 가맹점관리자 온라인 신청 가능 (요금제: 초기 물량은 건당제 유리) | 지급대행 활성화 |
| **기술매뉴얼 + 모듈** | ts@kggroup.co.kr (02-3430-5960) | P1 API 스펙 확정 |
| 2그룹 패스워드 설정 | 가맹점관리자 > 상점정보 > 계약정보 > 기본정보 | 지급데이터 확정 |
| 서버 IP 등록(해외IP 차단 설정 포함) | 가맹점관리자 | 웹서버 통신 허용 추정 — 매뉴얼로 확인 |

## 9. 열린 질문 (기술매뉴얼/이니시스 문의로 해소)

1. 신규 가맹점의 웹서버 통신 채널 — 레거시 OpMall API 그대로인지, 신규 API인지, 인증 방식(IP 화이트리스트? 해시키?)
2. 개인 셀러의 `nm_comp`(상호)·`no_tel` 처리 관례, 생년월일 파라미터 위치(레거시 스펙엔 없음 — 신규 스펙 확인)
3. 계좌 실명조회 결과의 동기/비동기 여부, 실패 코드 목록
4. 송금결과 조회 폴링 주기 권장값 / 콜백(webhook) 제공 여부
5. 원천징수: 현재 우리가 8.8% 원천징수 중 — 지급대행 이용 시에도 원천징수·지급명세서 의무는 가맹점(우리) 몫인지 세무사 확인 (소개서상 현금영수증·매출전표 발행 주체 = 가맹점)
6. `betaWithdrawDisabled` 해제 + 본인인증 체크 복원 시점 (지급 라이브와 함께)
