# UniFile 시스템 아키텍처

```mermaid
flowchart TB
  User["사용자 (브라우저)"]
  CF_DNS["Cloudflare DNS<br/>(unifile.store + api 서브도메인)"]
  FB_Auth["Firebase Auth<br/>(ID Token 발급)"]

  subgraph Frontend["프론트엔드 (Firebase Hosting)"]
    React["React + Vite SPA<br/>Tailwind + shadcn/ui<br/>https://unifile.store"]
  end

  subgraph Lightsail["AWS Lightsail VM (Seoul, $10/mo)"]
    direction TB
    Caddy["Caddy 리버스 프록시<br/>port 80/443<br/>Let's Encrypt 자동 TLS<br/>HSTS + 보안 헤더"]

    subgraph SpringApp["Spring Boot 3.3 / Java 21 (port 8080)"]
      direction TB
      Filters["Filter Chain<br/>1. RateLimitFilter (Bucket4j)<br/>2. FirebaseAuthFilter<br/>3. Spring Security (URL/role)"]
      Layer["Controllers / Services<br/>EncryptionService AES-256-GCM<br/>(계좌번호 등 PIPA 데이터)"]
      Filters --> Layer
    end

    Postgres["PostgreSQL 16<br/>(영속 데이터)"]
    Redis["Redis 7<br/>(캐시 + Rate Limit 카운터)"]

    Caddy --> Filters
    Layer --> Postgres
    Layer --> Redis
  end

  R2["Cloudflare R2<br/>(자료 파일 저장)"]
  VT["VirusTotal API<br/>(파일 바이러스 검사<br/>fail-secure)"]

  User -->|"DNS 조회"| CF_DNS
  CF_DNS -->|"unifile.store"| React
  CF_DNS -->|"api.unifile.store<br/>(DNS only / 13.124.0.125)"| Caddy
  React -->|"로그인"| FB_Auth
  FB_Auth -.->|"ID Token (Bearer)"| Filters
  React -->|"API 호출 + Token"| Caddy
  Layer -->|"파일 업로드/다운로드"| R2
  Layer -->|"업로드 시 파일 검사"| VT
```

## 핵심 요약

| 영역 | 주요 기술/특징 |
|---|---|
| **프론트** | Firebase Hosting, React+Vite SPA, Tailwind |
| **DNS** | Cloudflare (api는 DNS only — Caddy로 직접) |
| **엣지** | Caddy 리버스 프록시, Let's Encrypt 자동 갱신 |
| **앱** | Spring Boot 3.3, 3-단계 Filter Chain |
| **인증** | Firebase Auth → ID Token → Spring 검증 (stateless) |
| **데이터** | Postgres (영속) + Redis (캐시·RateLimit) — 같은 docker network |
| **파일** | R2 (저장) + VirusTotal (검사, fail-secure) |
| **암호화** | 계좌번호 등 민감정보 AES-256-GCM (`ENCRYPTION_KEY` env) |
| **배포** | 단일 Lightsail VM, docker compose, $10/월 |
