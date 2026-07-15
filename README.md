# Unifile (유니파일)

🔗 **서비스** : https://unifile.store

대학 강의자료(필기·요약·기출 등)를 학생끼리 직접 사고팔 수 있는
C2C 거래 플랫폼입니다.

## 주요 기능
- 학습자료 업로드 · 검색 · 상세 조회
- 장바구니 · 결제(토스페이먼츠, 카카오페이) · 판매자 정산
- 구매 검증 기반 리뷰 · 평점 시스템
- 자료 요청 게시판, 알림, 신고/관리자 기능

## 기술 스택
- **Frontend** : React, TypeScript, Vite
- **Backend** : Java, Spring Boot (REST API)
- **Database** : Cloud Firestore, PostgreSQL
- **Infra** : Firebase (Auth · Cloud Functions · Hosting),
  AWS Lightsail + Caddy(자동 TLS), Docker

## 아키텍처 특징
- Firestore 보안 규칙으로 금전·통계 필드 클라이언트 조작 차단
- 결제 검증 · 정산 · 출금 등 민감 로직은 Cloud Functions에서만 처리
- 관리자 권한 분리 및 감사 로그(admin_logs) 운영

## 프로젝트 구조
- `src/` — 프론트엔드 (React + TS)
- `backend/` — 백엔드 (Spring Boot)
- `functions/` — Firebase Cloud Functions

## 맡은 부분
(팀이면 본인 담당만 / 혼자면 전체 기획·개발)
