-- UniMarket PostgreSQL Schema
-- Spring JPA의 ddl-auto: validate를 사용하므로 이 스크립트로 수동 생성

CREATE TABLE IF NOT EXISTS users (
    id                    BIGSERIAL PRIMARY KEY,
    firebase_uid          VARCHAR(128) NOT NULL UNIQUE,
    email                 VARCHAR(255) NOT NULL,
    display_name          VARCHAR(100),
    nickname              VARCHAR(16) UNIQUE,
    university            VARCHAR(50),
    points                NUMERIC(12,0) NOT NULL DEFAULT 0,
    earnings              NUMERIC(12,0) NOT NULL DEFAULT 0,
    pending_earnings      NUMERIC(12,0) NOT NULL DEFAULT 0,
    total_earned          NUMERIC(12,0) NOT NULL DEFAULT 0,
    total_spent           NUMERIC(12,0) NOT NULL DEFAULT 0,
    role                  VARCHAR(10) NOT NULL DEFAULT 'user',
    identity_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    identity_verified_at  TIMESTAMP,
    verified_name         VARCHAR(50),
    verified_phone        VARCHAR(20),
    verified_birth        VARCHAR(6),
    banned                BOOLEAN NOT NULL DEFAULT FALSE,
    banned_at             TIMESTAMP,
    ban_reason            VARCHAR(500),
    suspended             BOOLEAN NOT NULL DEFAULT FALSE,
    suspended_until       TIMESTAMP,
    suspend_reason        VARCHAR(500),
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS materials (
    id                  BIGSERIAL PRIMARY KEY,
    author_id           BIGINT NOT NULL REFERENCES users(id),
    title               VARCHAR(200) NOT NULL,
    description         TEXT,
    price               INT NOT NULL CHECK (price >= 0 AND price <= 500000),
    subject             VARCHAR(50),
    professor           VARCHAR(50),
    category            VARCHAR(20),
    department          VARCHAR(50),
    semester            VARCHAR(20),
    file_type           VARCHAR(50),
    pages               INT NOT NULL DEFAULT 0,
    file_count          INT NOT NULL DEFAULT 0,
    file_key            VARCHAR(500),
    file_url            VARCHAR(1000),
    file_name           VARCHAR(200),
    file_size           BIGINT,
    content_type        VARCHAR(100),
    thumbnail           VARCHAR(1000),
    sales_count         INT NOT NULL DEFAULT 0,
    view_count          INT NOT NULL DEFAULT 0,
    grade_image         VARCHAR(1000),
    grade_claim         VARCHAR(10),
    grade_status        VARCHAR(20),
    verified_grade      VARCHAR(10),
    scan_status         VARCHAR(20) NOT NULL DEFAULT 'pending',
    hidden              BOOLEAN NOT NULL DEFAULT FALSE,
    copyright_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_author ON materials(author_id);
CREATE INDEX IF NOT EXISTS idx_material_created ON materials(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_material_hidden ON materials(hidden, copyright_deleted);

-- 자료 파일 목록 (다중 파일, 최대 10개)
CREATE TABLE IF NOT EXISTS material_files (
    material_id  BIGINT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    idx          INT NOT NULL,
    file_url     VARCHAR(1000),
    file_key     VARCHAR(500),
    file_name    VARCHAR(200),
    file_size    BIGINT,
    file_type    VARCHAR(50),
    PRIMARY KEY (material_id, idx)
);

-- 자료 미리보기 이미지
CREATE TABLE IF NOT EXISTS material_preview_images (
    material_id  BIGINT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    idx          INT NOT NULL,
    url          VARCHAR(1000),
    PRIMARY KEY (material_id, idx)
);

CREATE TABLE IF NOT EXISTS purchases (
    id            BIGSERIAL PRIMARY KEY,
    buyer_id      BIGINT NOT NULL REFERENCES users(id),
    seller_id     BIGINT NOT NULL REFERENCES users(id),
    material_id   BIGINT NOT NULL REFERENCES materials(id),
    price         INT NOT NULL,
    settled       BOOLEAN NOT NULL DEFAULT FALSE,
    downloaded    BOOLEAN NOT NULL DEFAULT FALSE,
    downloaded_at TIMESTAMP,
    refunded      BOOLEAN NOT NULL DEFAULT FALSE,
    refunded_at   TIMESTAMP,
    refund_reason VARCHAR(100),
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_buyer_material UNIQUE (buyer_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_purchase_buyer ON purchases(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_settled ON purchases(settled, created_at);

CREATE TABLE IF NOT EXISTS transactions (
    id                   BIGSERIAL PRIMARY KEY,
    user_id              BIGINT NOT NULL REFERENCES users(id),
    type                 VARCHAR(30) NOT NULL,
    amount               NUMERIC(12,0) NOT NULL,
    balance_after        NUMERIC(12,0),
    balance_type         VARCHAR(10),
    description          VARCHAR(500),
    status               VARCHAR(20) NOT NULL DEFAULT 'completed',
    kakaopay_tid         VARCHAR(100),
    toss_payment_key     VARCHAR(200),
    toss_payment_amount  NUMERIC(12,0),
    fee                  NUMERIC(12,0),
    commission           NUMERIC(12,0),
    tax                  NUMERIC(12,0),
    total_deduction      NUMERIC(12,0),
    received             NUMERIC(12,0),
    bank_name            VARCHAR(30),
    account_number       VARCHAR(30),
    account_holder       VARCHAR(50),
    related_material_id  BIGINT,
    related_user_id      BIGINT,
    granted_by           VARCHAR(128),
    completed_by         VARCHAR(128),
    completed_at         TIMESTAMP,
    rejected_by          VARCHAR(128),
    rejected_at          TIMESTAMP,
    reject_reason        VARCHAR(500),
    created_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_user_created ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_type_status ON transactions(type, status);

CREATE TABLE IF NOT EXISTS reviews (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id),
    material_id  BIGINT NOT NULL REFERENCES materials(id),
    rating       INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    content      VARCHAR(1000) NOT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_review_user_material UNIQUE (user_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_review_material ON reviews(material_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reports (
    id              BIGSERIAL PRIMARY KEY,
    material_id     BIGINT NOT NULL REFERENCES materials(id),
    reporter_id     BIGINT NOT NULL REFERENCES users(id),
    type            VARCHAR(20) NOT NULL,
    reason          VARCHAR(100) NOT NULL,
    description     TEXT,
    original_source VARCHAR(500),
    contact_email   VARCHAR(200),
    is_rights_holder BOOLEAN DEFAULT FALSE,
    purchase_id     BIGINT,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    resolution      VARCHAR(50),
    resolved_by     VARCHAR(128),
    resolved_at     TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_status ON reports(status, created_at DESC);

CREATE TABLE IF NOT EXISTS withdraw_secrets (
    id              BIGSERIAL PRIMARY KEY,
    transaction_id  BIGINT NOT NULL UNIQUE REFERENCES transactions(id),
    user_id         BIGINT NOT NULL,
    bank_name       VARCHAR(30) NOT NULL,
    account_number  VARCHAR(100) NOT NULL,  -- 운영에서는 AES 암호화 저장
    account_holder  VARCHAR(50) NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    type            VARCHAR(30) NOT NULL,
    title           VARCHAR(200) NOT NULL,
    message         VARCHAR(500) NOT NULL,
    material_id     BIGINT,
    material_title  VARCHAR(200),
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_logs (
    id         BIGSERIAL PRIMARY KEY,
    admin_uid  VARCHAR(128) NOT NULL,
    action     VARCHAR(50) NOT NULL,
    details    JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_log_created ON admin_logs(created_at DESC);

-- Cart (장바구니)
CREATE TABLE IF NOT EXISTS cart (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    material_id     BIGINT NOT NULL,
    title           VARCHAR(200) NOT NULL,
    price           INT NOT NULL,
    author          VARCHAR(100),
    category        VARCHAR(20),
    thumbnail       VARCHAR(1000),
    added_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cart_user_material UNIQUE (user_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_user ON cart(user_id);

-- Payment Sessions (결제 세션)
CREATE TABLE IF NOT EXISTS payment_sessions (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    type            VARCHAR(20) NOT NULL,
    amount          NUMERIC(12,0) NOT NULL,
    point_amount    NUMERIC(12,0) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    external_id     VARCHAR(200),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_session_user ON payment_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_session_external ON payment_sessions(external_id);

-- Verification Sessions (인증 세션)
CREATE TABLE IF NOT EXISTS verification_sessions (
    id              BIGSERIAL PRIMARY KEY,
    phone           VARCHAR(20) NOT NULL,
    name            VARCHAR(50),
    code_hash       VARCHAR(128) NOT NULL,
    expires_at      TIMESTAMP NOT NULL,
    attempts        INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_phone ON verification_sessions(phone);

-- Material Requests (자료 요청)
CREATE TABLE IF NOT EXISTS material_requests (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    nickname        VARCHAR(16) NOT NULL,
    subject         VARCHAR(50) NOT NULL,
    professor       VARCHAR(50),
    description     TEXT,
    category        VARCHAR(20),
    need_count      INT NOT NULL DEFAULT 1,
    status          VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_request_user ON material_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_material_request_created ON material_requests(created_at DESC);

-- Material Request Comments (자료 요청 댓글)
CREATE TABLE IF NOT EXISTS material_request_comments (
    id              BIGSERIAL PRIMARY KEY,
    request_id      BIGINT NOT NULL REFERENCES material_requests(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    nickname        VARCHAR(16) NOT NULL,
    content         VARCHAR(1000) NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mr_comment_request ON material_request_comments(request_id, created_at);

-- Raffle Entries (래플 응모)
CREATE TABLE IF NOT EXISTS raffle_entries (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    product_id      VARCHAR(100) NOT NULL,
    count           INT NOT NULL DEFAULT 1,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raffle_user ON raffle_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_raffle_product ON raffle_entries(product_id);

-- Charge Requests (계좌이체 충전 요청)
CREATE TABLE IF NOT EXISTS charge_requests (
    id                BIGSERIAL PRIMARY KEY,
    user_id           BIGINT NOT NULL REFERENCES users(id),
    email             VARCHAR(255) NOT NULL,
    amount            NUMERIC(12,0) NOT NULL,
    transfer_amount   NUMERIC(12,0) NOT NULL,
    vat               NUMERIC(12,0),
    sender_name       VARCHAR(50),
    sender_phone      VARCHAR(20),
    receipt_number    VARCHAR(100),
    receipt_type      VARCHAR(20),
    status            VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_charge_request_user ON charge_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_charge_request_status ON charge_requests(status, created_at DESC);
