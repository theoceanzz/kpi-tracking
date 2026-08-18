-- ============================================================================
-- VÍ TIỀN THẬT (Cash Wallet) — nạp qua SePay, quy đổi sang điểm thưởng
--
-- Mỗi người dùng có một ví tiền riêng (số dư VND). Nạp bằng chuyển khoản
-- VietQR, SePay bắn webhook biến động số dư về, hệ thống đối chiếu nội dung
-- chuyển khoản với mã đơn rồi ghi có. Người dùng tự bấm quy đổi sang điểm;
-- điểm cộng vào ví điểm của chính họ. KHÔNG có rút tiền.
--
-- QUAN HỆ VỚI MODULE ĐIỂM THƯỞNG: chỉ một chiều, ví tiền -> ví điểm, và đi qua
-- đúng những hook mà V1 đã chừa sẵn (reward_transactions.external_system =
-- 'CASH_WALLET', source_type = 'EXTERNAL', khoá ext:{system}:{ref}). Không bảng
-- nào ở đây được reward_* đọc ngược lại.
--
-- BẤT BIẾN THỨ TỰ KHOÁ: luồng nào chạm cả hai ví thì LUÔN khoá ví TIỀN trước,
-- ví ĐIỂM sau. Đảo thứ tự ở một luồng mới sẽ gây deadlock với luồng quy đổi.
--
-- LƯU Ý: spring.jpa.hibernate.ddl-auto=update tự tạo cột còn thiếu nhưng KHÔNG
-- tạo CHECK / partial unique index. Mọi bảo đảm đúng đắn (chống ghi có trùng,
-- chống số dư âm, chống replay webhook) chỉ tồn tại nếu file này viết ra.
-- ============================================================================


-- ── Cấu hình ví tiền ở cấp tổ chức ──────────────────────────────────────────
-- Mặc định TẮT để không tổ chức nào bỗng dưng thấy menu lạ, giống enable_reward.
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS enable_cash_wallet    BOOLEAN NOT NULL DEFAULT FALSE,
    -- Số ĐỒNG đổi được 1 điểm. Động theo tổ chức; mỗi giao dịch quy đổi tự chụp
    -- lại tỉ giá tại thời điểm đó nên đổi tỉ giá không làm sai lịch sử cũ.
    ADD COLUMN IF NOT EXISTS point_exchange_rate   BIGINT  NOT NULL DEFAULT 1000,
    ADD COLUMN IF NOT EXISTS topup_min_amount      BIGINT  NOT NULL DEFAULT 10000,
    ADD COLUMN IF NOT EXISTS topup_max_amount      BIGINT  NOT NULL DEFAULT 50000000,
    ADD COLUMN IF NOT EXISTS topup_expire_minutes  INT     NOT NULL DEFAULT 30,
    -- Tài khoản nhận tiền. Webhook dùng để đối chiếu, FE dùng để dựng ảnh VietQR.
    ADD COLUMN IF NOT EXISTS sepay_account_number  VARCHAR(50),
    ADD COLUMN IF NOT EXISTS sepay_bank_code       VARCHAR(20),
    ADD COLUMN IF NOT EXISTS sepay_account_holder  VARCHAR(255);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_organizations_exchange_rate') THEN
        ALTER TABLE organizations ADD CONSTRAINT ck_organizations_exchange_rate
            CHECK (point_exchange_rate > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_organizations_topup_range') THEN
        ALTER TABLE organizations ADD CONSTRAINT ck_organizations_topup_range
            CHECK (topup_min_amount > 0
               AND topup_max_amount >= topup_min_amount
               AND topup_expire_minutes > 0);
    END IF;
END $$;


-- ── Ví tiền ─────────────────────────────────────────────────────────────────
-- Bản materialize để đọc nhanh. Sự thật nằm ở sổ cái cash_transactions; bất biến
-- phải luôn đúng: balance = SUM(cash_transactions.amount)
--                        = lifetime_topup - lifetime_converted
--
-- Tiền lưu bằng BIGINT ĐỒNG, không phải NUMERIC: VND không có đơn vị nhỏ hơn
-- đồng nên số nguyên là biểu diễn chính xác tuyệt đối, không có sai số làm tròn
-- và không cần chính sách rounding ở bất kỳ đâu.
CREATE TABLE IF NOT EXISTS cash_wallets (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id    UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id            UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- CÓ CHECK >= 0, khác hẳn reward_wallets. Ví điểm cho phép âm vì có đường thu
    -- hồi thưởng sau khi người nhận đã tiêu; ví tiền không có đường nào tương tự,
    -- mọi lối ra đều kiểm số dư trước khi ghi.
    balance            BIGINT      NOT NULL DEFAULT 0 CHECK (balance >= 0),
    lifetime_topup     BIGINT      NOT NULL DEFAULT 0,
    lifetime_converted BIGINT      NOT NULL DEFAULT 0,
    version            BIGINT      NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW(),
    deleted_at         TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_wallets_org_user
    ON cash_wallets(organization_id, user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cash_wallets_org ON cash_wallets(organization_id);


-- ── Sổ cái tiền: CHỈ GHI THÊM ───────────────────────────────────────────────
-- Theo đúng tiền lệ reward_transactions / cycle_unit_eval_events: không
-- updated_at, không deleted_at, không bao giờ sửa dòng đã ghi.
--
-- KHÔNG có type 'REFUND' và KHÔNG có cột reversal_of_transaction_id, dù
-- reward_transactions có cả hai. Ở đây không tồn tại luồng nào ghi vào chúng:
-- không rút tiền, không huỷ nạp, không đảo bút toán. Cột và giá trị enum không
-- ai tạo được chỉ gây hiểu nhầm khi đọc — thêm sau bằng một migration mới thì
-- rẻ, còn mang theo thứ chết ngay từ đầu thì không ai dám dọn.
--
-- ADJUST chỉ do một đường sinh ra: người có WALLET:RECONCILE ghi có tay cho một
-- giao dịch SePay không quy được về đơn nào (xem SepayReconcileService).
CREATE TABLE IF NOT EXISTS cash_transactions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id                   UUID   NOT NULL REFERENCES cash_wallets(id) ON DELETE CASCADE,
    organization_id             UUID   NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id                     UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount                      BIGINT NOT NULL CHECK (amount <> 0),
    type                        VARCHAR(20) NOT NULL
        CHECK (type IN ('TOPUP', 'CONVERT', 'ADJUST')),
    source_type                 VARCHAR(20) NOT NULL
        CHECK (source_type IN ('SEPAY', 'CONVERSION', 'MANUAL', 'SYSTEM')),
    -- Id bản ghi nghiệp vụ sinh ra bút toán: topup_orders.id hoặc
    -- sepay_webhook_events.id (khi ghi có tay từ một event).
    source_ref_id               UUID,
    -- Chống ghi trùng khi retry / bấm hai lần. Suy ra HOÀN TOÀN từ (loại nghiệp
    -- vụ, id bản ghi) — không chứa timestamp hay số ngẫu nhiên sinh phía server.
    -- Bảng đăng ký khoá đầy đủ ở CashWalletService.
    idempotency_key             VARCHAR(120) NOT NULL,
    balance_after               BIGINT NOT NULL,
    -- Chỉ có ở bút toán CONVERT: số điểm đã phát và tỉ giá tại thời điểm đó.
    points_granted              INT,
    rate_snapshot               BIGINT,
    note                        TEXT,
    actor_user_id               UUID   REFERENCES users(id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_transactions_idem
    ON cash_transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_wallet
    ON cash_transactions(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_org_user
    ON cash_transactions(organization_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_source
    ON cash_transactions(source_type, source_ref_id);


-- ── Đơn nạp tiền ────────────────────────────────────────────────────────────
-- amount là số tiền ĐỀ NGHỊ, paid_amount là số tiền THỰC NHẬN. Hai cột tách
-- nhau vì chính sách là luôn ghi có đúng số tiền thực về, kể cả khi lệch: ví là
-- số dư 1:1 chứ không phải món hàng giá cố định, và giữ tiền người dùng lại
-- trong hàng đợi đối soát chỉ vì lệch vài nghìn phí ngân hàng là sai.
--
-- CỐ Ý KHÔNG có cột sepay_event_id: ghép cặp đã có ở chiều ngược
-- (sepay_webhook_events.matched_order_id), và cột xuôi sẽ tạo khoá ngoại vòng
-- giữa hai bảng. Tệ hơn, một đơn có thể bị nhiều event trỏ vào (một cái ghi có,
-- một cái báo tiền về lần hai) nên cột đơn trị sẽ nói dối.
CREATE TABLE IF NOT EXISTS topup_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code                VARCHAR(32) NOT NULL,
    amount              BIGINT      NOT NULL CHECK (amount > 0),
    paid_amount         BIGINT,
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED')),
    qr_url              TEXT,
    bank_code           VARCHAR(20),
    bank_account_number VARCHAR(50),
    expires_at          TIMESTAMPTZ NOT NULL,
    paid_at             TIMESTAMPTZ,
    cash_transaction_id UUID        REFERENCES cash_transactions(id) ON DELETE SET NULL,
    note                TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

-- UNIQUE TOÀN CỤC, không scope theo tổ chức: webhook chỉ thấy nội dung chuyển
-- khoản, không biết org nào, nên mã phải tự nó định danh được đơn.
CREATE UNIQUE INDEX IF NOT EXISTS uq_topup_orders_code ON topup_orders(code);
CREATE INDEX IF NOT EXISTS idx_topup_orders_user
    ON topup_orders(organization_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_topup_orders_expiring
    ON topup_orders(expires_at) WHERE status = 'PENDING';


-- ── Sự kiện webhook SePay ───────────────────────────────────────────────────
-- Lưu RAW mọi callback, kể cả cái không khớp đơn nào — mất webhook là mất tiền
-- người dùng, và raw_payload là thứ duy nhất cứu được.
--
-- Bảng này KHÔNG phải append-only thuần như cash_transactions, nói rõ ra để
-- không ai tưởng nhầm. Ba nhóm cột, mỗi nhóm ghi đúng MỘT lần:
--   1. raw_payload và mọi cột trích từ nó  -> ghi lúc nhận, bất biến tuyệt đối
--   2. status / matched_order_id / amount_mismatch / error_message
--                                          -> ghi lúc xử lý tự động
--   3. resolution_*                        -> ghi khi có người xử lý tay
CREATE TABLE IF NOT EXISTS sepay_webhook_events (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Id giao dịch phía SePay. Unique để một lần gửi lại không ghi có hai lần.
    sepay_id                  BIGINT      NOT NULL,
    gateway                   VARCHAR(100),
    transaction_date          TIMESTAMPTZ,
    account_number            VARCHAR(50),
    sub_account               VARCHAR(50),
    code                      VARCHAR(64),
    content                   TEXT,
    transfer_type             VARCHAR(10),
    transfer_amount           BIGINT,
    accumulated               BIGINT,
    reference_code            VARCHAR(255),
    raw_payload               jsonb       NOT NULL,

    status                    VARCHAR(20) NOT NULL
        CHECK (status IN ('MATCHED', 'UNMATCHED', 'DUPLICATE', 'IGNORED')),
    matched_order_id          UUID        REFERENCES topup_orders(id) ON DELETE SET NULL,
    -- Tiền về lệch so với số đề nghị. Vẫn ghi có đủ, nhưng cần người xác nhận.
    amount_mismatch           BOOLEAN     NOT NULL DEFAULT FALSE,
    error_message             TEXT,

    resolved_at               TIMESTAMPTZ,
    resolved_by               UUID        REFERENCES users(id) ON DELETE SET NULL,
    resolution_note           TEXT,
    resolution_transaction_id UUID        REFERENCES cash_transactions(id) ON DELETE SET NULL,

    received_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sepay_webhook_events_sepay_id
    ON sepay_webhook_events(sepay_id);
-- Chính là HÀNG ĐỢI ĐỐI SOÁT, index thẳng vào truy vấn đó. Không có nhóm cột
-- resolution_* thì mọi dòng UNMATCHED sẽ nằm lại vĩnh viễn kể cả sau khi tiền
-- đã được ghi có bằng tay, và endpoint đối soát không bao giờ trả về sạch.
CREATE INDEX IF NOT EXISTS idx_sepay_events_queue
    ON sepay_webhook_events(received_at DESC)
    WHERE resolved_at IS NULL AND (status = 'UNMATCHED' OR amount_mismatch);
CREATE INDEX IF NOT EXISTS idx_sepay_events_order
    ON sepay_webhook_events(matched_order_id);


-- ── Quyền ───────────────────────────────────────────────────────────────────
-- Dải 2xx dùng tới 248, BSC 301-303, OKR 311-312, reward 321-329,
-- AI_QUOTA 401-402  =>  ví tiền dùng 331-334.
INSERT INTO permissions (id, code, resource, action, description) VALUES
    ('00000000-0000-0000-0000-000000000331', 'WALLET:VIEW_MY',   'WALLET', 'VIEW_MY',   'Cho phép xem ví tiền của chính mình, tạo đơn nạp tiền và quy đổi số dư sang điểm thưởng'),
    ('00000000-0000-0000-0000-000000000332', 'WALLET:VIEW',      'WALLET', 'VIEW',      'Cho phép xem ví tiền và lịch sử nạp/quy đổi của nhân sự trong phạm vi quản lý'),
    ('00000000-0000-0000-0000-000000000333', 'WALLET:CONFIG',    'WALLET', 'CONFIG',    'Cho phép cấu hình tỉ giá quy đổi điểm, tài khoản ngân hàng SePay và hạn mức nạp tiền'),
    ('00000000-0000-0000-0000-000000000334', 'WALLET:RECONCILE', 'WALLET', 'RECONCILE', 'Cho phép xử lý giao dịch SePay chưa khớp đơn, điều chỉnh số dư ví tiền và chạy đối soát sổ cái')
ON CONFLICT (code) DO NOTHING;

-- Gán theo quyền thưởng điểm đang có, thay vì chép cứng id vai trò: vai trò nào
-- đã được tin để cấu hình thưởng thì cũng được tin để cấu hình ví tiền. Nhờ vậy
-- các tổ chức đã seed từ trước nhận quyền mới đúng theo cấp bậc sẵn có.
INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, p.id
  FROM role_permissions rp
  JOIN permissions src ON src.id = rp.permission_id AND src.code = 'REWARD:CONFIG'
 CROSS JOIN permissions p
 WHERE p.code IN ('WALLET:VIEW_MY', 'WALLET:VIEW', 'WALLET:CONFIG', 'WALLET:RECONCILE')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, p.id
  FROM role_permissions rp
  JOIN permissions src ON src.id = rp.permission_id AND src.code = 'REWARD:VIEW'
 CROSS JOIN permissions p
 WHERE p.code IN ('WALLET:VIEW_MY', 'WALLET:VIEW')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, p.id
  FROM role_permissions rp
  JOIN permissions src ON src.id = rp.permission_id AND src.code = 'REWARD:VIEW_MY'
 CROSS JOIN permissions p
 WHERE p.code = 'WALLET:VIEW_MY'
ON CONFLICT DO NOTHING;
