-- ====================================================
-- V1: KeyGo - Initial Schema
-- ====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- Enable fuzzy search (LIKE %abc%) extension 
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Cần cho exclusion constraint "uuid WITH =" ở reward_budgets
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ====================================================
-- Provinces
-- ====================================================
CREATE TABLE provinces (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255)    NOT NULL,
    code        VARCHAR(20)     NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ     DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     DEFAULT NOW()
);

-- ====================================================
-- Districts
-- ====================================================
CREATE TABLE districts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255)    NOT NULL,
    code        VARCHAR(20)     NOT NULL UNIQUE,
    province_id UUID            NOT NULL REFERENCES provinces(id),
    created_at  TIMESTAMPTZ     DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX idx_districts_province_id ON districts(province_id);

-- ============================================
-- Multi-tenant
-- ============================================
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  status      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','ARCHIVED','PENDING')),

  -- ----- Hồ sơ doanh nghiệp -----
  -- Tất cả NULL-able: tổ chức chưa khai gì thì trang "Thông tin công ty" tự lùi về phần
  -- tối thiểu (tên + mã), không buộc ai nhập lại thứ họ chưa từng có.
  logo_url       TEXT,
  cover_url      TEXT,
  -- Lĩnh vực hoạt động lưu dạng chuỗi tự do thay vì enum: danh mục ngành nghề thay đổi
  -- theo thị trường, đổi danh mục không nên kéo theo migration.
  industry       VARCHAR(120),
  tax_code       VARCHAR(50),
  employee_count INT,
  description    TEXT,

  evaluation_max_score DOUBLE PRECISION DEFAULT 100.0,
  kpi_reminder_percentage INT DEFAULT 50,
  -- Nhắc TRƯỞNG ĐƠN VỊ chấm/chốt trước ngày kết thúc đợt-kỳ bao nhiêu ngày; 0 = tắt.
  -- Khác kpi_reminder_percentage ở trên: cái đó nhắc NHÂN VIÊN nộp báo cáo, tính theo %
  -- thời gian của từng lô nộp. Xem EvaluationReminderService.
  evaluation_reminder_days INT DEFAULT 3,
  enable_okr BOOLEAN DEFAULT FALSE,
  enable_waterfall BOOLEAN DEFAULT FALSE,
  enable_ai   BOOLEAN NOT NULL DEFAULT TRUE,
  enable_qualitative BOOLEAN NOT NULL DEFAULT FALSE,
  enable_bsc  BOOLEAN NOT NULL DEFAULT FALSE,
  enable_reward BOOLEAN NOT NULL DEFAULT FALSE,
  -- ----- Hạnh kiểm -----
  -- Điểm hạnh kiểm LẤP TRỤC CÒN THIẾU của ma trận xếp loại: tổ chức chỉ có KPI định lượng
  -- (trục cột) thì hạnh kiểm quy về trục hàng 0..5; chỉ có KPI định tính (trục hàng) thì
  -- quy về trục cột %. Xem ConductAxisResolver.
  enable_conduct    BOOLEAN          NOT NULL DEFAULT FALSE,
  conduct_max_score DOUBLE PRECISION NOT NULL DEFAULT 4,
  performance_matrix jsonb,
  unit_classification_rules jsonb,
  -- ----- Hạn mức token AI -----
  -- Ngân sách token/tháng do quản trị nền tảng cấp cho công ty. Tổng hạn mức phân bổ
  -- cho từng người không được vượt số này (kiểm ở AiQuotaAllocationService).
  ai_monthly_token_limit  BIGINT NOT NULL DEFAULT 0,
  -- Cho phép quản lý cấp dưới tự chia hạn mức cho nhân viên trong đơn vị của họ.
  ai_allow_sub_delegation BOOLEAN NOT NULL DEFAULT FALSE,

  -- ----- Lark SSO: mỗi tổ chức tự kết nối Lark của họ, xác thực bằng tenant_key -----
  -- Quy ước bảo vệ dữ liệu:
  --   *_enc  = AES-GCM, đọc lại được, KHÔNG so sánh/đánh index được (IV ngẫu nhiên)
  --   *_hash = HMAC-SHA256 tất định, chỉ để tra cứu và so sánh
  lark_enabled            BOOLEAN NOT NULL DEFAULT FALSE,
  lark_connection_mode    VARCHAR(20) NOT NULL DEFAULT 'CUSTOM_APP',
  CONSTRAINT chk_org_lark_connection_mode
      CHECK (lark_connection_mode IN ('CUSTOM_APP','STORE')),
  lark_app_id             VARCHAR(255),
  lark_app_secret_enc     TEXT,
  lark_tenant_key_hash    VARCHAR(64),
  lark_tenant_key_enc     TEXT,
  lark_tenant_name        VARCHAR(255),
  lark_tenant_avatar_url  TEXT,
  lark_verified_at        TIMESTAMPTZ,
  lark_default_org_unit_id UUID,
  lark_default_role_id     UUID,

  -- ----- Ví tiền thật (nạp qua SePay, quy đổi sang điểm thưởng) -----
  -- Mặc định TẮT để không tổ chức nào bỗng dưng thấy menu lạ, giống enable_reward.
  enable_cash_wallet   BOOLEAN NOT NULL DEFAULT FALSE,
  -- Số ĐỒNG đổi được 1 điểm. Động theo tổ chức; mỗi giao dịch quy đổi tự chụp lại
  -- tỉ giá tại thời điểm đó nên đổi tỉ giá không làm sai lịch sử cũ.
  point_exchange_rate  BIGINT  NOT NULL DEFAULT 1000,
  topup_min_amount     BIGINT  NOT NULL DEFAULT 10000,
  topup_max_amount     BIGINT  NOT NULL DEFAULT 50000000,
  topup_expire_minutes INT     NOT NULL DEFAULT 30,
  -- Tài khoản nhận tiền. Webhook dùng để đối chiếu, FE dùng để dựng ảnh VietQR.
  sepay_account_number VARCHAR(50),
  sepay_bank_code      VARCHAR(20),
  sepay_account_holder VARCHAR(255),

  -- ----- Hồ sơ pháp nhân, in lên biên nhận thu tiền -----
  -- Các nội dung BẮT BUỘC về "người bán" theo Điều 10 Nghị định 123/2020/NĐ-CP. Để ở đây
  -- vì mỗi tổ chức là một pháp nhân riêng; giá trị được CHỤP LẠI vào từng biên nhận lúc
  -- lập, nên đổi ở đây không làm sai chứng từ đã phát.
  receipt_enabled       BOOLEAN     NOT NULL DEFAULT TRUE,
  legal_name            VARCHAR(255),
  business_address      TEXT,
  contact_phone         VARCHAR(50),
  receipt_series_prefix VARCHAR(10) NOT NULL DEFAULT 'PT',
  receipt_vat_rate      INT         NOT NULL DEFAULT 0,
  receipt_issuer_name   VARCHAR(255),
  receipt_issuer_title  VARCHAR(120),

  -- Thuế suất âm hoặc trên 100 là lỗi nhập liệu, mà nó đi thẳng lên một chứng từ tài chính.
  CONSTRAINT ck_organizations_receipt_vat_rate
      CHECK (receipt_vat_rate BETWEEN 0 AND 100),
  -- Tiền tố rỗng sẽ sinh ra ký hiệu chỉ có năm ("2026/00000001") — không phân biệt được
  -- với số của hệ thống khác khi đối chiếu sổ sách.
  CONSTRAINT ck_organizations_receipt_series_prefix
      CHECK (length(trim(receipt_series_prefix)) > 0),

  CONSTRAINT ck_organizations_employee_count
      CHECK (employee_count IS NULL OR employee_count >= 0),
  CONSTRAINT ck_organizations_exchange_rate CHECK (point_exchange_rate > 0),
  CONSTRAINT ck_organizations_topup_range
      CHECK (topup_min_amount > 0
         AND topup_max_amount >= topup_min_amount
         AND topup_expire_minutes > 0),

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN organizations.conduct_max_score IS
    'Thang điểm nền khi tổ chức chưa có bộ tiêu chí nào. Thang thật nằm ở conduct_criteria_sets.max_score của từng bộ.';

COMMENT ON COLUMN organizations.evaluation_reminder_days IS
    'Nhắc trưởng đơn vị chấm/chốt trước ngày kết thúc đợt-kỳ bao nhiêu ngày; 0 = tắt';
COMMENT ON COLUMN organizations.legal_name IS
    'Tên pháp nhân theo giấy ĐKKD, in lên chứng từ. Trống thì dùng name.';
COMMENT ON COLUMN organizations.receipt_vat_rate IS
    'Thuế suất % áp cho khoản nạp ví. Mặc định 0: nạp ví là khoản thu trước, nghĩa vụ thuế '
    'phát sinh khi nhân viên đổi điểm lấy quà chứ không phải lúc nạp.';

-- Một tổ chức Lark chỉ được gắn với đúng một công ty. Index đặt trên HMAC, không phải giá trị thật.
CREATE UNIQUE INDEX uk_org_lark_tenant_key_hash ON organizations (lark_tenant_key_hash)
    WHERE lark_tenant_key_hash IS NOT NULL;

CREATE INDEX idx_org_lark_enabled ON organizations (lark_enabled)
    WHERE lark_enabled = TRUE;

-- ====================================================
-- BSC Perspectives (danh mục viễn cảnh cấu hình theo org, tái sử dụng nhiều kỳ)
-- Đặt sớm ở đây vì objectives/kpi_criteria/scorecards đều tham chiếu tới.
-- ====================================================
CREATE TABLE bsc_perspectives (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code              VARCHAR(50)     NOT NULL,
    fixed_perspective VARCHAR(20)     NOT NULL
        CHECK (fixed_perspective IN ('FINANCIAL','CUSTOMER','INTERNAL_PROCESS','LEARNING_GROWTH')),
    name              VARCHAR(255)    NOT NULL,
    description     TEXT,
    -- Mục tiêu của CHÍNH hạng mục (giống KPI). Đặt target_value > 0 ⇒ hạng mục TỰ CHẤM theo mục tiêu
    -- này (kiểu OKR): tổng thực đạt của các KPI định lượng trong hạng mục ÷ target_value. Để NULL ⇒
    -- hạng mục chấm theo cách mặc định: trung bình có trọng số tỉ lệ đạt của các KPI con.
    -- Không có cờ "ngược" như KPI, nên minimum_value luôn là SÀN: dưới sàn ⇒ điểm hạng mục = 0.
    target_value    DOUBLE PRECISION,
    minimum_value   DOUBLE PRECISION,
    -- Đơn vị tính của target_value/minimum_value (VD: tỷ VNĐ, %, buổi).
    unit            VARCHAR(50),
    color           VARCHAR(20),
    icon            VARCHAR(50),
    display_order   INT             NOT NULL DEFAULT 0,
    status          VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_bsc_perspectives_organization_id ON bsc_perspectives(organization_id);
-- code là duy nhất trong 1 org (chỉ tính bản ghi chưa xoá mềm)
CREATE UNIQUE INDEX uq_bsc_perspectives_org_code
    ON bsc_perspectives(organization_id, code) WHERE deleted_at IS NULL;

-- ====================================================
-- 4 viễn cảnh BSC CỐ ĐỊNH theo TỪNG tổ chức (mỗi org 1 bản sao 4 dòng, tự sửa tên/màu/thứ tự;
-- code cố định khớp enum). Được service khởi tạo lazily khi org lần đầu mở BSC.
-- ====================================================
CREATE TABLE bsc_fixed_perspectives (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code            VARCHAR(20)  NOT NULL,
    name            VARCHAR(100) NOT NULL,
    color           VARCHAR(20),
    display_order   INT          NOT NULL DEFAULT 0,
    CONSTRAINT uq_bsc_fixed_perspectives_org_code UNIQUE (organization_id, code)
);
CREATE INDEX idx_bsc_fixed_perspectives_org ON bsc_fixed_perspectives(organization_id);

-- ====================================================
-- Sidebar Settings
-- ====================================================
CREATE TABLE sidebar_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    menu_key VARCHAR(255) NOT NULL,
    custom_label VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_sidebar_settings_org_key ON sidebar_settings(organization_id, menu_key);

-- ====================================================
-- Evaluation Levels
-- ====================================================
CREATE TABLE evaluation_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    threshold DOUBLE PRECISION NOT NULL,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_evaluation_levels_org_id ON evaluation_levels(organization_id);

-- ====================================================
-- Qualitative Evaluation Levels
-- ====================================================
CREATE TABLE qualitative_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    level_value DOUBLE PRECISION NOT NULL,
    position_index INT NOT NULL,
    color TEXT,
    score_percent DOUBLE PRECISION
);

CREATE INDEX idx_qualitative_levels_org_id ON qualitative_levels(organization_id);

COMMENT ON COLUMN qualitative_levels.score_percent IS
    'Mức định tính này tương đương bao nhiêu % hoàn thành khi tính điểm BSC (0..100). HR cấu hình.';

-- ====================================================
-- Organization Hierarchy Levels
-- ====================================================

CREATE TABLE org_hierarchy_levels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    level_order     INT NOT NULL,
    unit_type_name   VARCHAR(100) NOT NULL,
    manager_role_label VARCHAR(100), -- Nullable for the last level
    role_level      INT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (organization_id, level_order)
);

CREATE INDEX idx_org_hierarchy_levels_org_id ON org_hierarchy_levels(organization_id);

-- ====================================================
-- Organization Units
-- ====================================================
CREATE TABLE org_units (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  code            VARCHAR(50),
  parent_id       UUID REFERENCES org_units(id),
  org_hierarchy_id UUID NOT NULL REFERENCES org_hierarchy_levels(id),
  path            TEXT NOT NULL,
  email       VARCHAR(255),
  phone       VARCHAR(20),
  address     TEXT,
  -- province_id: entity OrgUnit có @ManyToOne Province; trước đây V1 thiếu nên Hibernate tự thêm
  -- cột + FK tên hash (drift). Khai báo tường minh để dev/prod cùng schema.
  province_id UUID            REFERENCES provinces(id),
  district_id UUID            REFERENCES districts(id),
  logo_url    TEXT,
  status      VARCHAR(20)     NOT NULL DEFAULT 'TRIAL',
  created_at  TIMESTAMPTZ     DEFAULT NOW(),
  updated_at  TIMESTAMPTZ     DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX idx_org_units_status ON org_units(status);
CREATE INDEX idx_org_units_deleted_at ON org_units(deleted_at);
CREATE INDEX idx_org_units_org_hierarchy_id ON org_units(org_hierarchy_id);
CREATE INDEX idx_org_units_parent   ON org_units(parent_id);
CREATE INDEX idx_org_units_path     ON org_units USING gist(path gist_trgm_ops);


-- ====================================================
-- Users
-- ====================================================
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               VARCHAR(255)    NOT NULL UNIQUE,
    password            VARCHAR(255)    NOT NULL,
    full_name           VARCHAR(255)    NOT NULL,
    phone               VARCHAR(20),

    avatar_url          TEXT,
    status              VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE',
    is_email_verified   BOOLEAN         DEFAULT FALSE,
    verify_email_token  VARCHAR(255),
    verify_email_token_expiry TIMESTAMPTZ,
    reset_password_token VARCHAR(255),
    reset_password_token_expiry TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    employee_code       VARCHAR(50),
    require_password_change BOOLEAN     NOT NULL DEFAULT FALSE,
    has_seen_onboarding BOOLEAN         NOT NULL DEFAULT FALSE,
    is_platform_admin   BOOLEAN         NOT NULL DEFAULT FALSE,

    -- ----- Định danh Lark -----
    -- Chỉ lưu HMAC của open_id: cột này chỉ dùng để tra cứu user, không chỗ nào cần giá trị thật.
    lark_open_id_hash   VARCHAR(64),
    -- union_id không tra cứu nên mã hoá AES-GCM.
    lark_union_id_enc   TEXT
);

-- (không tạo idx_users_email: cột email đã UNIQUE -> users_email_key là index rồi)
CREATE INDEX idx_users_deleted_at ON users(deleted_at);
CREATE UNIQUE INDEX idx_users_employee_code ON users(employee_code);

CREATE UNIQUE INDEX uk_users_lark_open_id_hash ON users (lark_open_id_hash)
    WHERE lark_open_id_hash IS NOT NULL AND deleted_at IS NULL;

-- ====================================================
-- Roles
-- ====================================================
CREATE TABLE roles (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID         REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  is_system       BOOLEAN      NOT NULL DEFAULT false,
  created_by      UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  level           INT,
  rank            INT,
  UNIQUE (name, organization_id)
);

-- ON DELETE SET NULL: xoá đơn vị/vai trò mặc định của Lark chỉ làm org mất cấu hình mặc định,
-- không chặn xoá (prod đang chạy đúng như vậy — V3 chỉ đổi tên constraint cho khớp).
ALTER TABLE organizations
    ADD CONSTRAINT fk_org_lark_default_org_unit
        FOREIGN KEY (lark_default_org_unit_id) REFERENCES org_units (id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_org_lark_default_role
        FOREIGN KEY (lark_default_role_id) REFERENCES roles (id) ON DELETE SET NULL;

-- ====================================================
-- User Role Org Units
-- ====================================================
CREATE TABLE user_role_org_units (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  org_unit_id UUID NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ,
  PRIMARY KEY (user_id, role_id, org_unit_id)
);

CREATE INDEX idx_user_role_org_units_user ON user_role_org_units(user_id);
CREATE INDEX idx_user_role_org_units_org ON user_role_org_units(org_unit_id);
CREATE INDEX idx_user_role_org_units_user_org ON user_role_org_units(user_id, org_unit_id);

CREATE TABLE role_scopes (
   role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
   org_unit_id UUID NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
   PRIMARY KEY (role_id, org_unit_id)
);

-- ====================================================
-- Permissions
-- ====================================================
CREATE TABLE permissions (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code     TEXT NOT NULL UNIQUE,          
  resource TEXT NOT NULL,                 
  action   TEXT NOT NULL,       
  description TEXT,         
  UNIQUE (resource, action)
);

-- ====================================================
-- Role Permissions
-- ====================================================
CREATE TABLE role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ====================================================
-- Policies
-- ====================================================
CREATE TABLE policies (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_unit_id UUID         NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
  name       VARCHAR(150) NOT NULL,
  effect     TEXT         NOT NULL CHECK (effect IN ('ALLOW','DENY')),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policies_org_unit_id ON policies(org_unit_id);

-- ====================================================
-- Policy Conditions
-- ====================================================
CREATE TABLE policy_conditions (
  id             UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id      UUID  NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  type           TEXT  NOT NULL CHECK (type IN ('ATTRIBUTE','ORG_UNIT')),
  condition_json JSONB NOT NULL
);

-- ====================================================
-- Role Policies
-- ====================================================
CREATE TABLE role_policies (
  role_id   UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, policy_id)
);

-- ====================================================
-- Scopes
-- ====================================================
CREATE TABLE scopes (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (code IN ('NODE','SUBTREE','CUSTOM'))
);

-- ====================================================
-- KPI Periods
-- ====================================================
-- KỲ đánh giá: gom nhiều "đợt" (kpi_periods) để đánh giá tổng hợp.
-- VD: đợt = KPI giao hàng tuần; kỳ = 6 tháng. cycle_type chỉ là mẫu gợi ý
-- (Tháng/Quý/6 Tháng/Năm) — thời gian vẫn chỉnh tự do.
CREATE TABLE kpi_cycles (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name              VARCHAR(255)    NOT NULL,
    cycle_type        VARCHAR(20)     NOT NULL,
    start_date        TIMESTAMPTZ,
    end_date          TIMESTAMPTZ,
    description       TEXT,
    evaluation_mode   VARCHAR(20)     NOT NULL DEFAULT 'BOTH', -- QUANTITATIVE | QUALITATIVE | BOTH
    created_at        TIMESTAMPTZ     DEFAULT NOW(),
    updated_at        TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_kpi_cycles_org_id ON kpi_cycles(organization_id);

CREATE TABLE kpi_periods (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    -- Đợt thuộc tối đa 1 kỳ (nullable: đợt có thể không thuộc kỳ nào).
    kpi_cycle_id    UUID            REFERENCES kpi_cycles(id) ON DELETE SET NULL,
    name            VARCHAR(255)    NOT NULL,
    period_type     VARCHAR(20)     NOT NULL,
    start_date      TIMESTAMPTZ,
    end_date        TIMESTAMPTZ,
    notification_date TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_kpi_periods_org_id ON kpi_periods(organization_id);
CREATE INDEX idx_kpi_periods_cycle_id ON kpi_periods(kpi_cycle_id);

-- Đánh giá tổng hợp của PHÒNG BAN theo kỳ (có lưu + chốt).
CREATE TABLE cycle_unit_evaluations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_cycle_id    UUID            NOT NULL REFERENCES kpi_cycles(id) ON DELETE CASCADE,
    org_unit_id     UUID            NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
    evaluation_mode VARCHAR(20)     NOT NULL,
    self_score      DOUBLE PRECISION,
    manager_score   DOUBLE PRECISION,
    qual_score      DOUBLE PRECISION,  -- TB mức định tính của thành viên (thang 0..5)
    matrix_rating   DOUBLE PRECISION,  -- TB xếp loại ma trận của thành viên (thang 1..5)
    member_count    INT             DEFAULT 0,
    -- Xếp loại đơn vị CHỤP LẠI lúc chốt kỳ, không tính lại live: luật xếp loại
    -- (organizations.unit_classification_rules) và đánh giá của các đợt cũ đều còn sửa được
    -- sau khi kỳ đã chốt, tính lại sẽ làm đổi kết quả đã công bố. Bản DRAFT vẫn hiện số live.
    classification         VARCHAR(255),  -- tên mức, VD "XUẤT SẮC" / "Loại 4"
    classification_color   VARCHAR(20),   -- màu hiển thị của mức (hex)
    classification_profile VARCHAR(255),  -- hồ sơ luật đã áp (null = preset)
    comment         TEXT,
    status          VARCHAR(20)     NOT NULL DEFAULT 'DRAFT', -- DRAFT | FINALIZED
    finalized_by    UUID            REFERENCES users(id) ON DELETE SET NULL,
    finalized_at    TIMESTAMPTZ,
    finalized_role_level INT,
    finalized_role_rank  INT,

    -- ----- Ghi đè điểm ĐƠN VỊ -----
    -- Điểm đơn vị vốn là TRUNG BÌNH điểm chốt kỳ của thành viên, tính live. Nhưng trung
    -- bình cá nhân không phải lúc nào cũng là kết quả tập thể: phòng đủ người giỏi vẫn có
    -- thể trượt mục tiêu chung, nên người chốt kỳ chấm tay đè lên được.
    --
    -- Số tự tính KHÔNG bị ghi đè trong bảng: manager_score vẫn là số CUỐI CÙNG (chụp lúc
    -- chốt), còn override_score giữ riêng phần người chấm can thiệp để luôn đối chiếu được.
    override_score  DOUBLE PRECISION,
    override_reason TEXT,
    overridden_by   UUID            REFERENCES users(id) ON DELETE SET NULL,
    overridden_at   TIMESTAMPTZ,

    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (kpi_cycle_id, org_unit_id)
);

COMMENT ON COLUMN cycle_unit_evaluations.classification IS
    'Xếp loại đơn vị chụp lúc chốt kỳ — áp luật xếp loại lên phân bố mức của thành viên trong kỳ';
COMMENT ON COLUMN cycle_unit_evaluations.override_score IS
    'Điểm đơn vị do người có quyền chấm tay, thay cho TB thành viên; NULL = dùng TB tự tính';
COMMENT ON COLUMN cycle_unit_evaluations.override_reason IS
    'Lý do chấm khác TB thành viên — bắt buộc nhập để số liệu công bố còn giải thích được';

CREATE INDEX idx_cycle_unit_evals_cycle ON cycle_unit_evaluations(kpi_cycle_id);
CREATE INDEX idx_cycle_unit_evals_unit  ON cycle_unit_evaluations(org_unit_id);

-- Lịch sử chốt / mở khoá đánh giá kỳ của từng đơn vị (dựng dòng thời gian duyệt).
-- Bảng audit thuần: KHÔNG soft-delete, chỉ ghi thêm, không sửa. Cần bảng riêng vì
-- mở khoá sẽ xoá finalized_by/finalized_at trên bản ghi chính -> mất dấu vết.
CREATE TABLE cycle_unit_eval_events (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_cycle_id     UUID        NOT NULL REFERENCES kpi_cycles(id) ON DELETE CASCADE,
    org_unit_id      UUID        NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
    action           VARCHAR(20) NOT NULL,  -- FINALIZE | REOPEN
    actor_id         UUID        REFERENCES users(id) ON DELETE SET NULL,
    actor_role_name  VARCHAR(255),
    actor_role_level INT,
    actor_role_rank  INT,
    manager_score    DOUBLE PRECISION,      -- điểm tại thời điểm xảy ra sự kiện
    qual_score       DOUBLE PRECISION,
    matrix_rating    DOUBLE PRECISION,
    member_count     INT,
    comment          TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cue_events_cycle_unit ON cycle_unit_eval_events (kpi_cycle_id, org_unit_id, created_at);

-- Điểm CHỐT KỲ của từng nhân viên (mặc định = TB điểm QLTT các đợt, cho phép chỉnh tay).
CREATE TABLE cycle_user_evaluations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_cycle_id  UUID            NOT NULL REFERENCES kpi_cycles(id) ON DELETE CASCADE,
    user_id       UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    final_score   DOUBLE PRECISION,
    qual_score    DOUBLE PRECISION,  -- mức định tính chấm ở cấp kỳ (thang 0..5) — trục hàng ma trận
    matrix_rating INT,               -- xếp loại 1..5 suy ra từ ma trận hiệu suất của tổ chức
    -- ── Cascade BSC: hệ số phòng/công ty, ghi đè và hạng mục chặn ──
    -- Toàn bộ nhóm này là SNAPSHOT lúc chốt. Sửa chính sách hệ số về sau KHÔNG được làm đổi kết
    -- quả đã công bố; muốn đổi thì mở khoá và tái tính có phiên bản.
    --
    -- CÔNG THỨC: recognized = MIN(raw_bsc_score, trần) × unit_factor × company_factor.
    -- Hai hệ số TRA TỪ BẢNG DẢI chứ không phải tỉ lệ đạt nhân thẳng — xem bsc_cascade_policies.
    raw_bsc_score        DOUBLE PRECISION,
    unit_factor          DOUBLE PRECISION,
    company_factor       DOUBLE PRECISION,
    recognized_score     DOUBLE PRECISION,
    -- Ghi đè thủ công: hành vi ngoại lệ nên bắt buộc có lý do và dấu vết người thao tác.
    override_score       DOUBLE PRECISION,
    override_reason_code VARCHAR(50),
    override_comment     TEXT,
    overridden_by        UUID REFERENCES users(id),
    overridden_at        TIMESTAMPTZ,
    -- FK khai ở cuối phần BSC: bảng bsc_cascade_policies được tạo sau bảng này.
    cascade_policy_id    UUID,
    -- Hạng mục chặn áp TRẦN XẾP LOẠI, KHÔNG trừ điểm: xếp loại cuối = MIN(xếp loại theo điểm,
    -- gate_cap_rating). Không cột điểm nào bị sửa vì chặn.
    gate_passed          BOOLEAN,
    gate_cap_rating      INTEGER,
    gate_failed_items    TEXT,
    comment       TEXT,
    evaluated_by  UUID            REFERENCES users(id) ON DELETE SET NULL,
    evaluated_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ     DEFAULT NOW(),
    updated_at    TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ,
    UNIQUE (kpi_cycle_id, user_id)
);

CREATE INDEX idx_cycle_user_evals_cycle ON cycle_user_evaluations(kpi_cycle_id);
CREATE INDEX idx_cycle_user_evals_user  ON cycle_user_evaluations(user_id);

-- ====================================================
-- OKR (Objectives and Key Results)
-- ====================================================

CREATE TABLE objectives (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code            VARCHAR(50),
    name            VARCHAR(255)    NOT NULL,
    description     TEXT,
    start_date      DATE,
    end_date        DATE,
    status          VARCHAR(50)     DEFAULT 'ACTIVE',
    perspective_id  UUID            REFERENCES bsc_perspectives(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_objectives_org_id ON objectives(organization_id);
CREATE INDEX idx_objectives_perspective_id ON objectives(perspective_id);

CREATE TABLE objective_org_units (
    objective_id UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
    org_unit_id  UUID NOT NULL REFERENCES org_units(id)  ON DELETE CASCADE,
    PRIMARY KEY (objective_id, org_unit_id)
);

CREATE INDEX idx_objective_org_units_obj_id  ON objective_org_units(objective_id);
CREATE INDEX idx_objective_org_units_unit_id ON objective_org_units(org_unit_id);

CREATE TABLE key_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    objective_id    UUID            NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
    code            VARCHAR(50),
    name            VARCHAR(255)    NOT NULL,
    description     TEXT,
    target_value    DOUBLE PRECISION,
    current_value   DOUBLE PRECISION DEFAULT 0,
    unit            VARCHAR(50),
    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_key_results_objective_id ON key_results(objective_id);

CREATE TABLE key_result_unit_weights (
    id                UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    key_result_id     UUID             NOT NULL REFERENCES key_results(id) ON DELETE CASCADE,
    org_unit_id       UUID             NOT NULL REFERENCES org_units(id)   ON DELETE CASCADE,
    weight_percentage DOUBLE PRECISION NOT NULL DEFAULT 0,
    UNIQUE (key_result_id, org_unit_id)
);

CREATE INDEX idx_kr_unit_weights_kr_id ON key_result_unit_weights(key_result_id);

-- ====================================================
-- KPI Criteria
-- ====================================================
CREATE TABLE kpi_criteria (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_unit_id      UUID            NOT NULL REFERENCES org_units(id),
    kpi_period_id   UUID            NOT NULL REFERENCES kpi_periods(id),
    name            VARCHAR(255)    NOT NULL,
    description     TEXT,
    kpi_type        VARCHAR(20)     NOT NULL DEFAULT 'QUANTITATIVE',
    weight          DOUBLE PRECISION,
    frequency       VARCHAR(20)     NOT NULL,
    key_result_id   UUID            REFERENCES key_results(id) ON DELETE SET NULL,
    perspective_id  UUID            REFERENCES bsc_perspectives(id) ON DELETE SET NULL,
    -- Dòng chỉ tiêu CỤ THỂ của một bộ tiêu chí mà KPI này bám vào — cụ thể hơn perspective_id vì
    -- cùng một hạng mục xuất hiện ở nhiều bộ tiêu chí với mục tiêu khác nhau. Khoá ngoại khai ở
    -- CUỐI phần BSC vì bảng bsc_scorecard_perspectives được tạo sau bảng này.
    scorecard_perspective_id UUID,
    -- ASSIGNED = quản lý giao xuống, SELF = nhân viên tự khai.
    origin          VARCHAR(20)     NOT NULL DEFAULT 'SELF'
                        CHECK (origin IN ('ASSIGNED', 'SELF')),
    parent_id       UUID            REFERENCES kpi_criteria(id) ON DELETE SET NULL,
    parent_relation_type VARCHAR(20),
    is_bonus_kpi    BOOLEAN         NOT NULL DEFAULT FALSE,
    -- Số lần nộp kỳ vọng trong kỳ (entity KpiCriteria.expectedSubmissions). Trước đây chỉ có ở
    -- entity nên Hibernate tự thêm trên prod (drift) — khai báo tường minh.
    expected_submissions INTEGER,
    deadline        TIMESTAMPTZ,
    status          VARCHAR(20)     NOT NULL DEFAULT 'DRAFT',
    created_by      UUID            NOT NULL REFERENCES users(id),
    approved_by     UUID            REFERENCES users(id),
    reject_reason   TEXT,
    submitted_at    TIMESTAMPTZ,
    approved_at     TIMESTAMPTZ,
    replaced_by_id  UUID            REFERENCES kpi_criteria(id) ON DELETE SET NULL,
    replacement_reason TEXT,
    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_kpi_criteria_org_unit_id ON kpi_criteria(org_unit_id);
CREATE INDEX idx_kpi_criteria_status ON kpi_criteria(status);
CREATE INDEX idx_kpi_criteria_deleted_at ON kpi_criteria(deleted_at);
CREATE INDEX idx_kpi_criteria_perspective_id ON kpi_criteria(perspective_id);

-- Trường riêng của KPI định lượng (1:1 với kpi_criteria)
CREATE TABLE quantitative_kpi_details (
    kpi_criteria_id UUID PRIMARY KEY REFERENCES kpi_criteria(id) ON DELETE CASCADE,
    target_value    DOUBLE PRECISION,
    minimum_value   DOUBLE PRECISION,
    compensated_achievement_percent DOUBLE PRECISION,
    unit            VARCHAR(50),
    is_reverse_kpi  BOOLEAN         NOT NULL DEFAULT FALSE
);

-- Trường riêng của KPI định tính (1:1 với kpi_criteria) — thêm cột khi phát sinh
CREATE TABLE qualitative_kpi_details (
    kpi_criteria_id UUID PRIMARY KEY REFERENCES kpi_criteria(id) ON DELETE CASCADE
);

CREATE TABLE kpi_criteria_assignees (
    kpi_criteria_id UUID NOT NULL REFERENCES kpi_criteria(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (kpi_criteria_id, user_id)
);

CREATE INDEX idx_kpi_assignees_kpi_id ON kpi_criteria_assignees(kpi_criteria_id);
CREATE INDEX idx_kpi_assignees_user_id ON kpi_criteria_assignees(user_id);

-- ====================================================
-- KPI Reminders
-- ====================================================
CREATE TABLE kpi_reminders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_criteria_id UUID NOT NULL REFERENCES kpi_criteria(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    batch_number    INT NOT NULL,
    sent_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kpi_reminders_kpi_id ON kpi_reminders(kpi_criteria_id);
CREATE INDEX idx_kpi_reminders_user_id ON kpi_reminders(user_id);

-- ====================================================
-- KPI Submissions
-- ====================================================
CREATE TABLE kpi_submissions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_unit_id          UUID            NOT NULL REFERENCES org_units(id),
    kpi_criteria_id     UUID            NOT NULL REFERENCES kpi_criteria(id),
    submitted_by        UUID            NOT NULL REFERENCES users(id),
    actual_value        DOUBLE PRECISION,
    auto_score          DOUBLE PRECISION,
    -- Điểm quản lý chấm (entity KpiSubmission.managerScore). Trước đây chỉ có ở entity — Hibernate
    -- tự thêm trên prod (drift) — khai báo tường minh.
    manager_score       DOUBLE PRECISION,
    qualitative_level_id UUID           REFERENCES qualitative_levels(id),
    note                TEXT,
    status              VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
    reviewed_by         UUID            REFERENCES users(id),
    review_note         TEXT,
    reviewed_at         TIMESTAMPTZ,
    period_start        TIMESTAMPTZ,
    period_end          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_submissions_org_unit_id ON kpi_submissions(org_unit_id);
CREATE INDEX idx_submissions_kpi_criteria_id ON kpi_submissions(kpi_criteria_id);
CREATE INDEX idx_submissions_submitted_by ON kpi_submissions(submitted_by);
CREATE INDEX idx_submissions_status ON kpi_submissions(status);
-- Partial index thay cho index cả cột deleted_at (95 % NULL): phục vụ đúng các câu
-- count/findByKpiCriteriaIdAndSubmittedById...AndDeletedAtIsNull gọi trong vòng lặp KPI.
CREATE INDEX idx_submissions_alive ON kpi_submissions(kpi_criteria_id, submitted_by) WHERE deleted_at IS NULL;
-- Lịch sử nộp của một người (findBySubmittedByIdOrderByCreatedAtDesc).
CREATE INDEX idx_submissions_submitter_created ON kpi_submissions(submitted_by, created_at DESC);
-- Prod: backend/db/ops/004_kpi_submissions_indexes.sql

-- ====================================================
-- Submission Attachments
-- ====================================================
CREATE TABLE submission_attachments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id       UUID            NOT NULL REFERENCES kpi_submissions(id) ON DELETE CASCADE,
    file_name           VARCHAR(255)    NOT NULL,
    file_url            TEXT            NOT NULL,
    file_size           BIGINT,
    content_type        VARCHAR(100),
    storage_provider    VARCHAR(20)     NOT NULL DEFAULT 'CLOUDINARY',
    storage_key         TEXT,
    uploaded_by         UUID            NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX idx_attachments_submission_id ON submission_attachments(submission_id);

-- ====================================================
-- Evaluations
-- ====================================================
CREATE TABLE evaluations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_unit_id          UUID            NOT NULL REFERENCES org_units(id),
    user_id             UUID            NOT NULL REFERENCES users(id),
    kpi_period_id       UUID            NOT NULL REFERENCES kpi_periods(id),
    evaluator_id        UUID            NOT NULL REFERENCES users(id),
    score               DOUBLE PRECISION,
    comment             TEXT,
    system_score        DOUBLE PRECISION,
    bsc_score           DOUBLE PRECISION,
    behavior_score          DOUBLE PRECISION,
    kpi_completion_percent  DOUBLE PRECISION,
    matrix_rating           INTEGER,
    -- ── Cascade BSC: hệ số phòng/công ty, ghi đè và hạng mục chặn ──
    -- Toàn bộ nhóm này là SNAPSHOT lúc chốt. Sửa chính sách hệ số về sau KHÔNG được làm đổi kết
    -- quả đã công bố; muốn đổi thì mở khoá và tái tính có phiên bản.
    --
    -- CÔNG THỨC: recognized = MIN(raw_bsc_score, trần) × unit_factor × company_factor.
    -- Hai hệ số TRA TỪ BẢNG DẢI chứ không phải tỉ lệ đạt nhân thẳng — xem bsc_cascade_policies.
    raw_bsc_score        DOUBLE PRECISION,
    unit_factor          DOUBLE PRECISION,
    company_factor       DOUBLE PRECISION,
    recognized_score     DOUBLE PRECISION,
    -- Ghi đè thủ công: hành vi ngoại lệ nên bắt buộc có lý do và dấu vết người thao tác.
    override_score       DOUBLE PRECISION,
    override_reason_code VARCHAR(50),
    override_comment     TEXT,
    overridden_by        UUID REFERENCES users(id),
    overridden_at        TIMESTAMPTZ,
    -- FK khai ở cuối phần BSC: bảng bsc_cascade_policies được tạo sau bảng này.
    cascade_policy_id    UUID,
    -- Hạng mục chặn áp TRẦN XẾP LOẠI, KHÔNG trừ điểm: xếp loại cuối = MIN(xếp loại theo điểm,
    -- gate_cap_rating). Không cột điểm nào bị sửa vì chặn.
    gate_passed          BOOLEAN,
    gate_cap_rating      INTEGER,
    gate_failed_items    TEXT,
    period_start        TIMESTAMPTZ,
    period_end          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_evaluations_org_unit_id ON evaluations(org_unit_id);
CREATE INDEX idx_evaluations_user_id ON evaluations(user_id);
CREATE INDEX idx_evaluations_kpi_period_id ON evaluations(kpi_period_id);
CREATE INDEX idx_evaluations_deleted_at ON evaluations(deleted_at);

-- ====================================================
-- Notifications
-- ====================================================
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_unit_id      UUID            NOT NULL REFERENCES org_units(id),
    user_id         UUID            NOT NULL REFERENCES users(id),
    title           VARCHAR(255)    NOT NULL,
    message         TEXT            NOT NULL,
    type            VARCHAR(50),
    reference_id    UUID,
    is_read         BOOLEAN         NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX idx_notifications_org_unit_user ON notifications(org_unit_id, user_id);
-- Danh sách thông báo theo user, mới nhất trước; id làm tie-breaker cho keyset pagination.
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC, id DESC);
-- Badge chưa đọc: chỉ index dòng is_read = false. (Không index is_read cả cột — selectivity thấp.)
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE is_read = false;
-- Prod: backend/db/ops/002_notifications_indexes.sql

-- ====================================================
-- Notification config per organization
-- ====================================================
CREATE TABLE org_notification_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    event_code      VARCHAR(50) NOT NULL,
    email_enabled   BOOLEAN NOT NULL DEFAULT true,
    system_enabled  BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_event UNIQUE (organization_id, event_code)
);

-- ====================================================
-- Email templates per organization
-- ====================================================
-- Chỉ chứa phần ĐÃ BỊ GHI ĐÈ. Không có bản ghi ⇒ dùng nội dung mặc định trong
-- EmailTemplateCatalog; xoá bản ghi = khôi phục mặc định.
CREATE TABLE email_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    template_code   VARCHAR(64)  NOT NULL,
    subject         VARCHAR(500) NOT NULL,
    -- HTML thân email. Các khối đặc thù (nút bấm, ô mã OTP, bảng thông tin, khung nhấn
    -- mạnh) mang thuộc tính data-email để trình soạn trực quan đọc ngược lại thành node.
    -- full_html = true: người dùng tự viết cả tài liệu, hệ thống không bọc khung.
    body            TEXT         NOT NULL,
    full_html       BOOLEAN      NOT NULL DEFAULT false,
    enabled         BOOLEAN      NOT NULL DEFAULT true,
    updated_by      UUID         REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_template UNIQUE (organization_id, template_code)
);

CREATE INDEX idx_email_templates_org ON email_templates (organization_id);

-- ── Hàng đợi gom email thông báo ───────────────────
-- Trước đây mỗi sự kiện gửi thẳng một email: nhân viên nộp 12 báo cáo trong một buổi sáng
-- là trưởng đơn vị nhận đúng 12 lá thư gần như y hệt nhau, và một lượt bulkReview 30 bài
-- nộp sinh ra 30 lá nữa cho nhân viên. Người nhận ngừng đọc, rồi ngừng để ý tới cả những
-- thư thật sự quan trọng.
--
-- Từ đây email đi qua hàng đợi này: sự kiện được xếp hàng, một scheduler chờ cho luồng sự
-- kiện của người đó lắng xuống rồi mới gộp tất cả thành MỘT thư. Thông báo trong hệ thống
-- (chuông + WebSocket) vẫn tức thời như cũ — chỉ có kênh email bị gom lại.
CREATE TABLE notification_email_digest_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Tổ chức cần cho việc render template: mỗi tổ chức có thể tự sửa nội dung email.
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Người NHẬN thư. ON DELETE CASCADE vì thư chưa gửi của một tài khoản đã bị xoá cứng
    -- thì không còn ai để gửi tới.
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Địa chỉ và tên được chốt lại NGAY LÚC XẾP HÀNG chứ không đọc từ users lúc gửi:
    -- người nhận có thể đổi email giữa lúc sự kiện xảy ra và lúc thư đi.
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),

    -- Mã sự kiện (submission_submitted, kpi_approved…). Dùng để nhóm các mục cùng loại
    -- trong thư gộp, và để chọn template khi người nhận chỉ có đúng MỘT mục chờ gửi.
    event_code VARCHAR(100) NOT NULL,

    title TEXT NOT NULL,
    message TEXT NOT NULL,
    reference_id UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- NULL = còn chờ gửi. Ghi thời điểm gửi thay vì xoá bản ghi để còn lần được vì sao một
    -- người nhận thư vào lúc đó với đúng những nội dung đó.
    sent_at TIMESTAMPTZ
);

-- Scheduler quét đúng phần chưa gửi. Partial index để bảng có phình theo lịch sử thì chi
-- phí mỗi lượt quét vẫn chỉ theo số mục đang chờ.
CREATE INDEX idx_notif_digest_pending
    ON notification_email_digest_items(user_id, created_at)
    WHERE sent_at IS NULL;

-- Dọn lịch sử theo thời gian.
CREATE INDEX idx_notif_digest_sent_at
    ON notification_email_digest_items(sent_at)
    WHERE sent_at IS NOT NULL;

-- ====================================================
-- Refresh Tokens
-- ====================================================
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token       VARCHAR(255)    NOT NULL UNIQUE,
    user_id     UUID            NOT NULL REFERENCES users(id),
    device_info VARCHAR(255) DEFAULT 'Unknown Device',
    expires_at  TIMESTAMPTZ     NOT NULL,
    revoked     BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ     DEFAULT NOW()
);

-- (không tạo index riêng trên token: cột đã UNIQUE)
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
-- Job dọn token hết hạn (DataRetentionScheduler / deleteExpiredTokens).
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
-- Prod: backend/db/ops/003_refresh_tokens_indexes.sql

-- ====================================================
-- Security Audit Log
-- ====================================================
-- Nhật ký bảo mật có cấu trúc: ai (user/org/ip/user-agent) làm gì (event) trên cái gì (target).
-- KHÔNG chứa mật khẩu, token, OTP, secret — detail chỉ là mô tả ngắn / lý do.
CREATE TABLE security_audit_logs (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    event           VARCHAR(64)  NOT NULL,
    -- Thành công / thất bại / bị chặn: để lọc nhanh các hành vi đáng ngờ.
    outcome         VARCHAR(16)  NOT NULL,
    -- Không FK tới users: log phải sống lâu hơn tài khoản, và đăng nhập sai có thể nhắm vào email chưa tồn tại.
    user_id         UUID,
    user_email      VARCHAR(255),
    organization_id UUID,
    ip              VARCHAR(64),
    user_agent      VARCHAR(512),
    -- Correlation id của request HTTP (= MDC requestId = header X-Request-Id): từ một dòng audit tra
    -- ngược được app log cùng request và ngược lại. NULL với sự kiện không có request (job nền).
    request_id      VARCHAR(64),
    target_type     VARCHAR(64),
    target_id       VARCHAR(128),
    detail          VARCHAR(1000),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_audit_logs_created_at ON security_audit_logs (created_at DESC);
CREATE INDEX idx_security_audit_logs_user_email ON security_audit_logs (user_email, created_at DESC);
CREATE INDEX idx_security_audit_logs_org_event ON security_audit_logs (organization_id, event, created_at DESC);
CREATE INDEX idx_security_audit_logs_ip ON security_audit_logs (ip, created_at DESC);
CREATE INDEX idx_security_audit_logs_request_id ON security_audit_logs (request_id);

-- ====================================================
-- Data Sources — mỗi record = 1 bảng dữ liệu (sheet)
-- ====================================================
CREATE TABLE datasources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_unit_id     UUID            NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
    name            VARCHAR(255)    NOT NULL,
    description     TEXT,
    icon            VARCHAR(50),
    status          VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    created_by      UUID            NOT NULL REFERENCES users(id),
    updated_by      UUID            REFERENCES users(id),
    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_datasources_org_unit_id ON datasources(org_unit_id);
CREATE INDEX idx_datasources_status ON datasources(status);
CREATE INDEX idx_datasources_deleted_at ON datasources(deleted_at);
CREATE INDEX idx_datasources_created_by ON datasources(created_by);

-- ====================================================
-- Data Source Columns — định nghĩa schema cho mỗi cột
-- ====================================================
CREATE TABLE ds_columns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    datasource_id   UUID            NOT NULL REFERENCES datasources(id) ON DELETE CASCADE,
    name            VARCHAR(255)    NOT NULL,
    data_type       VARCHAR(30)     NOT NULL
                        CHECK (data_type IN (
                            'TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'DATETIME',
                            'SELECT', 'MULTI_SELECT', 'URL', 'EMAIL',
                            'CURRENCY', 'PERCENT', 'ATTACHMENT', 'FORMULA',
                            'SELECT_ONE', 'SELECT_MULTI', 'USER'
                        )),
    column_order    INT             NOT NULL,
    is_required     BOOLEAN         NOT NULL DEFAULT FALSE,
    config          JSONB           NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX idx_ds_columns_datasource_id ON ds_columns(datasource_id);
CREATE UNIQUE INDEX uq_ds_columns_order ON ds_columns(datasource_id, column_order);

-- ====================================================
-- Data Source Rows — hàng dữ liệu
-- ====================================================
CREATE TABLE ds_rows (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    datasource_id   UUID            NOT NULL REFERENCES datasources(id) ON DELETE CASCADE,
    row_order       INT             NOT NULL,
    created_by      UUID            REFERENCES users(id),
    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX idx_ds_rows_datasource_id ON ds_rows(datasource_id);
CREATE INDEX idx_ds_rows_order ON ds_rows(datasource_id, row_order);

-- ====================================================
-- Data Source Cells — ô dữ liệu (EAV pattern)
-- Mỗi cell lưu giá trị vào đúng typed column tương ứng
-- ====================================================
CREATE TABLE ds_cells (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    row_id          UUID            NOT NULL REFERENCES ds_rows(id) ON DELETE CASCADE,
    column_id       UUID            NOT NULL REFERENCES ds_columns(id) ON DELETE CASCADE,
    value_text      TEXT,
    value_number    DOUBLE PRECISION,
    value_boolean   BOOLEAN,
    value_date      TIMESTAMPTZ,
    value_json      JSONB
);

CREATE UNIQUE INDEX uq_ds_cells_row_column ON ds_cells(row_id, column_id);
CREATE INDEX idx_ds_cells_column_id ON ds_cells(column_id);
CREATE INDEX idx_ds_cells_value_number ON ds_cells(value_number) WHERE value_number IS NOT NULL;
CREATE INDEX idx_ds_cells_value_date ON ds_cells(value_date) WHERE value_date IS NOT NULL;

-- ====================================================
-- Reports — báo cáo thống kê
-- ====================================================
CREATE TABLE reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_unit_id     UUID            NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
    name            VARCHAR(255)    NOT NULL,
    description     TEXT,
    status          VARCHAR(20)     NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    created_by      UUID            NOT NULL REFERENCES users(id),
    updated_by      UUID            REFERENCES users(id),
    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_reports_org_unit_id ON reports(org_unit_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_deleted_at ON reports(deleted_at);
CREATE INDEX idx_reports_created_by ON reports(created_by);

-- ====================================================
-- Report ↔ Data Source — liên kết N-N
-- Một report có thể dùng nhiều datasource
-- ====================================================
CREATE TABLE report_datasources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id       UUID            NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    datasource_id   UUID            NOT NULL REFERENCES datasources(id) ON DELETE RESTRICT,
    alias           VARCHAR(100),
    created_at      TIMESTAMPTZ     DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_report_datasources ON report_datasources(report_id, datasource_id);
CREATE INDEX idx_report_datasources_ds ON report_datasources(datasource_id);

-- ====================================================
-- Report Widgets — biểu đồ / widget trong báo cáo
-- ====================================================
CREATE TABLE report_widgets (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id               UUID            NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    report_datasource_id    UUID            REFERENCES report_datasources(id) ON DELETE CASCADE,
    widget_type             VARCHAR(30)     NOT NULL
                                CHECK (widget_type IN (
                                    'BAR', 'LINE', 'PIE', 'DONUT', 'AREA', 'SCATTER', 'TABLE', 'NUMBER_CARD', 'HEATMAP', 'TOP_STATS_GRID',
                                    'OVERVIEW_CARDS', 'TREND_CHART', 'TOP_UNITS', 'UNIT_PERFORMANCE', 'UNIT_KPI',
                                    'MEMBER_DIST', 'ROLE_DIST', 'UNIT_RISK', 'WARNING_LIST', 'KPI_PODIUM', 'RANKING_TABLE'
                                )),
    title                   VARCHAR(255)    NOT NULL,
    description             TEXT,
    chart_config            JSONB           NOT NULL,
    position                JSONB           NOT NULL DEFAULT '{"x":0,"y":0,"w":6,"h":4}',
    widget_order            INT             NOT NULL DEFAULT 0,
    is_pinned               BOOLEAN         DEFAULT FALSE,
    created_at              TIMESTAMPTZ     DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX idx_report_widgets_report_id ON report_widgets(report_id);
CREATE INDEX idx_report_widgets_rds_id ON report_widgets(report_datasource_id);

-- ====================================================
-- AI Chat: Conversations & Messages
-- ====================================================
CREATE TABLE conversations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id),
    title         VARCHAR(255),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id) WHERE deleted_at IS NULL;

CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL,
    content         TEXT NOT NULL,
    msg_index       INTEGER NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Tên phải khớp @UniqueConstraint(name=...) trong entity ConversationMessage, nếu không
    -- Hibernate ddl-auto sẽ sinh thêm một unique constraint tên hash trùng nội dung.
    CONSTRAINT messages_conversation_id_msg_index_key UNIQUE (conversation_id, msg_index)
);

-- (không tạo idx_messages_conversation_id: UNIQUE (conversation_id, msg_index) đã bao phủ)

-- ====================================================
-- BSC — Thẻ điểm (Scorecard) & trọng số viễn cảnh theo kỳ
-- Đặt cuối vì tham chiếu kpi_periods / users / evaluations / objectives.
-- (bsc_perspectives đã khai báo sớm ở trên, ngay sau organizations.)
-- ====================================================

-- Thẻ điểm — gắn với NHIỀU đợt (bảng nối bsc_scorecard_periods) hoặc với MỘT kỳ.
-- apply_scope = 'PERIOD': chỉ áp dụng đúng các đợt được chọn.
-- apply_scope = 'CYCLE' : áp dụng cho MỌI đợt thuộc kpi_cycle_id — suy ra động, nên đợt được thêm
--                         vào kỳ sau này cũng tự dùng thẻ điểm mà không phải sửa lại thẻ.
-- Tham số chấm điểm đặt Ở ĐÂY (theo thẻ) chứ không ở organizations: mỗi kỳ "đóng băng" chính sách
-- của chính nó ⇒ tính lại điểm kỳ cũ luôn ra đúng số cũ, dù kỳ sau HR đổi chính sách.
CREATE TABLE bsc_scorecards (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id           UUID            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    apply_scope               VARCHAR(20)     NOT NULL DEFAULT 'PERIOD'
                                  CHECK (apply_scope IN ('PERIOD','CYCLE')),
    kpi_cycle_id              UUID            REFERENCES kpi_cycles(id) ON DELETE SET NULL,
    name                      VARCHAR(255)    NOT NULL,
    vision                    TEXT,
    -- Cấp trong cây BSC. SUY RA từ phạm vi phòng ban chứ không nhận từ client: không gắn phòng
    -- ban nào, hoặc có gắn ĐƠN VỊ GỐC ⇒ COMPANY; ngược lại ⇒ UNIT. Nhờ vậy không tồn tại trạng
    -- thái mâu thuẫn kiểu "cấp công ty nhưng lại thuộc một phòng".
    level                     VARCHAR(20)     NOT NULL DEFAULT 'COMPANY'
                                  CHECK (level IN ('COMPANY', 'UNIT')),
    -- Bộ tiêu chí cấp trên mà thẻ này nhận phân rã. NULL với BSC công ty (gốc của cây).
    parent_scorecard_id       UUID            REFERENCES bsc_scorecards(id) ON DELETE SET NULL,
    CONSTRAINT chk_bsc_scorecards_parent_not_self CHECK (parent_scorecard_id <> id),
    -- Người chịu trách nhiệm bộ tiêu chí (trưởng đơn vị với BSC phòng).
    owner_id                  UUID            REFERENCES users(id),
    -- ARCHIVED là trạng thái CŨ, giữ để dữ liệu tạo trước đây không vỡ; bản ghi mới dùng CLOSED.
    status                    VARCHAR(20)     NOT NULL DEFAULT 'DRAFT'
                                  CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','ACTIVE','CLOSED','LOCKED','ARCHIVED')),
    -- Vòng đời trình–duyệt: lưu cả người lẫn thời điểm vì đây là dữ liệu phải giải trình được.
    submitted_at              TIMESTAMPTZ,
    submitted_by              UUID            REFERENCES users(id),
    approved_at               TIMESTAMPTZ,
    approved_by               UUID            REFERENCES users(id),
    reject_reason             TEXT,
    locked_at                 TIMESTAMPTZ,
    scoring_mode              VARCHAR(20)     NOT NULL DEFAULT 'SHADOW'
                                  CHECK (scoring_mode IN ('SHADOW','OFFICIAL')),
    empty_perspective_policy  VARCHAR(20)     NOT NULL DEFAULT 'RENORMALIZE'
                                  CHECK (empty_perspective_policy IN ('RENORMALIZE','ZERO_FILL')),
    created_at                TIMESTAMPTZ     DEFAULT NOW(),
    updated_at                TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at                TIMESTAMPTZ
);

CREATE INDEX idx_bsc_scorecards_organization_id ON bsc_scorecards(organization_id);
CREATE INDEX idx_bsc_scorecards_kpi_cycle_id ON bsc_scorecards(kpi_cycle_id);
CREATE INDEX idx_bsc_scorecards_parent ON bsc_scorecards(parent_scorecard_id);
-- Tính duy nhất (1 thẻ mặc định/đợt, mỗi đơn vị ≤1 thẻ/đợt) được ENFORCE Ở SERVICE
-- vì thẻ điểm áp dụng cho NHIỀU đơn vị (bảng nối bsc_scorecard_org_units bên dưới)
-- và cho NHIỀU đợt (bảng nối bsc_scorecard_periods bên dưới).

-- Thẻ điểm áp dụng cho NHIỀU đợt. Chỉ dùng khi apply_scope = 'PERIOD'; gắn theo kỳ thì để trống
-- và danh sách đợt được suy từ kpi_cycle_id lúc truy vấn.
CREATE TABLE bsc_scorecard_periods (
    scorecard_id  UUID NOT NULL REFERENCES bsc_scorecards(id) ON DELETE CASCADE,
    kpi_period_id UUID NOT NULL REFERENCES kpi_periods(id) ON DELETE CASCADE,
    PRIMARY KEY (scorecard_id, kpi_period_id)
);
CREATE INDEX idx_bsc_scorecard_periods_period ON bsc_scorecard_periods(kpi_period_id);

-- Thẻ điểm áp dụng cho NHIỀU phòng ban (giống OKR objective_org_units). Danh sách RỖNG = mặc định toàn tổ chức.
CREATE TABLE bsc_scorecard_org_units (
    scorecard_id UUID NOT NULL REFERENCES bsc_scorecards(id) ON DELETE CASCADE,
    org_unit_id  UUID NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
    PRIMARY KEY (scorecard_id, org_unit_id)
);
CREATE INDEX idx_bsc_scorecard_org_units_unit ON bsc_scorecard_org_units(org_unit_id);

-- Viễn cảnh trong thẻ điểm + trọng số (%) — tổng = 100 mỗi scorecard
-- Một DÒNG CHỈ TIÊU của bộ tiêu chí: hạng mục + trọng số + mục tiêu riêng của cấp này.
--
-- MỤC TIÊU NẰM Ở ĐÂY chứ không ở bsc_perspectives: "Doanh thu" là hạng mục dùng chung, nhưng
-- công ty đặt 100 tỷ còn phòng Kinh doanh 60 tỷ và phòng Dự án 40 tỷ. Con số trên hạng mục chỉ
-- còn là mặc định gợi ý lúc thêm vào bộ tiêu chí (đọc dòng trước, thiếu mới rơi về hạng mục).
CREATE TABLE bsc_scorecard_perspectives (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scorecard_id      UUID            NOT NULL REFERENCES bsc_scorecards(id) ON DELETE CASCADE,
    perspective_id    UUID            NOT NULL REFERENCES bsc_perspectives(id) ON DELETE CASCADE,
    weight_percentage DOUBLE PRECISION NOT NULL DEFAULT 0,
    display_order     INT             NOT NULL DEFAULT 0,

    -- Mục tiêu riêng theo cấp
    target_value      DOUBLE PRECISION,
    minimum_value     DOUBLE PRECISION,
    stretch_value     DOUBLE PRECISION,
    unit              VARCHAR(50),
    direction         VARCHAR(20) DEFAULT 'HIGHER_BETTER',

    -- Nguồn lấy kết quả thực đạt ở cấp đơn vị:
    -- ROLLUP = cộng từ KPI cá nhân gắn vào dòng này; MANUAL = người phụ trách tự nhập;
    -- DATASOURCE = lấy từ bảng dữ liệu đã kết nối (để dành, chưa nối).
    measurement_source VARCHAR(20) NOT NULL DEFAULT 'ROLLUP'
                        CHECK (measurement_source IN ('ROLLUP', 'MANUAL', 'DATASOURCE')),

    -- Liên kết lên dòng của bộ tiêu chí CHA. Chỉ SUM tham gia phép cộng khi đo độ phủ:
    -- SHARED = nhiều đơn vị cùng chịu trách nhiệm MỘT chỉ tiêu (cộng vào là đếm nhiều lần cùng
    -- một kết quả), SUPPORT = vai trò hỗ trợ, CUSTOM = công thức riêng do người dùng chịu trách nhiệm.
    parent_item_id       UUID REFERENCES bsc_scorecard_perspectives(id) ON DELETE SET NULL,
    link_type            VARCHAR(20)
                            CHECK (link_type IS NULL OR link_type IN ('SUM', 'SHARED', 'SUPPORT', 'CUSTOM')),
    contribution_value   DOUBLE PRECISION,
    contribution_percent DOUBLE PRECISION,

    -- Quyền biên tập: ASSIGNED = cấp trên giao xuống (khoá mục tiêu/trọng số), SELF = đơn vị tự thêm.
    -- Đây là thứ quyết định ai sửa được gì, thay cho việc gắn cứng vào vai trò người dùng.
    origin               VARCHAR(20) NOT NULL DEFAULT 'SELF'
                            CHECK (origin IN ('ASSIGNED', 'SELF')),
    locked               BOOLEAN     NOT NULL DEFAULT FALSE,
    created_by           UUID REFERENCES users(id),

    -- Hạng mục chặn ("câu chặn 10"): không đạt ngưỡng thì áp TRẦN XẾP LOẠI, KHÔNG trừ điểm.
    is_gate          BOOLEAN NOT NULL DEFAULT FALSE,
    gate_min_percent DOUBLE PRECISION,
    gate_effect      VARCHAR(24)
                        CHECK (gate_effect IS NULL OR gate_effect IN ('BLOCK_EXCELLENT', 'CAP_AT_RATING', 'WARN_ONLY')),
    gate_cap_rating  INT,
    gate_applies_to  VARCHAR(16) NOT NULL DEFAULT 'BOTH'
                        CHECK (gate_applies_to IN ('INDIVIDUAL', 'UNIT', 'BOTH')),

    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (scorecard_id, perspective_id),
    -- Dòng ASSIGNED bắt buộc biết mình nhận phân rã từ đâu, nếu không "khoá" thành khoá vô chủ:
    -- không ai sửa được mà cũng không truy được về chỉ tiêu gốc.
    CONSTRAINT chk_bsc_sp_assigned_has_parent
        CHECK (origin <> 'ASSIGNED' OR parent_item_id IS NOT NULL),
    -- Bật chặn thì phải nói rõ ngưỡng và hệ quả, nếu không dòng đó im lặng không có tác dụng gì
    -- mà người cấu hình vẫn tưởng đã chặn.
    CONSTRAINT chk_bsc_sp_gate_complete
        CHECK (is_gate = FALSE OR (gate_min_percent IS NOT NULL AND gate_effect IS NOT NULL)),
    CONSTRAINT chk_bsc_sp_gate_cap
        CHECK (gate_effect <> 'CAP_AT_RATING' OR gate_cap_rating IS NOT NULL)
);

CREATE INDEX idx_bsc_scorecard_perspectives_scorecard_id ON bsc_scorecard_perspectives(scorecard_id);
CREATE INDEX idx_bsc_sp_parent_item ON bsc_scorecard_perspectives(parent_item_id);

-- Khoá ngoại từ kpi_criteria: khai muộn vì bảng KPI được tạo trước bảng này.
ALTER TABLE kpi_criteria ADD CONSTRAINT fk_kpi_criteria_scorecard_perspective
    FOREIGN KEY (scorecard_perspective_id) REFERENCES bsc_scorecard_perspectives(id) ON DELETE SET NULL;
CREATE INDEX idx_kpi_criteria_scorecard_perspective ON kpi_criteria(scorecard_perspective_id);

-- Lịch sử đổi trọng số (audit thông thường không lưu giá trị cũ + người đổi)
CREATE TABLE bsc_weight_history (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scorecard_id   UUID            NOT NULL REFERENCES bsc_scorecards(id) ON DELETE CASCADE,
    perspective_id UUID            NOT NULL REFERENCES bsc_perspectives(id) ON DELETE CASCADE,
    old_weight     DOUBLE PRECISION,
    new_weight     DOUBLE PRECISION,
    changed_by     UUID            REFERENCES users(id),
    reason         TEXT,
    changed_at     TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX idx_bsc_weight_history_scorecard_id ON bsc_weight_history(scorecard_id);

-- Breakdown điểm từng viễn cảnh của một lần đánh giá (audit + giải thích điểm cho HR)
CREATE TABLE evaluation_perspective_scores (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id     UUID             NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    perspective_id    UUID             NOT NULL REFERENCES bsc_perspectives(id) ON DELETE CASCADE,
    weight_percentage DOUBLE PRECISION,
    -- Điểm thô của viễn cảnh (0..150): trung bình có trọng số các KPI của NV trong viễn cảnh, hoặc
    -- tổng thực đạt ÷ mục tiêu hạng mục khi scored_by_target = TRUE.
    -- NULL = nhân viên không có KPI nào đóng góp được trong viễn cảnh (viễn cảnh rỗng).
    raw_score         DOUBLE PRECISION,
    -- Đóng góp = weight_percentage% × raw_score
    weighted_score    DOUBLE PRECISION,
    kpi_count         INT              NOT NULL DEFAULT 0,
    -- Tổng thực đạt của các KPI định lượng trong hạng mục. Chỉ có nghĩa khi scored_by_target = TRUE;
    -- ngược lại để NULL vì cách chấm mặc định không đi qua một con số thực đạt chung nào.
    actual_value      DOUBLE PRECISION,
    -- Cách ĐÃ dùng để chấm hạng mục này. Lưu lại vì hạng mục có thể được đặt/xoá mục tiêu về sau —
    -- không có cột này thì đọc lại breakdown cũ sẽ diễn giải sai con số đã chốt.
    scored_by_target  BOOLEAN          NOT NULL DEFAULT FALSE,
    -- Mục tiêu ĐÃ dùng lúc chấm. Không đọc lại từ hạng mục khi hiển thị: mỗi bộ tiêu chí có con
    -- số riêng nên đọc lại sẽ hiện mục tiêu của phòng khác.
    target_value      DOUBLE PRECISION,
    minimum_value     DOUBLE PRECISION,
    unit              VARCHAR(50),
    created_at        TIMESTAMPTZ      DEFAULT NOW()
);

CREATE INDEX idx_evaluation_perspective_scores_evaluation_id ON evaluation_perspective_scores(evaluation_id);
CREATE UNIQUE INDEX uq_evaluation_perspective_scores
    ON evaluation_perspective_scores(evaluation_id, perspective_id);

-- ====================================================
-- BSC PHÂN CẤP — hệ số cascade & kết quả BSC của đơn vị
--
-- ĐIỂM MẤU CHỐT: "nhân viên × phòng × công ty" KHÔNG phải nhân thẳng tỉ lệ đạt. Tỉ lệ đạt của
-- phòng/công ty được TRA vào bảng dải để ra một hệ số gần 1, rồi mới nhân:
--     recognized = MIN(điểm gốc, 120) × hệ_số_phòng × hệ_số_công_ty
-- Ví dụ: gốc 112, phòng 92% (⇒0.95), công ty 97% (⇒1.00) = 106.4 — KHÔNG phải 99.96.
-- Nhân thẳng phạt quá nặng và lệch của hai cấp cộng dồn theo cấp số nhân.
-- ====================================================

CREATE TABLE bsc_cascade_policies (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id        UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                   VARCHAR(255) NOT NULL,
    -- Kỳ áp dụng. NULL = chính sách MẶC ĐỊNH của tổ chức, dùng cho mọi kỳ chưa có chính sách riêng.
    kpi_cycle_id           UUID         REFERENCES kpi_cycles(id) ON DELETE SET NULL,

    -- BAND_TABLE = tra bảng dải (MẶC ĐỊNH); DIRECT_RATIO = nhân thẳng tỉ lệ đạt (đúng chữ BRD
    -- nhưng phạt nặng hơn nhiều, chỉ dùng khi tổ chức thực sự muốn); NONE = bỏ hẳn tầng hệ số.
    unit_factor_mode       VARCHAR(20)  NOT NULL DEFAULT 'BAND_TABLE',
    company_factor_mode    VARCHAR(20)  NOT NULL DEFAULT 'BAND_TABLE',
    -- OVERALL = tra theo BSC TỔNG của đơn vị; LINKED_ITEM = theo %đạt của chính chỉ tiêu cha.
    factor_basis           VARCHAR(20)  NOT NULL DEFAULT 'OVERALL',

    factor_floor           DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    factor_cap             DOUBLE PRECISION NOT NULL DEFAULT 1.15,
    recognized_cap_percent DOUBLE PRECISION NOT NULL DEFAULT 120,

    -- Tối thiểu bao nhiêu % tổng trọng số KPI của một người phải liên kết BSC. Mặc định chỉ CẢNH
    -- BÁO: bật chặn cứng ngay kỳ đầu sẽ kẹt hàng loạt nhân viên chưa kịp gắn KPI vào BSC.
    min_bsc_linked_weight  DOUBLE PRECISION NOT NULL DEFAULT 60,
    linked_weight_enforce  VARCHAR(10)  NOT NULL DEFAULT 'WARN',

    status                 VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    version                INT          NOT NULL DEFAULT 1,
    created_at             TIMESTAMPTZ  DEFAULT NOW(),
    updated_at             TIMESTAMPTZ  DEFAULT NOW(),
    deleted_at             TIMESTAMPTZ,

    CONSTRAINT chk_bsc_policy_unit_mode    CHECK (unit_factor_mode    IN ('NONE', 'DIRECT_RATIO', 'BAND_TABLE')),
    CONSTRAINT chk_bsc_policy_company_mode CHECK (company_factor_mode IN ('NONE', 'DIRECT_RATIO', 'BAND_TABLE')),
    CONSTRAINT chk_bsc_policy_basis        CHECK (factor_basis        IN ('OVERALL', 'LINKED_ITEM')),
    CONSTRAINT chk_bsc_policy_enforce      CHECK (linked_weight_enforce IN ('WARN', 'BLOCK')),
    CONSTRAINT chk_bsc_policy_status       CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    -- Sàn phải ≤ trần, nếu không mọi phép kẹp hệ số đều vô nghĩa.
    CONSTRAINT chk_bsc_policy_floor_cap    CHECK (factor_floor <= factor_cap)
);

CREATE INDEX idx_bsc_cascade_policies_org ON bsc_cascade_policies(organization_id);
CREATE INDEX idx_bsc_cascade_policies_cycle ON bsc_cascade_policies(kpi_cycle_id);

-- Chính sách điểm BSC gắn theo ĐỢT, song song với cách gắn theo KỲ (kpi_cycle_id ở trên).
--
-- Một chính sách chỉ chọn được MỘT kỳ hoặc để trống làm mặc định của tổ chức. Bộ tiêu chí
-- thì từ lâu đã cho chọn "theo đợt" hoặc "theo kỳ", nên hai màn cấu hình nằm cạnh nhau mà
-- lại có hai cách chọn phạm vi khác nhau — muốn đổi trần điểm cho đúng một đợt thì không
-- có đường nào làm.
--
-- Thứ tự tra chính sách lúc chấm (BscCascadeService.resolvePolicy): chính sách gắn ĐÚNG
-- ĐỢT → chính sách của KỲ chứa đợt → chính sách mặc định → hằng số 120/60 trong code.
CREATE TABLE bsc_cascade_policy_periods (
    policy_id     UUID NOT NULL REFERENCES bsc_cascade_policies(id) ON DELETE CASCADE,
    kpi_period_id UUID NOT NULL REFERENCES kpi_periods(id) ON DELETE CASCADE,
    PRIMARY KEY (policy_id, kpi_period_id)
);

CREATE INDEX idx_bsc_policy_periods_period ON bsc_cascade_policy_periods(kpi_period_id);

-- Một dải kết quả BSC → một hệ số. Khoảng NỬA MỞ [from, to): ranh giới thuộc về dải TRÊN, nên
-- đúng 95% rơi vào dải 95–105 chứ không phải 80–95. NULL ở hai đầu = vô cùng, nhờ vậy hai dải
-- đầu/cuối phủ hết mọi giá trị mà không cần con số ma.
CREATE TABLE bsc_factor_bands (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id     UUID        NOT NULL REFERENCES bsc_cascade_policies(id) ON DELETE CASCADE,
    scope         VARCHAR(10) NOT NULL,
    from_percent  DOUBLE PRECISION,
    to_percent    DOUBLE PRECISION,
    factor        DOUBLE PRECISION NOT NULL,
    label         VARCHAR(100),
    color         VARCHAR(20),
    display_order INT NOT NULL DEFAULT 0,

    CONSTRAINT chk_bsc_band_scope CHECK (scope IN ('UNIT', 'COMPANY')),
    CONSTRAINT chk_bsc_band_range CHECK (from_percent IS NULL OR to_percent IS NULL OR from_percent < to_percent)
);

CREATE INDEX idx_bsc_factor_bands_policy ON bsc_factor_bands(policy_id);

-- Kết quả BSC của MỘT ĐƠN VỊ trong MỘT ĐỢT — con số "BSC phòng đạt 92%" dùng để tra hệ số.
--
-- Khác cycle_unit_evaluations: bảng kia gộp NGƯỢC LÊN từ điểm của nhân sự trong phòng, bảng này
-- đo chỉ tiêu của chính đơn vị theo hướng TỪ TRÊN XUỐNG. Hai con số song song, lệch nhau nhiều
-- là tín hiệu chỉ tiêu chưa phân rã đúng.
CREATE TABLE bsc_unit_results (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scorecard_id        UUID NOT NULL REFERENCES bsc_scorecards(id) ON DELETE CASCADE,
    kpi_period_id       UUID REFERENCES kpi_periods(id) ON DELETE CASCADE,
    kpi_cycle_id        UUID REFERENCES kpi_cycles(id) ON DELETE SET NULL,

    achievement_percent DOUBLE PRECISION,
    -- Dải và hệ số CHỤP LẠI lúc chốt: sửa chính sách về sau không được làm đổi kết quả đã công bố.
    band_code           VARCHAR(100),
    factor              DOUBLE PRECISION,
    gate_passed         BOOLEAN,
    gate_failed_items   TEXT,

    status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    finalized_by        UUID REFERENCES users(id),
    finalized_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,

    CONSTRAINT chk_bsc_unit_result_status CHECK (status IN ('DRAFT', 'FINALIZED', 'LOCKED'))
);

CREATE INDEX idx_bsc_unit_results_scorecard ON bsc_unit_results(scorecard_id);
CREATE INDEX idx_bsc_unit_results_period ON bsc_unit_results(kpi_period_id);
-- Mỗi (bộ tiêu chí, đợt) chỉ có MỘT kết quả sống. Partial index vì xoá mềm.
CREATE UNIQUE INDEX uq_bsc_unit_results_scorecard_period
    ON bsc_unit_results(scorecard_id, kpi_period_id) WHERE deleted_at IS NULL;

-- Breakdown từng dòng — bắt buộc phải có để giải thích được con số tổng. Không có nó thì
-- "phòng đạt 92%" là con số không ai kiểm chứng được.
CREATE TABLE bsc_unit_result_items (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_result_id           UUID NOT NULL REFERENCES bsc_unit_results(id) ON DELETE CASCADE,
    scorecard_perspective_id UUID NOT NULL REFERENCES bsc_scorecard_perspectives(id) ON DELETE CASCADE,

    actual_value        DOUBLE PRECISION,
    target_value        DOUBLE PRECISION,
    achievement_percent DOUBLE PRECISION,
    weight_percentage   DOUBLE PRECISION,
    weighted_score      DOUBLE PRECISION,
    kpi_count           INT NOT NULL DEFAULT 0,
    gate_passed         BOOLEAN,
    -- Nguồn số liệu ĐÃ dùng, chụp lại vì cấu hình dòng có thể đổi sau khi chốt.
    measurement_source  VARCHAR(20),

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bsc_unit_result_items_result ON bsc_unit_result_items(unit_result_id);
CREATE UNIQUE INDEX uq_bsc_unit_result_items ON bsc_unit_result_items(unit_result_id, scorecard_perspective_id);

-- Khoá ngoại từ hai bảng đánh giá: khai muộn vì chúng được tạo trước bảng chính sách.
ALTER TABLE evaluations ADD CONSTRAINT fk_evaluations_cascade_policy
    FOREIGN KEY (cascade_policy_id) REFERENCES bsc_cascade_policies(id) ON DELETE SET NULL;
ALTER TABLE cycle_user_evaluations ADD CONSTRAINT fk_cycle_user_evals_cascade_policy
    FOREIGN KEY (cascade_policy_id) REFERENCES bsc_cascade_policies(id) ON DELETE SET NULL;

-- ====================================================
-- QUY TẮC SINH MÃ theo từng tổ chức (Mục tiêu OKR, Kết quả then chốt, Hạng mục BSC)
--
-- KHÔNG có cột "số kế tiếp": số thứ tự được suy ra từ các mã đã tồn tại cùng tiền tố, nên mẫu
-- chứa {YYYY} tự đánh số lại mỗi năm và sửa mẫu giữa kỳ không để lại bộ đếm lệch.
--
-- Cũng KHÔNG seed sẵn dòng nào: tổ chức chưa cấu hình sẽ dùng mẫu mặc định khai trong enum
-- CodeType, dòng chỉ được ghi khi có người sửa thật.
-- ====================================================

CREATE TABLE org_code_rules (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code_type             VARCHAR(40)  NOT NULL,
    auto_generate         BOOLEAN      NOT NULL DEFAULT TRUE,
    allow_manual_override BOOLEAN      NOT NULL DEFAULT FALSE,
    pattern               VARCHAR(100) NOT NULL,
    created_at            TIMESTAMPTZ  DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_org_code_rules_org_type ON org_code_rules(organization_id, code_type);

COMMENT ON COLUMN org_code_rules.pattern IS
    'Mẫu mã, ví dụ OBJ-{YYYY}-{###}. Token: {YYYY} {YY} {MM} {ORG} {UNIT} {PARENT} và một ô số {###}.';
COMMENT ON COLUMN org_code_rules.allow_manual_override IS
    'TRUE cho phép người dùng gõ mã riêng thay mã sinh sẵn; FALSE thì ô mã bị khoá.';


-- ====================================================
-- THƯỞNG ĐIỂM NHÂN VIÊN (Reward Points)
--
-- Ví điểm, sổ cái giao dịch, thưởng thủ công có ngân sách, thưởng tự động theo xếp
-- hạng, danh mục quà và đổi quà.
--
-- NGUYÊN TẮC BẤT DI BẤT DỊCH: điểm thưởng TÁCH HOÀN TOÀN khỏi điểm đánh giá KPI.
-- Không bảng nào ở đây được đọc ngược vào evaluations / cycle_user_evaluations hay
-- bất kỳ báo cáo điểm nào. Chiều phụ thuộc chỉ đi MỘT hướng: reward đọc evaluation,
-- không bao giờ ngược lại.
--
-- LƯU Ý: spring.jpa.hibernate.ddl-auto=update sẽ tự tạo cột còn thiếu nhưng KHÔNG tạo
-- CHECK / partial unique index / exclusion constraint. Mọi bảo đảm đúng đắn (chống
-- phát trùng, chống vượt ngân sách, chống âm tồn kho) chỉ tồn tại nếu file này viết ra.
-- ====================================================

-- ── Ví điểm ────────────────────────────────────────
-- Bản materialize để đọc nhanh. Sự thật vẫn là sổ cái reward_transactions; bất biến
-- phải luôn đúng: balance = SUM(transactions.amount)
--                        = lifetime_earned - lifetime_spent - lifetime_expired
CREATE TABLE reward_wallets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- CỐ Ý không có CHECK (balance >= 0): thu hồi thưởng sau khi người nhận đã tiêu
    -- điểm được phép đẩy số dư xuống âm. Kẹp về 0 sẽ phá bất biến
    -- balance_after = balance_trước + amount của sổ cái. Chặn âm chỉ áp ở đường SPEND.
    balance             INT         NOT NULL DEFAULT 0,
    lifetime_earned     INT         NOT NULL DEFAULT 0,
    lifetime_spent      INT         NOT NULL DEFAULT 0,
    lifetime_expired    INT         NOT NULL DEFAULT 0,
    external_wallet_ref VARCHAR(255),
    version             BIGINT      NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_reward_wallets_org_user
    ON reward_wallets(organization_id, user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_reward_wallets_org ON reward_wallets(organization_id);

-- ── Sổ cái giao dịch: CHỈ GHI THÊM ─────────────────
-- Theo đúng tiền lệ cycle_unit_eval_events: không updated_at, không deleted_at.
-- Sửa sai = ghi giao dịch bù trừ mới, không bao giờ sửa hay xoá dòng đã ghi.
CREATE TABLE reward_transactions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id                   UUID        NOT NULL REFERENCES reward_wallets(id) ON DELETE CASCADE,
    organization_id             UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id                     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount                      INT         NOT NULL CHECK (amount <> 0),
    type                        VARCHAR(20) NOT NULL
        CHECK (type IN ('EARN', 'SPEND', 'REFUND', 'ADJUST', 'EXPIRE')),
    -- 'EXTERNAL' là hook cho ví tiền (external_system = 'CASH_WALLET'), 'CHECKIN' cho
    -- điểm danh hàng ngày. Đặt tên ràng buộc rõ ràng để sau này còn sửa được.
    source_type                 VARCHAR(20) NOT NULL
        CONSTRAINT reward_transactions_source_type_check
        CHECK (source_type IN ('MANUAL_GRANT', 'AUTO_RANKING', 'REDEMPTION', 'SYSTEM', 'EXTERNAL', 'CHECKIN')),
    source_ref_id               UUID,
    reversal_of_transaction_id  UUID        REFERENCES reward_transactions(id) ON DELETE SET NULL,
    external_system             VARCHAR(50),
    external_ref                VARCHAR(255),
    -- Chống ghi trùng khi retry / double-click. Suy ra hoàn toàn từ (loại nghiệp vụ,
    -- id bản ghi, người nhận) — không chứa timestamp hay số ngẫu nhiên, vì lần retry
    -- sẽ sinh khoá khác và mất tác dụng. Bảng đăng ký khoá ở RewardWalletService.
    idempotency_key             VARCHAR(120) NOT NULL,
    balance_after               INT         NOT NULL,
    note                        TEXT,
    actor_user_id               UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_reward_transactions_idem ON reward_transactions(idempotency_key);
CREATE INDEX idx_reward_transactions_wallet ON reward_transactions(wallet_id, created_at DESC);
CREATE INDEX idx_reward_transactions_org_user ON reward_transactions(organization_id, user_id, created_at DESC);
CREATE INDEX idx_reward_transactions_source ON reward_transactions(source_type, source_ref_id);
-- Chống nạp trùng khi webhook hệ thống ngoài phát lại. Chưa dùng ở v1 nhưng không thể
-- thêm sạch sau khi dữ liệu trùng đã tồn tại.
CREATE UNIQUE INDEX uq_reward_transactions_external
    ON reward_transactions(external_system, external_ref) WHERE external_ref IS NOT NULL;

-- ── Ngân sách điểm của người trao ──────────────────
-- CỐ Ý KHÔNG có cột used_points. Hạn mức đã dùng suy ra bằng SUM(total_points) của các
-- đề nghị PENDING_APPROVAL + APPROVED. Cột đếm phải hoàn lại ở ba đường (từ chối, huỷ,
-- thu hồi); cách suy ra thì chúng tự rơi khỏi tổng.
--
-- period_start/period_end LUÔN có giá trị và là khoảng hiệu lực duy nhất. kpi_cycle_id
-- và kpi_period_id chỉ là nhãn liên kết: khi tạo theo kỳ/đợt, service copy ngày xuống.
CREATE TABLE reward_budgets (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    grantor_user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kpi_cycle_id     UUID        REFERENCES kpi_cycles(id) ON DELETE SET NULL,
    kpi_period_id    UUID        REFERENCES kpi_periods(id) ON DELETE SET NULL,
    period_start     DATE        NOT NULL,
    period_end       DATE        NOT NULL,
    allocated_points INT         NOT NULL CHECK (allocated_points >= 0),
    max_per_award    INT         CHECK (max_per_award IS NULL OR max_per_award > 0),
    note             TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    deleted_at       TIMESTAMPTZ,
    CONSTRAINT ck_reward_budgets_range CHECK (period_end >= period_start),
    -- Gắn nhãn vào kỳ HOẶC đợt, không phải cả hai: hai cái lệch ngày thì không rõ nên
    -- đồng bộ theo cái nào.
    CONSTRAINT ck_reward_budgets_single_link
        CHECK (NOT (kpi_cycle_id IS NOT NULL AND kpi_period_id IS NOT NULL))
);

-- Một grantor tại một thời điểm có TỐI ĐA MỘT ngân sách. Nhờ vậy truy vấn tra ngân
-- sách luôn trả về đúng 0 hoặc 1 dòng, không cần luật ưu tiên "nhiều ngân sách cùng
-- khớp thì lấy cái nào".
ALTER TABLE reward_budgets ADD CONSTRAINT ex_reward_budgets_no_overlap
    EXCLUDE USING gist (
        organization_id WITH =,
        grantor_user_id WITH =,
        daterange(period_start, period_end, '[]') WITH &&
    ) WHERE (deleted_at IS NULL);

CREATE INDEX idx_reward_budgets_grantor ON reward_budgets(organization_id, grantor_user_id);
CREATE INDEX idx_reward_budgets_period ON reward_budgets(kpi_period_id);

-- ── Mẫu chứng nhận khen thưởng ─────────────────────
-- Bản THIẾT KẾ (khung viền, hoa văn, cách xếp chữ) nằm ở frontend dưới dạng "preset";
-- bảng này chỉ lưu phần tổ chức tự đặt: chọn preset nào, viết lời gì, ký tên ai, màu
-- thương hiệu ra sao. Vẽ chứng nhận là việc của trình duyệt — nhồi cả layout xuống DB
-- thì mỗi lần chỉnh một khoảng cách lại phải chạy migration.
--
-- Vì vậy `preset` KHÔNG có CHECK liệt kê giá trị: danh mục thiết kế thuộc về frontend
-- và sẽ dài thêm theo thời gian. Frontend tự lùi về preset đầu tiên khi gặp khoá lạ.
CREATE TABLE reward_certificate_templates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    name              VARCHAR(120) NOT NULL,
    preset            VARCHAR(40)  NOT NULL,
    orientation       VARCHAR(10)  NOT NULL DEFAULT 'LANDSCAPE'
        CHECK (orientation IN ('LANDSCAPE', 'PORTRAIT')),

    -- ----- Nội dung in trên chứng nhận -----
    -- Đều cho phép chỗ giữ {{ten}}, {{diem}}, {{lyDo}}, {{ngay}}, {{nguoiThuong}},
    -- {{donVi}}, {{congTy}} — frontend thay lúc vẽ. Không thay ở backend: cùng một mẫu
    -- phải xem trước được với dữ liệu giả trước khi có lượt thưởng nào.
    eyebrow           VARCHAR(120),
    title             VARCHAR(160) NOT NULL,
    subtitle          VARCHAR(255),
    body              TEXT,
    footnote          VARCHAR(255),

    signer_name       VARCHAR(120),
    signer_title      VARCHAR(120),
    signature_url     TEXT,

    -- NULL = dùng logo của tổ chức. Cột riêng để phòng công ty muốn con dấu khác cho
    -- chứng nhận nội bộ, không bắt họ đổi logo chung.
    logo_url          TEXT,
    background_url    TEXT,

    -- NULL = giữ màu gốc của preset. Lưu rỗng thay vì chép màu preset xuống: sau này
    -- chỉnh lại bảng màu của preset thì mẫu chưa tuỳ biến được hưởng luôn.
    accent_color      VARCHAR(9) CHECK (accent_color  IS NULL OR accent_color  ~ '^#[0-9A-Fa-f]{6}$'),
    ink_color         VARCHAR(9) CHECK (ink_color     IS NULL OR ink_color     ~ '^#[0-9A-Fa-f]{6}$'),
    surface_color     VARCHAR(9) CHECK (surface_color IS NULL OR surface_color ~ '^#[0-9A-Fa-f]{6}$'),

    show_logo         BOOLEAN      NOT NULL DEFAULT TRUE,
    show_points       BOOLEAN      NOT NULL DEFAULT TRUE,
    show_reason       BOOLEAN      NOT NULL DEFAULT TRUE,

    -- Mẫu được chọn sẵn khi mở màn hình in. Ràng buộc "mỗi tổ chức nhiều nhất một mẫu"
    -- nằm ở unique index bên dưới.
    is_default        BOOLEAN      NOT NULL DEFAULT FALSE,

    status            VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    display_order     INT          NOT NULL DEFAULT 0,

    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ  DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_reward_cert_templates_org
    ON reward_certificate_templates(organization_id, status, display_order)
    WHERE deleted_at IS NULL;

-- Hai mẫu cùng nhận là "mặc định" thì màn hình in chọn cái nào là do thứ tự truy vấn —
-- người dùng thấy mẫu nhảy lung tung giữa các lần mở mà không hiểu vì sao.
CREATE UNIQUE INDEX uq_reward_cert_templates_default
    ON reward_certificate_templates(organization_id)
    WHERE deleted_at IS NULL AND is_default;

-- Trùng tên mẫu trong cùng tổ chức làm danh sách chọn thành một dãy chữ giống hệt nhau.
CREATE UNIQUE INDEX uq_reward_cert_templates_name
    ON reward_certificate_templates(organization_id, LOWER(name))
    WHERE deleted_at IS NULL;

-- ── Thưởng thủ công ────────────────────────────────
-- Trong hạn mức ⇒ APPROVED ngay (approval_mode=AUTO). Vượt hạn mức / vượt mức tối đa
-- mỗi lần ⇒ PENDING_APPROVAL, chờ người có REWARD:APPROVE. Khoản được duyệt vượt hạn
-- mức có budget_id = NULL: ngoại lệ do cấp trên cho, không tính vào hạn mức cá nhân.
CREATE TABLE reward_grants (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    org_unit_id          UUID        NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
    grantor_user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    budget_id            UUID        REFERENCES reward_budgets(id) ON DELETE SET NULL,
    points_per_recipient INT,
    total_points         INT         NOT NULL CHECK (total_points > 0),
    reason               TEXT        NOT NULL,
    status               VARCHAR(20) NOT NULL DEFAULT 'PENDING_APPROVAL'
        CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'REVOKED')),
    -- Để truy "bao nhiêu lần thưởng đi tắt không qua duyệt" bằng một câu query.
    approval_mode        VARCHAR(10) NOT NULL DEFAULT 'MANUAL'
        CHECK (approval_mode IN ('AUTO', 'MANUAL')),
    approval_reason      TEXT,
    approver_user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
    approved_at          TIMESTAMPTZ,
    decision_note        TEXT,

    -- ----- Chứng nhận khen thưởng -----
    -- Là quyết định RIÊNG của người trao, không phải hệ quả tự động của việc thưởng điểm:
    -- thưởng 10 điểm vì "đi họp đúng giờ" mà cũng sinh tờ "CỐNG HIẾN XUẤT SẮC" y hệt lượt
    -- thưởng 5.000 điểm cho một dự án lớn thì giấy khen mất hết giá trị.
    certificate_enabled  BOOLEAN     NOT NULL DEFAULT FALSE,
    -- NULL = "để hệ thống chọn mẫu mặc định của công ty lúc in". KHÔNG chốt cứng mẫu vào
    -- đây lúc thưởng: công ty đổi mẫu mặc định thì các lượt chưa in nên theo mẫu mới.
    --
    -- ON DELETE SET NULL chỉ là lưới an toàn cuối — mẫu bị xoá là xoá MỀM (deleted_at), FK
    -- không nổ, nên tầng hiển thị vẫn phải tự lùi về mẫu mặc định khi tra không ra mẫu.
    certificate_template_id UUID
        REFERENCES reward_certificate_templates(id) ON DELETE SET NULL,

    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW(),
    deleted_at           TIMESTAMPTZ,

    -- Chọn mẫu mà quên bật cờ (hoặc ngược lại) là hai trạng thái vô nghĩa: một bên chỉ định
    -- mẫu cho tờ giấy không tồn tại, một bên là rác dữ liệu gây nhầm khi đọc lại sau này.
    CONSTRAINT ck_reward_grants_certificate
        CHECK (certificate_enabled OR certificate_template_id IS NULL)
);

CREATE INDEX idx_reward_grants_org_status ON reward_grants(organization_id, status, created_at DESC);
-- Trang "Chứng nhận của tôi" lọc đúng theo hai điều kiện này.
CREATE INDEX idx_reward_grants_certificate
    ON reward_grants(organization_id, status)
    WHERE deleted_at IS NULL AND certificate_enabled;
CREATE INDEX idx_reward_grants_grantor ON reward_grants(grantor_user_id, created_at DESC);
-- Cột đỡ cho SUM tính hạn mức đã dùng.
CREATE INDEX idx_reward_grants_budget_status ON reward_grants(budget_id, status) WHERE deleted_at IS NULL;

CREATE TABLE reward_grant_items (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grant_id       UUID NOT NULL REFERENCES reward_grants(id) ON DELETE CASCADE,
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    points         INT  NOT NULL CHECK (points > 0),
    transaction_id UUID REFERENCES reward_transactions(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lưới an toàn cuối. Kiểm trùng người nhận phải làm ở tầng request với thông báo rõ ràng.
CREATE UNIQUE INDEX uq_reward_grant_items ON reward_grant_items(grant_id, user_id);

-- ── Chương trình thưởng tự động theo xếp hạng ──────
-- kpi_periods và kpi_cycles không có cột trạng thái nên không có sự kiện "đóng đợt".
-- Cơ chế là 2 bước do người dùng chủ động (xem trước, rồi phát), cộng tuỳ chọn tự phát
-- theo NGÀY KẾT THÚC (auto_trigger) — ngày kết thúc là thứ duy nhất cả đợt lẫn kỳ đều có.
CREATE TABLE reward_programs (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id    UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name               VARCHAR(255) NOT NULL,
    description        TEXT,
    scope              VARCHAR(20)  NOT NULL CHECK (scope IN ('PERIOD', 'CYCLE')),
    org_unit_id        UUID         REFERENCES org_units(id) ON DELETE CASCADE,
    -- Gắn cứng vào MỘT kỳ/đợt. Cả hai NULL = luật thường trực, mục tiêu chọn lúc chạy.
    kpi_cycle_id       UUID         REFERENCES kpi_cycles(id)  ON DELETE SET NULL,
    kpi_period_id      UUID         REFERENCES kpi_periods(id) ON DELETE SET NULL,
    rank_within        VARCHAR(20)  NOT NULL DEFAULT 'SCOPE'
        CHECK (rank_within IN ('SCOPE', 'PER_UNIT')),
    metric             VARCHAR(30)  NOT NULL DEFAULT 'FINAL_SCORE'
        CHECK (metric IN ('FINAL_SCORE', 'MATRIX_RATING', 'PERFORMANCE')),
    -- SHARE_ALL: đồng hạng cùng nhận, "Top 3" có thể trả cho 4 người.
    tie_policy         VARCHAR(10)  NOT NULL DEFAULT 'SHARE_ALL'
        CHECK (tie_policy IN ('SHARE_ALL', 'STRICT')),
    min_metric_value   DOUBLE PRECISION,
    max_points_per_run INT,
    include_unit_heads BOOLEAN      NOT NULL DEFAULT TRUE,
    tiers              jsonb        NOT NULL,
    auto_trigger       BOOLEAN      NOT NULL DEFAULT FALSE,
    enabled            BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by         UUID         REFERENCES users(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ  DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  DEFAULT NOW(),
    deleted_at         TIMESTAMPTZ,
    -- Mục tiêu gắn cứng phải KHỚP phạm vi: chương trình theo kỳ không thể gắn vào đợt.
    CONSTRAINT ck_reward_programs_fixed_target CHECK (
        (kpi_cycle_id IS NULL AND kpi_period_id IS NULL)
     OR (scope = 'CYCLE'  AND kpi_cycle_id  IS NOT NULL AND kpi_period_id IS NULL)
     OR (scope = 'PERIOD' AND kpi_period_id IS NOT NULL AND kpi_cycle_id  IS NULL)
    )
);

CREATE INDEX idx_reward_programs_org ON reward_programs(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_reward_programs_fixed_cycle  ON reward_programs(kpi_cycle_id);
CREATE INDEX idx_reward_programs_fixed_period ON reward_programs(kpi_period_id);

CREATE TABLE reward_program_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      UUID        NOT NULL REFERENCES reward_programs(id) ON DELETE CASCADE,
    organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    kpi_period_id   UUID        REFERENCES kpi_periods(id) ON DELETE CASCADE,
    kpi_cycle_id    UUID        REFERENCES kpi_cycles(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'PREVIEW'
        CHECK (status IN ('PREVIEW', 'ISSUED', 'REVERTED')),
    total_points    INT         NOT NULL DEFAULT 0,
    recipient_count INT         NOT NULL DEFAULT 0,
    -- sha256 của danh sách (userId:points) đã sắp xếp. Khi phát, service tính lại bảng
    -- xếp hạng và so hash; lệch thì từ chối. Đây là thứ khiến câu "tôi đã duyệt đúng
    -- danh sách đó" thành sự thật chứ không phải niềm tin.
    snapshot_hash   VARCHAR(64),
    -- Bậc thưởng THỰC SỰ dùng cho lần chạy này. Đọc bậc từ chương trình lúc xem lại
    -- lịch sử thì một lần sửa cấu hình sẽ làm sai toàn bộ các lần phát trước đó.
    tiers           jsonb,
    executed_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
    executed_at     TIMESTAMPTZ,
    reverted_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
    reverted_at     TIMESTAMPTZ,
    note            TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT ck_reward_runs_target CHECK ((kpi_period_id IS NOT NULL) <> (kpi_cycle_id IS NOT NULL))
);

-- Chống phát trùng. Chỉ chặn bản ISSUED nên thu hồi rồi phát lại vẫn được. Đây là lớp
-- duy nhất sống sót trước hai cú bấm đồng thời.
CREATE UNIQUE INDEX uq_reward_runs_issued_cycle ON reward_program_runs(program_id, kpi_cycle_id)
    WHERE status = 'ISSUED' AND kpi_cycle_id IS NOT NULL;
CREATE UNIQUE INDEX uq_reward_runs_issued_period ON reward_program_runs(program_id, kpi_period_id)
    WHERE status = 'ISSUED' AND kpi_period_id IS NOT NULL;
CREATE INDEX idx_reward_runs_program ON reward_program_runs(program_id, created_at DESC);

CREATE TABLE reward_program_run_items (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id         UUID NOT NULL REFERENCES reward_program_runs(id) ON DELETE CASCADE,
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_unit_id    UUID REFERENCES org_units(id) ON DELETE SET NULL,
    rank           INT  NOT NULL,   -- hạng thi đấu: đồng điểm dùng chung số
    order_index    INT  NOT NULL,   -- thứ tự tuyệt đối sau khi phá hoà, để tái lập y hệt
    metric_value   DOUBLE PRECISION,
    points         INT  NOT NULL CHECK (points > 0),
    transaction_id UUID REFERENCES reward_transactions(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_reward_run_items ON reward_program_run_items(run_id, user_id);

-- ── Danh mục quà và đổi quà ────────────────────────
-- Trừ điểm NGAY khi đặt (SPEND), hoàn lại (REFUND) khi từ chối/huỷ. Nếu chỉ giữ chỗ
-- mềm thì một người có 100 điểm có thể đặt năm yêu cầu 100 điểm cùng lúc.
CREATE TABLE reward_gift_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name              VARCHAR(255) NOT NULL,
    description       TEXT,
    image_url         TEXT,
    point_cost        INT          NOT NULL CHECK (point_cost > 0),
    stock_quantity    INT          NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    unlimited_stock   BOOLEAN      NOT NULL DEFAULT FALSE,
    -- TRUE: quà vật lý, phải có người trao tay rồi đánh dấu đã giao.
    -- FALSE: nhận ngay, yêu cầu đổi tự hoàn tất lúc đặt.
    -- Mặc định TRUE vì đánh nhầm thành "nhận ngay" sẽ khiến nhân viên tưởng đã nhận
    -- trong khi chẳng ai gửi gì cho họ.
    requires_delivery BOOLEAN      NOT NULL DEFAULT TRUE,
    type              VARCHAR(20)  NOT NULL DEFAULT 'INTERNAL'
        CHECK (type IN ('INTERNAL', 'EXTERNAL_VOUCHER')),
    external_provider VARCHAR(50),
    external_sku      VARCHAR(255),
    -- ----- Ảnh chụp thông tin quà ngoài (UrBox) tại thời điểm nhập về danh mục -----
    -- KHÔNG đồng bộ cả kho quà UrBox: giftset của họ hơn 1.000 món và đổi liên tục.
    -- Chỉ chụp đúng những gì cần để HIỂN THỊ; giá và điều kiện thật luôn được UrBox
    -- chốt lại lúc đặt đơn.
    -- Mệnh giá VNĐ bên UrBox, giữ lại để đối chiếu "bao nhiêu điểm cho bao nhiêu tiền".
    external_value        BIGINT,
    external_brand        VARCHAR(255),
    -- Điều kiện sử dụng (HTML của UrBox). BẮT BUỘC hiển thị trước khi đổi.
    external_terms        TEXT,
    -- Nguyên văn "Tối thiểu 30 ngày", "90 ngày"… Không parse thành ngày: đây là lời
    -- hứa của merchant, hạn thật chỉ có sau khi xuất code.
    external_expire_text  VARCHAR(255),
    -- QR code / Barcode 128 / Text — quyết định cách màn hình mã quà hiển thị.
    external_code_display VARCHAR(50),
    external_synced_at    TIMESTAMPTZ,
    status            VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    display_order     INT          NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ  DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_reward_gift_items_org ON reward_gift_items(organization_id, status) WHERE deleted_at IS NULL;

-- Một món quà ngoài chỉ được nhập MỘT lần cho mỗi tổ chức. Nhập trùng sẽ tạo hai thẻ
-- giống hệt nhau trong cửa hàng với hai giá điểm khác nhau — nhân viên không có cách
-- nào biết nên chọn cái nào.
CREATE UNIQUE INDEX uq_reward_gift_items_external
    ON reward_gift_items(organization_id, external_provider, external_sku)
    WHERE deleted_at IS NULL AND external_provider IS NOT NULL;

CREATE TABLE reward_redemptions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id               UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gift_item_id          UUID         NOT NULL REFERENCES reward_gift_items(id) ON DELETE RESTRICT,
    -- Chụp tên VÀ ảnh lúc đổi: quà đổi tên hay thay ảnh sau này không được làm sai
    -- lịch sử của người đã đổi. Chụp nửa vời (chỉ tên) sẽ cho ra tên cũ kèm ảnh mới.
    gift_name_snapshot    VARCHAR(255) NOT NULL,
    gift_image_snapshot   TEXT,
    quantity              INT          NOT NULL DEFAULT 1 CHECK (quantity > 0),
    points_spent          INT          NOT NULL CHECK (points_spent > 0),
    -- FAILED khác REJECTED: REJECTED là người quản lý từ chối, FAILED là hệ thống ngoài
    -- không xuất được quà. Gộp chung sẽ khiến nhân viên đọc lịch sử tưởng công ty từ
    -- chối mình, và người vận hành mất luôn con số "bao nhiêu đơn hỏng vì nhà cung cấp".
    status                VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
        CONSTRAINT reward_redemptions_status_check
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'DELIVERED', 'CANCELLED', 'FAILED')),
    handled_by            UUID         REFERENCES users(id) ON DELETE SET NULL,
    handled_at            TIMESTAMPTZ,
    delivered_at          TIMESTAMPTZ,
    note                  TEXT,
    transaction_id        UUID         REFERENCES reward_transactions(id) ON DELETE SET NULL,
    refund_transaction_id UUID         REFERENCES reward_transactions(id) ON DELETE SET NULL,
    external_order_id     VARCHAR(255),
    fulfillment_payload   jsonb,
    -- Vì sao đơn hỏng, hiện nguyên văn cho người xử lý. Điểm đã được hoàn tự động nhưng
    -- người vận hành vẫn cần biết là do hết quà, sai cấu hình hay đứt mạng.
    fulfillment_error     TEXT,
    fulfilled_at          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ  DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  DEFAULT NOW(),
    deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_reward_redemptions_org_status ON reward_redemptions(organization_id, status, created_at DESC);
CREATE INDEX idx_reward_redemptions_user ON reward_redemptions(user_id, created_at DESC);
-- Truy vết đơn theo mã bên ngoài khi đối soát. Chỉ index dòng thật sự có đơn ngoài.
CREATE INDEX idx_reward_redemptions_external
    ON reward_redemptions(external_order_id)
    WHERE external_order_id IS NOT NULL;


-- ── Điểm danh hàng ngày ────────────────────────────
-- Nhân viên tự bấm nhận điểm mỗi ngày. Quản trị viên cấu hình ở tab "Điểm danh"
-- trong Quản lý thưởng điểm: bật/tắt, số điểm mỗi ngày, chu kỳ chuỗi và mốc thưởng.
--
-- QUAN HỆ VỚI SỔ CÁI: một chiều. Mỗi lần điểm danh ghi ĐÚNG MỘT bút toán EARN qua
-- RewardWalletService.applyTransaction với source_type = 'CHECKIN' và khoá chống ghi
-- trùng checkin:{userId}:{date}. Không bảng nào ở đây được sổ cái đọc ngược lại.

-- Mỗi tổ chức tối đa MỘT cấu hình. Mặc định TẮT để không tổ chức nào bỗng dưng thấy
-- nút lạ trên màn hình nhân viên, giống enable_reward và enable_cash_wallet.
CREATE TABLE reward_checkin_configs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    enabled             BOOLEAN NOT NULL DEFAULT FALSE,

    -- Điểm cơ bản nhận được mỗi lần điểm danh, chưa tính thưởng chuỗi.
    points_per_day      INT     NOT NULL DEFAULT 10,

    -- Chuỗi đếm 1..streak_cycle_days rồi quay về 1, nên các mốc thưởng lặp lại theo
    -- chu kỳ. NULL = chuỗi đếm thẳng không giới hạn (mốc chỉ trúng đúng một lần).
    streak_cycle_days   INT,

    -- T7/CN không tính vào chuỗi: nghỉ cuối tuần KHÔNG làm đứt chuỗi, và cũng không
    -- điểm danh được vào hai ngày đó. Đặt FALSE nếu tổ chức muốn điểm danh cả tuần.
    skip_weekends       BOOLEAN NOT NULL DEFAULT TRUE,

    -- [{"day":3,"points":20},{"day":7,"points":100}] — thưởng thêm khi chuỗi chạm
    -- đúng ngày đó. Mảng rỗng = chỉ có điểm cơ bản.
    streak_bonuses      JSONB   NOT NULL DEFAULT '[]',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,

    CONSTRAINT ck_reward_checkin_configs_points CHECK (points_per_day > 0),
    -- Chu kỳ 1 ngày là vô nghĩa (chuỗi luôn bằng 1, mốc nào cũng trúng mỗi ngày).
    CONSTRAINT ck_reward_checkin_configs_cycle
        CHECK (streak_cycle_days IS NULL OR (streak_cycle_days >= 2 AND streak_cycle_days <= 366))
);

CREATE UNIQUE INDEX uq_reward_checkin_configs_org
    ON reward_checkin_configs(organization_id) WHERE deleted_at IS NULL;

-- Nhật ký điểm danh. CHỈ GHI THÊM, giống reward_transactions: không updated_at, không
-- deleted_at. Điểm danh nhầm thì ghi bút toán bù trừ ở sổ cái, không sửa hay xoá dòng
-- đã ghi — nếu xoá thì chuỗi của những ngày sau đó tính lại ra kết quả khác với số
-- điểm đã thực sự phát.
--
-- Các cột streak_*/points_* là ẢNH CHỤP tại thời điểm điểm danh, cố ý không suy lại
-- lúc đọc: sếp đổi cấu hình hôm nay không được làm sai lịch sử điểm đã phát hôm qua.
CREATE TABLE reward_checkins (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checkin_date        DATE NOT NULL,

    -- Tổng số ngày liên tiếp đã điểm danh, đếm thẳng không reset theo chu kỳ.
    streak_length       INT  NOT NULL,
    -- Vị trí trong chu kỳ (1..streak_cycle_days). Bằng streak_length khi không đặt chu kỳ.
    streak_day          INT  NOT NULL,

    base_points         INT  NOT NULL,
    bonus_points        INT  NOT NULL DEFAULT 0,
    total_points        INT  NOT NULL,

    transaction_id      UUID REFERENCES reward_transactions(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_reward_checkins_points CHECK (total_points = base_points + bonus_points),
    CONSTRAINT ck_reward_checkins_streak CHECK (streak_length >= 1 AND streak_day >= 1)
);

-- Lớp bảo vệ CUỐI chống điểm danh hai lần trong một ngày. Khoá chống ghi trùng ở sổ
-- cái đã chặn phần lớn, nhưng ràng buộc này mới là thứ bảo đảm nhật ký không có hai
-- dòng cùng ngày khi hai request chạy song song khít nhau.
CREATE UNIQUE INDEX uq_reward_checkins_user_date
    ON reward_checkins(organization_id, user_id, checkin_date);

-- Truy vấn nóng nhất: lần điểm danh gần nhất của một người, để tính chuỗi.
CREATE INDEX idx_reward_checkins_user_date
    ON reward_checkins(user_id, checkin_date DESC);


-- ====================================================
-- VÍ TIỀN THẬT (Cash Wallet) — nạp qua SePay, quy đổi sang điểm thưởng
--
-- Mỗi người dùng có một ví tiền riêng (số dư VND). Nạp bằng chuyển khoản VietQR,
-- SePay bắn webhook biến động số dư về, hệ thống đối chiếu nội dung chuyển khoản với
-- mã đơn rồi ghi có. Người dùng tự bấm quy đổi sang điểm; điểm cộng vào ví điểm của
-- chính họ. KHÔNG có rút tiền.
--
-- QUAN HỆ VỚI MODULE ĐIỂM THƯỞNG: chỉ một chiều, ví tiền -> ví điểm, và đi qua đúng
-- những hook mà khối reward ở trên đã chừa sẵn (reward_transactions.external_system =
-- 'CASH_WALLET', source_type = 'EXTERNAL', khoá ext:{system}:{ref}). Không bảng nào ở
-- đây được reward_* đọc ngược lại.
--
-- BẤT BIẾN THỨ TỰ KHOÁ: luồng nào chạm cả hai ví thì LUÔN khoá ví TIỀN trước, ví ĐIỂM
-- sau. Đảo thứ tự ở một luồng mới sẽ gây deadlock với luồng quy đổi.
--
-- Cấu hình cấp tổ chức (enable_cash_wallet, point_exchange_rate, hạn mức nạp, tài
-- khoản SePay) nằm ở bảng organizations bên trên.
-- ====================================================

-- ── Ví tiền ────────────────────────────────────────
-- Bản materialize để đọc nhanh. Sự thật nằm ở sổ cái cash_transactions; bất biến phải
-- luôn đúng: balance = SUM(cash_transactions.amount)
--                    = lifetime_topup - lifetime_converted
--
-- Tiền lưu bằng BIGINT ĐỒNG, không phải NUMERIC: VND không có đơn vị nhỏ hơn đồng nên
-- số nguyên là biểu diễn chính xác tuyệt đối, không có sai số làm tròn và không cần
-- chính sách rounding ở bất kỳ đâu.
CREATE TABLE cash_wallets (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id    UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id            UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- CÓ CHECK >= 0, khác hẳn reward_wallets. Ví điểm cho phép âm vì có đường thu hồi
    -- thưởng sau khi người nhận đã tiêu; ví tiền không có đường nào tương tự, mọi lối
    -- ra đều kiểm số dư trước khi ghi.
    balance            BIGINT      NOT NULL DEFAULT 0 CHECK (balance >= 0),
    lifetime_topup     BIGINT      NOT NULL DEFAULT 0,
    lifetime_converted BIGINT      NOT NULL DEFAULT 0,
    version            BIGINT      NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW(),
    deleted_at         TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_cash_wallets_org_user
    ON cash_wallets(organization_id, user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cash_wallets_org ON cash_wallets(organization_id);


-- ── Sổ cái tiền: CHỈ GHI THÊM ──────────────────────
-- Theo đúng tiền lệ reward_transactions / cycle_unit_eval_events: không updated_at,
-- không deleted_at, không bao giờ sửa dòng đã ghi.
--
-- KHÔNG có type 'REFUND' và KHÔNG có cột reversal_of_transaction_id, dù
-- reward_transactions có cả hai. Ở đây không tồn tại luồng nào ghi vào chúng: không
-- rút tiền, không huỷ nạp, không đảo bút toán. Cột và giá trị enum không ai tạo được
-- chỉ gây hiểu nhầm khi đọc — thêm sau bằng một migration mới thì rẻ, còn mang theo
-- thứ chết ngay từ đầu thì không ai dám dọn.
--
-- ADJUST chỉ do một đường sinh ra: người có WALLET:RECONCILE ghi có tay cho một giao
-- dịch SePay không quy được về đơn nào (xem SepayReconcileService).
CREATE TABLE cash_transactions (
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
    -- Chống ghi trùng khi retry / bấm hai lần. Suy ra HOÀN TOÀN từ (loại nghiệp vụ,
    -- id bản ghi) — không chứa timestamp hay số ngẫu nhiên sinh phía server.
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

CREATE UNIQUE INDEX uq_cash_transactions_idem
    ON cash_transactions(idempotency_key);
CREATE INDEX idx_cash_transactions_wallet
    ON cash_transactions(wallet_id, created_at DESC);
CREATE INDEX idx_cash_transactions_org_user
    ON cash_transactions(organization_id, user_id, created_at DESC);
CREATE INDEX idx_cash_transactions_source
    ON cash_transactions(source_type, source_ref_id);


-- ── Đơn nạp tiền ───────────────────────────────────
-- amount là số tiền ĐỀ NGHỊ, paid_amount là số tiền THỰC NHẬN. Hai cột tách nhau vì
-- chính sách là luôn ghi có đúng số tiền thực về, kể cả khi lệch: ví là số dư 1:1 chứ
-- không phải món hàng giá cố định, và giữ tiền người dùng lại trong hàng đợi đối soát
-- chỉ vì lệch vài nghìn phí ngân hàng là sai.
--
-- CỐ Ý KHÔNG có cột sepay_event_id: ghép cặp đã có ở chiều ngược
-- (sepay_webhook_events.matched_order_id), và cột xuôi sẽ tạo khoá ngoại vòng giữa hai
-- bảng. Tệ hơn, một đơn có thể bị nhiều event trỏ vào (một cái ghi có, một cái báo
-- tiền về lần hai) nên cột đơn trị sẽ nói dối.
CREATE TABLE topup_orders (
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

-- UNIQUE TOÀN CỤC, không scope theo tổ chức: webhook chỉ thấy nội dung chuyển khoản,
-- không biết org nào, nên mã phải tự nó định danh được đơn.
CREATE UNIQUE INDEX uq_topup_orders_code ON topup_orders(code);
CREATE INDEX idx_topup_orders_user
    ON topup_orders(organization_id, user_id, created_at DESC);
CREATE INDEX idx_topup_orders_expiring
    ON topup_orders(expires_at) WHERE status = 'PENDING';


-- ── Sự kiện webhook SePay ──────────────────────────
-- Lưu RAW mọi callback, kể cả cái không khớp đơn nào — mất webhook là mất tiền người
-- dùng, và raw_payload là thứ duy nhất cứu được.
--
-- Bảng này KHÔNG phải append-only thuần như cash_transactions, nói rõ ra để không ai
-- tưởng nhầm. Ba nhóm cột, mỗi nhóm ghi đúng MỘT lần:
--   1. raw_payload và mọi cột trích từ nó  -> ghi lúc nhận, bất biến tuyệt đối
--   2. status / matched_order_id / amount_mismatch / error_message
--                                          -> ghi lúc xử lý tự động
--   3. resolution_*                        -> ghi khi có người xử lý tay
CREATE TABLE sepay_webhook_events (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Tổ chức nhận khoản tiền này, suy từ đơn đã khớp hoặc từ số tài khoản nhận. Hàng
    -- đợi đối soát LUÔN lọc theo cột này: không có nó thì chairman của tổ chức nào cũng
    -- nhìn thấy — và xử lý được — giao dịch chuyển khoản của tổ chức khác.
    --
    -- NULL nghĩa là CHƯA XÁC ĐỊNH ĐƯỢC: tiền về một tài khoản chưa tổ chức nào khai
    -- trong cấu hình ví (tiền lãi ngân hàng, hoặc webhook về trước khi kịp cấu hình —
    -- SePay bắn mọi biến động số dư của tài khoản đã liên kết bên đó, không chờ KeyGo).
    -- Cố ý KHÔNG đặt NOT NULL: sự kiện không quy được về đâu vẫn phải lưu lại được, vì
    -- tiền đã thật sự vào tài khoản rồi.
    organization_id           UUID        REFERENCES organizations(id) ON DELETE SET NULL,
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

CREATE UNIQUE INDEX uq_sepay_webhook_events_sepay_id
    ON sepay_webhook_events(sepay_id);
-- Chính là HÀNG ĐỢI ĐỐI SOÁT, index thẳng vào truy vấn đó. Không có nhóm cột
-- resolution_* thì mọi dòng UNMATCHED sẽ nằm lại vĩnh viễn kể cả sau khi tiền đã được
-- ghi có bằng tay, và endpoint đối soát không bao giờ trả về sạch.
CREATE INDEX idx_sepay_events_queue
    ON sepay_webhook_events(received_at DESC)
    WHERE resolved_at IS NULL AND (status = 'UNMATCHED' OR amount_mismatch);
CREATE INDEX idx_sepay_events_order
    ON sepay_webhook_events(matched_order_id);
-- Hàng đợi đối soát lọc theo tổ chức trước, rồi mới tới điều kiện chưa xử lý. Giữ cả
-- idx_sepay_events_queue ở trên vì nó phục vụ nhánh "chưa xác định tổ chức" của cùng
-- truy vấn đó (organization_id IS NULL).
CREATE INDEX idx_sepay_events_org
    ON sepay_webhook_events(organization_id, received_at DESC);


-- ====================================================
-- Biên nhận thu tiền cho mỗi lần nạp ví
-- ====================================================
--
-- Bộ đếm số chứng từ. Vì sao là bảng đếm chứ không phải SEQUENCE hay MAX(number)+1:
--   * SEQUENCE không quay lui khi transaction rollback => số chứng từ có lỗ hổng, thứ mà
--     chứng từ kế toán không được phép có.
--   * MAX+1 đọc ngoài khoá => hai webhook về cùng lúc đọc ra cùng một số; unique index bắt
--     được nhưng ném lỗi đúng lúc tiền đã vào ví và người dùng đang chờ biên nhận.
-- Dòng đếm được khoá bằng SELECT ... FOR UPDATE nên cú thứ hai chờ và nhận số kế tiếp,
-- và nó nằm cùng transaction với biên nhận nên hai cái sống chết cùng nhau.
CREATE TABLE topup_receipt_counters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    -- Ký hiệu = tiền tố + năm lập, VD 'PT2026'. Số bắt đầu lại từ 1 mỗi năm.
    series          VARCHAR(20) NOT NULL,
    last_number     INT         NOT NULL DEFAULT 0 CHECK (last_number >= 0)
);

CREATE UNIQUE INDEX uk_topup_receipt_counters
    ON topup_receipt_counters(organization_id, series);

-- ĐÂY LÀ BIÊN NHẬN, KHÔNG PHẢI HOÁ ĐƠN GTGT. Hoá đơn điện tử hợp lệ phải phát hành qua
-- tổ chức cung cấp dịch vụ hoá đơn đã đăng ký với cơ quan thuế, và hoá đơn có mã còn phải
-- được cơ quan thuế cấp mã trước khi giao cho người mua — KeyGo không làm được việc đó.
-- Bảng này giữ một chứng từ thu tiền mang ĐỦ nội dung bắt buộc theo Điều 10 Nghị định
-- 123/2020/NĐ-CP, để khi tổ chức nối được nhà cung cấp hoá đơn thì mọi trường cần phát
-- hành đều đã có sẵn.
--
-- Mọi thông tin bên bán và bên mua đều CHỤP LẠI chứ không trỏ khoá ngoại rồi đọc lúc in:
-- công ty đổi tên/địa chỉ, nhân viên đổi họ tên hay nghỉ việc là chuyện thường, và một
-- chứng từ tự đổi nội dung theo thời gian thì vô giá trị khi đối chiếu sổ sách.
CREATE TABLE topup_receipts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    -- Một đơn nạp chỉ có MỘT biên nhận. Webhook SePay có thể về hai lần; hai tờ mang hai số
    -- khác nhau cho cùng một khoản tiền là sai lệch sổ sách.
    topup_order_id      UUID        NOT NULL UNIQUE REFERENCES topup_orders(id) ON DELETE CASCADE,
    user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- ── Số hiệu chứng từ ──
    series              VARCHAR(20) NOT NULL,
    number              INT         NOT NULL CHECK (number > 0),
    -- Ngày TIỀN VỀ, không phải ngày sinh bản ghi.
    issued_date         DATE        NOT NULL,

    -- ── Bên bán (bên thu tiền) ──
    seller_name         VARCHAR(255) NOT NULL,
    seller_tax_code     VARCHAR(50),
    seller_address      TEXT,
    seller_phone        VARCHAR(50),
    seller_bank_account VARCHAR(50),
    seller_bank_name    VARCHAR(100),

    -- ── Bên mua (người nộp tiền) ──
    buyer_name          VARCHAR(255) NOT NULL,
    buyer_tax_code      VARCHAR(50),
    buyer_email         VARCHAR(255),
    buyer_employee_code VARCHAR(100),
    buyer_org_unit      VARCHAR(255),

    -- ── Nội dung khoản thu. Tất cả là số nguyên ĐỒNG, đúng cách ví tiền đang ghi sổ. ──
    description         TEXT        NOT NULL,
    amount_before_tax   BIGINT      NOT NULL CHECK (amount_before_tax >= 0),
    vat_rate            INT         NOT NULL DEFAULT 0 CHECK (vat_rate BETWEEN 0 AND 100),
    vat_amount          BIGINT      NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
    total_amount        BIGINT      NOT NULL CHECK (total_amount > 0),
    -- Nội dung bắt buộc, sinh từ total_amount để chống sửa chữ số sau khi lập.
    total_in_words      TEXT        NOT NULL,

    -- ── Thanh toán ──
    payment_method      VARCHAR(50) NOT NULL,
    -- Nội dung chuyển khoản người nộp đã dùng — đường đối chiếu với sao kê ngân hàng.
    payment_reference   VARCHAR(100),
    cash_transaction_id UUID        REFERENCES cash_transactions(id) ON DELETE SET NULL,

    issuer_name         VARCHAR(255),
    issuer_title        VARCHAR(120),

    created_at          TIMESTAMPTZ DEFAULT NOW(),

    -- Tổng tiền phải bằng đúng thành tiền cộng thuế. Chứng từ mà ba con số không cộng lại
    -- được với nhau là chứng từ hỏng, và nó rời khỏi hệ thống ngay khi lập nên không có cơ
    -- hội sửa sau. Phần trước thuế được suy NGƯỢC từ tổng (xem TopupReceiptService) chính
    -- là để ràng buộc này luôn đúng bất kể làm tròn.
    CONSTRAINT ck_topup_receipts_total
        CHECK (total_amount = amount_before_tax + vat_amount)
);

-- Số chứng từ duy nhất trong một ký hiệu của một tổ chức. Lưới cuối cùng bảo vệ tính duy
-- nhất nếu bộ đếm bị can thiệp bằng tay.
CREATE UNIQUE INDEX uq_topup_receipts_number
    ON topup_receipts(organization_id, series, number);

-- Màn hình "Biên nhận của tôi": lọc theo người, sắp theo số giảm dần.
CREATE INDEX idx_topup_receipts_user
    ON topup_receipts(organization_id, user_id, number DESC);

-- Cố ý KHÔNG có deleted_at: chứng từ thu tiền đã phát thì không xoá, kể cả xoá mềm. Đơn
-- nạp bị xoá mềm mà biên nhận biến mất theo sẽ để lại một khoản tiền đã nhận không còn
-- chứng từ nào chứng minh.


-- ====================================================
-- Hạn mức token AI
-- ====================================================

-- Sổ cái tiêu thụ token. Chỉ ghi thêm, không sửa — mỗi lượt gọi LLM một dòng.
-- KHÔNG gắn token vào bảng messages: DatabaseChatMemoryRepository xoá sạch rồi chèn lại
-- toàn bộ tin nhắn mỗi lượt (PK mới), và suggest-kpi / followups không có hội thoại nào.
CREATE TABLE ai_token_usage (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id),
    organization_id   UUID NOT NULL REFERENCES organizations(id),
    feature           VARCHAR(40) NOT NULL,   -- CHAT | KPI_SUGGESTION | FOLLOWUP
    model             VARCHAR(100),
    prompt_tokens     INT NOT NULL DEFAULT 0,
    completion_tokens INT NOT NULL DEFAULT 0,
    total_tokens      INT NOT NULL DEFAULT 0,
    -- Ngày 1 của tháng. Phi chuẩn hoá có chủ đích: biến phép cộng theo tháng thành
    -- so sánh bằng có index, chạy trên đường nóng của mọi lượt chat.
    period_month      DATE NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_user_month ON ai_token_usage (user_id, period_month);
CREATE INDEX idx_ai_usage_org_month  ON ai_token_usage (organization_id, period_month);

-- Hạn mức tháng của từng người. Mỗi người đúng một dòng, do đúng một người cấp.
--   allocated_by IS NULL  -> cấp từ ngân sách công ty (quản lý cao nhất cấp)
--   allocated_by = M      -> trừ vào hạn mức của quản lý M
CREATE TABLE ai_token_quotas (
    user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    monthly_limit BIGINT NOT NULL DEFAULT 0 CHECK (monthly_limit >= 0),
    allocated_by  UUID REFERENCES users(id),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_quota_allocated_by ON ai_token_quotas (allocated_by)
    WHERE allocated_by IS NOT NULL;


-- ====================================================
-- Bố cục trang chủ do từng người dùng tự sắp xếp
-- ====================================================
-- Kéo-thả/ẩn-hiện widget. Mỗi vai trò (scope) có một bố cục riêng vì danh mục widget
-- khác nhau hoàn toàn. Không có deleted_at: đây là preference cá nhân, "Đặt lại" = xoá
-- hàng và rơi về preset mặc định.
--
-- DEPUTY tách khỏi HEAD: phó đơn vị có bộ widget riêng (phạm vi hẹp theo mảng phụ trách,
-- phần lớn là theo dõi thay vì hành động). Dùng chung scope HEAD thì hai người đổi bố cục
-- của nhau.
CREATE TABLE user_dashboard_layouts (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope      VARCHAR(20) NOT NULL CHECK (scope IN ('DIRECTOR', 'HEAD', 'DEPUTY', 'STAFF')),
    -- Mảng [{i, x, y, w, h, visible}] — server lưu nguyên văn, frontend tự lọc id lạ khi hydrate
    layout     JSONB       NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_user_dashboard_layout UNIQUE (user_id, scope)
);

CREATE INDEX idx_user_dashboard_layouts_user ON user_dashboard_layouts (user_id);


-- ====================================================
-- ĐÁNH GIÁ XẾP LOẠI HÀNH VI ("hạnh kiểm")
-- ====================================================
-- Bảng tiêu chí định tính chấm theo ĐỢT hoặc theo KỲ: mỗi tiêu chí một trọng số %, người
-- được đánh giá tự chấm + nêu dẫn chứng, cán bộ quản lý trực tiếp chấm + nhận xét.
-- Điểm tổng = Σ(điểm tiêu chí × trọng số).
--
-- Điểm hạnh kiểm LẤP TRỤC CÒN THIẾU của ma trận xếp loại hiệu quả:
--   - tổ chức chỉ có KPI định lượng (trục cột) ⇒ hạnh kiểm quy về trục hàng (thang 0..5);
--   - tổ chức chỉ có KPI định tính  (trục hàng) ⇒ hạnh kiểm quy về trục cột (thang %).
-- Xem ConductAxisResolver.

-- ── Bộ tiêu chí, gán theo KỲ ─────────────────────
-- Nhiều BỘ chứ không phải mỗi tổ chức một bộ: kỳ không được gán bộ riêng thì rơi về bộ
-- MẶC ĐỊNH, nhờ vậy sửa tiêu chí cho kỳ mới không viết lại tiêu chí của kỳ cũ.
--
-- Thang điểm nằm ở TẮNG BỘ: đổi thang giữa hai kỳ là chuyện bình thường, để ở cấp tổ chức
-- thì một lần sửa làm lệch mọi kỳ. organizations.conduct_max_score chỉ còn là giá trị nền
-- cho bộ mặc định.
CREATE TABLE conduct_criteria_sets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID             NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT             NOT NULL,
    -- Bộ áp cho mọi kỳ chưa được gán bộ riêng. Mỗi tổ chức đúng một bộ như vậy.
    is_default      BOOLEAN          NOT NULL DEFAULT FALSE,
    max_score       DOUBLE PRECISION NOT NULL DEFAULT 4,
    created_at      TIMESTAMPTZ      DEFAULT NOW(),
    updated_at      TIMESTAMPTZ      DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_conduct_set_org ON conduct_criteria_sets(organization_id);

-- Một tổ chức chỉ được MỘT bộ mặc định còn sống — nếu không, kỳ chưa gán sẽ bốc bộ ngẫu nhiên.
CREATE UNIQUE INDEX uq_conduct_set_default
    ON conduct_criteria_sets(organization_id) WHERE is_default AND deleted_at IS NULL;

-- Một kỳ chỉ thuộc MỘT bộ (khoá chính trên kpi_cycle_id): gán kỳ cho bộ khác thì bộ cũ tự
-- mất kỳ đó, không có chuyện hai bộ cùng tranh một kỳ.
CREATE TABLE conduct_criteria_set_cycles (
    kpi_cycle_id            UUID PRIMARY KEY REFERENCES kpi_cycles(id) ON DELETE CASCADE,
    conduct_criteria_set_id UUID NOT NULL    REFERENCES conduct_criteria_sets(id) ON DELETE CASCADE
);

CREATE INDEX idx_conduct_set_cycles_set ON conduct_criteria_set_cycles(conduct_criteria_set_id);

-- ── Tiêu chí thuộc về một bộ ─────────────────────
CREATE TABLE conduct_criteria (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         UUID             NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    conduct_criteria_set_id UUID             NOT NULL REFERENCES conduct_criteria_sets(id) ON DELETE CASCADE,
    name                    TEXT             NOT NULL,
    description             TEXT,
    weight                  DOUBLE PRECISION NOT NULL,   -- % trong tổng 100
    position_index          INT              NOT NULL,
    created_at              TIMESTAMPTZ      DEFAULT NOW(),
    updated_at              TIMESTAMPTZ      DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

CREATE INDEX idx_conduct_criteria_org ON conduct_criteria(organization_id);
CREATE INDEX idx_conduct_criteria_set ON conduct_criteria(conduct_criteria_set_id);

-- ── Phiếu chấm của một người trong một đợt HOẶC một kỳ ──
CREATE TABLE conduct_evaluations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID             NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id           UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kpi_period_id     UUID             REFERENCES kpi_periods(id) ON DELETE CASCADE,
    kpi_cycle_id      UUID             REFERENCES kpi_cycles(id) ON DELETE CASCADE,
    -- Chỉ để truy vết "phiếu này chấm theo bộ nào"; điểm vẫn tính từ bản chụp tiêu chí trong
    -- phiếu, nên xoá bộ đi không làm sai điểm đã chấm (vì vậy SET NULL chứ không CASCADE).
    conduct_criteria_set_id UUID       REFERENCES conduct_criteria_sets(id) ON DELETE SET NULL,
    scope             VARCHAR(20)      NOT NULL,   -- PERIOD | CYCLE
    status            VARCHAR(20)      NOT NULL DEFAULT 'DRAFT',  -- DRAFT | SELF_SUBMITTED | REVIEWED
    self_score        DOUBLE PRECISION,            -- Σ(điểm tự chấm × trọng số)
    manager_score     DOUBLE PRECISION,            -- Σ(điểm CBQLTT × trọng số)
    -- Chụp lại thang điểm lúc chấm: đổi thang ở cấu hình KHÔNG được làm đổi phiếu đã chấm.
    max_score         DOUBLE PRECISION NOT NULL DEFAULT 4,
    comment           TEXT,
    self_submitted_at TIMESTAMPTZ,
    evaluator_id      UUID             REFERENCES users(id) ON DELETE SET NULL,
    evaluated_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ      DEFAULT NOW(),
    updated_at        TIMESTAMPTZ      DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ,
    CONSTRAINT chk_conduct_scope_target CHECK (
        (scope = 'PERIOD' AND kpi_period_id IS NOT NULL AND kpi_cycle_id IS NULL) OR
        (scope = 'CYCLE'  AND kpi_cycle_id  IS NOT NULL AND kpi_period_id IS NULL)
    )
);

-- Mỗi người chỉ có MỘT phiếu còn sống cho mỗi đợt/kỳ (unique một phần vì bảng có xoá mềm).
CREATE UNIQUE INDEX uq_conduct_eval_user_period
    ON conduct_evaluations(user_id, kpi_period_id) WHERE deleted_at IS NULL AND kpi_period_id IS NOT NULL;
CREATE UNIQUE INDEX uq_conduct_eval_user_cycle
    ON conduct_evaluations(user_id, kpi_cycle_id)  WHERE deleted_at IS NULL AND kpi_cycle_id IS NOT NULL;
CREATE INDEX idx_conduct_eval_org  ON conduct_evaluations(organization_id);
CREATE INDEX idx_conduct_eval_user ON conduct_evaluations(user_id);

-- ── Từng dòng tiêu chí trong phiếu ─────────────────
-- Tên/mô tả/trọng số CHỤP LẠI từ conduct_criteria: sửa bộ tiêu chí về sau không được viết
-- lại phiếu đã chấm (điểm đã cộng theo trọng số cũ).
CREATE TABLE conduct_evaluation_items (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conduct_evaluation_id UUID             NOT NULL REFERENCES conduct_evaluations(id) ON DELETE CASCADE,
    criteria_id           UUID             REFERENCES conduct_criteria(id) ON DELETE SET NULL,
    criteria_name         TEXT             NOT NULL,
    criteria_description  TEXT,
    weight                DOUBLE PRECISION NOT NULL,
    position_index        INT              NOT NULL,
    self_score            DOUBLE PRECISION,
    self_evidence         TEXT,   -- "Dẫn chứng"
    manager_score         DOUBLE PRECISION,
    manager_comment       TEXT    -- "Nhận xét của Cán bộ quản lý"
);

CREATE INDEX idx_conduct_eval_items_eval ON conduct_evaluation_items(conduct_evaluation_id);


-- ====================================================
-- Nhắc hạn đánh giá đợt / kỳ
-- ====================================================
--
-- kpi_reminders ở trên chỉ nhắc NHÂN VIÊN nộp báo cáo. Phía chấm cần một lượt quét riêng
-- (EvaluationReminderService): đợt/kỳ sắp đóng mà phòng còn người chưa chấm, hoặc đơn vị
-- chưa chốt kỳ. Không có nó thì đợt hết hạn trong im lặng.
--
-- Bảng này chỉ để CHỐNG GỬI LẶP: lượt quét chạy mỗi giờ và tính lại từ đầu, không có dấu
-- vết đã gửi thì mỗi giờ người ta lại nhận một lá thư y hệt.
CREATE TABLE evaluation_reminders (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- 'PERIOD' | 'CYCLE' — hai loại mốc thời gian, cùng một cách nhắc.
    scope         VARCHAR(16) NOT NULL,
    -- Id của đợt hoặc kỳ. Không đặt khoá ngoại vì trỏ tới hai bảng khác nhau tuỳ scope;
    -- bản ghi mồ côi sau khi xoá đợt là vô hại (chỉ là dấu vết đã gửi).
    target_id     UUID        NOT NULL,
    org_unit_id   UUID        NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
    user_id       UUID        NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
    -- 'BEFORE_DUE' (sắp đóng) | 'OVERDUE' (đã quá hạn mà chưa xong). Mỗi mốc gửi đúng một
    -- lần cho mỗi người ở mỗi đơn vị.
    milestone     VARCHAR(16) NOT NULL,
    pending_count INTEGER,
    sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_evaluation_reminder UNIQUE (scope, target_id, org_unit_id, user_id, milestone)
);

CREATE INDEX idx_eval_reminder_target ON evaluation_reminders (scope, target_id);

COMMENT ON TABLE evaluation_reminders IS
    'Dấu vết đã nhắc hạn đánh giá đợt/kỳ — chống gửi lặp cho lượt quét chạy mỗi giờ';


-- ====================================================
-- Uỷ quyền quản lý chéo đơn vị
-- ====================================================
--
-- Quyền chỉ chảy XUỐNG theo cây: PermissionChecker lọc theo
-- target.path LIKE assignment.path || '%'. Nên trưởng đơn vị A không bao giờ với sang được
-- đơn vị B cùng cấp, dù tổ chức có nhu cầu thật (B trống trưởng, A kiêm nhiệm, đi vắng dài
-- ngày, sáp nhập tạm...).
--
-- Cách duy nhất trước đây là gán cho họ thêm một vai trò TẠI B. Hai chỗ chặn:
--   * mỗi đơn vị chỉ được một Trưởng và một Phó (UserRoleService.validateManagerAssignment),
--     nên B đã có trưởng là bế tắc;
--   * gán vai trò rank 2 để lách thì lại không chấm được hạnh kiểm, vì việc đó đòi đúng
--     rank 0 (ConductService.canScoreConduct).
--
-- Bảng này tách phạm vi khỏi vai trò: người được uỷ quyền GIỮ NGUYÊN bộ quyền của vai trò
-- họ đang có, chỉ được nới chỗ dùng sang đơn vị đích. Không đụng gì tới ràng buộc một
-- trưởng một phó.
CREATE TABLE org_unit_delegations (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    -- Người được nới quyền.
    delegate_user_id   UUID NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
    -- Đơn vị ĐÍCH được quản lý (B).
    org_unit_id        UUID NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
    -- Đơn vị NGUỒN của người được uỷ quyền (A) — chỉ để hiển thị và truy vết,
    -- không tham gia tính quyền.
    from_org_unit_id   UUID          REFERENCES org_units(id) ON DELETE SET NULL,
    -- Kèm cả cây con của đơn vị đích hay chỉ đúng đơn vị đó.
    include_subtree    BOOLEAN NOT NULL DEFAULT TRUE,
    -- Cho phép ký thay vai trò TRƯỞNG đơn vị đích (chấm hạnh kiểm là việc duy nhất hiện
    -- đòi rank 0). Tách riêng vì đây là chữ ký của người đứng đầu, không phải quyền thường.
    can_act_as_leader  BOOLEAN NOT NULL DEFAULT TRUE,
    reason             TEXT,
    starts_at          TIMESTAMPTZ,
    expires_at         TIMESTAMPTZ,
    created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ,
    -- Thu hồi = xoá mềm, theo đúng quy ước của dự án. Giữ lại vì uỷ quyền là dấu vết cần
    -- đối chiếu khi ai đó hỏi "sao người này chốt được phòng tôi".
    deleted_at         TIMESTAMPTZ
);

-- Một người chỉ có một dòng uỷ quyền còn hiệu lực cho mỗi đơn vị đích.
CREATE UNIQUE INDEX uq_delegation_active
    ON org_unit_delegations (delegate_user_id, org_unit_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_delegation_user ON org_unit_delegations (delegate_user_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_delegation_unit ON org_unit_delegations (org_unit_id)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE org_unit_delegations IS
    'Uỷ quyền quản lý chéo đơn vị: nới PHẠM VI của quyền sẵn có sang một đơn vị khác cây';


-- ====================================================
-- Create trigger for insert path
-- ====================================================
CREATE OR REPLACE FUNCTION fn_set_org_path()
RETURNS TRIGGER AS $$
DECLARE
    parent_path TEXT;
BEGIN
    IF NEW.parent_id IS NULL THEN
        NEW.path := '/' || NEW.id || '/';
    ELSE
        SELECT path INTO parent_path
        FROM org_units
        WHERE id = NEW.parent_id;

        NEW.path := parent_path || NEW.id || '/';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ====================================================
-- Create trigger for insert path 
-- ====================================================
CREATE TRIGGER trg_set_org_path
BEFORE INSERT ON org_units
FOR EACH ROW
EXECUTE FUNCTION fn_set_org_path();

-- ====================================================
-- Create function for update path 
-- ====================================================
CREATE OR REPLACE FUNCTION fn_update_org_subtree()
RETURNS TRIGGER AS $$
DECLARE
    old_path TEXT;
    new_path TEXT;
BEGIN
    IF NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN

        old_path := OLD.path;

        IF NEW.parent_id IS NULL THEN
            new_path := '/' || NEW.id || '/';
        ELSE
            SELECT path || NEW.id || '/'
            INTO new_path
            FROM org_units
            WHERE id = NEW.parent_id;
        END IF;

        -- ❗ tránh move vào chính con của nó
        IF new_path LIKE old_path || '%' THEN
            RAISE EXCEPTION 'Cannot move node into its own subtree';
        END IF;

        -- update node
        UPDATE org_units
        SET path = new_path
        WHERE id = NEW.id;

        -- update subtree
        UPDATE org_units
        SET path = replace(path, old_path, new_path)
        WHERE path LIKE old_path || '%'
          AND id <> NEW.id;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ====================================================
-- Create trigger for update path
-- ====================================================
CREATE TRIGGER trg_update_org_subtree
AFTER UPDATE OF parent_id ON org_units
FOR EACH ROW
EXECUTE FUNCTION fn_update_org_subtree();

-- ====================================================
-- Luồng KPI cấu hình được
--
-- Dự án dùng ddl-auto=update nên Hibernate cũng tự tạo được bảng/cột từ entity (bảng
-- kpi_adjustment_requests là ví dụ — nó không nằm trong file này). Vẫn khai báo tường minh để
-- lược đồ đọc được từ migration, và dùng IF NOT EXISTS để chạy được cả trên database mà
-- Hibernate đã kịp tạo trước.
-- ====================================================

CREATE TABLE IF NOT EXISTS kpi_workflow_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    -- Cố ý KHÔNG đặt CHECK constraint theo enum lên cột này: xem report_widgets.widget_type để
    -- thấy cái giá của việc đó (enum Java + CHECK SQL + union TS phải sửa cùng lúc).
    definition      JSONB NOT NULL DEFAULT '{}'::jsonb,
    version         INT NOT NULL DEFAULT 1,
    updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ
);

-- Mỗi tổ chức nhiều nhất một cấu hình còn hiệu lực. Index từng phần để bản đã xoá mềm không chiếm chỗ.
CREATE UNIQUE INDEX IF NOT EXISTS ux_kpi_workflow_configs_org
    ON kpi_workflow_configs (organization_id) WHERE deleted_at IS NULL;

-- ====================================================
-- KPI Adjustment Requests (yêu cầu điều chỉnh chỉ tiêu / ngưng KPI)
--
-- Trước đây bảng này KHÔNG nằm trong V1 mà do Hibernate ddl-auto=update tạo từ entity
-- KpiAdjustmentRequest (cột VARCHAR không giới hạn, FK tên hash, không index). Khai báo
-- tường minh để dev/prod cùng schema và có index cho các câu findByRequesterId /
-- findAllWithFilters / findByStatusAndCreatedAtBefore. Trên prod bảng đã tồn tại: chỉ cần
-- chạy backend/db/ops/005_drop_duplicate_indexes.sql để thêm index.
-- previous_kpi_status: memento — trạng thái KPI ngay trước khi yêu cầu đẩy nó sang EDIT, để
-- từ chối trả về đúng chỗ cũ (NULL với dữ liệu cũ -> APPROVED như trước).
-- ====================================================
CREATE TABLE IF NOT EXISTS kpi_adjustment_requests (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_criteria_id         UUID NOT NULL REFERENCES kpi_criteria(id),
    requester_id            UUID NOT NULL REFERENCES users(id),
    reviewer_id             UUID REFERENCES users(id),
    requested_target_value  DOUBLE PRECISION,
    requested_minimum_value DOUBLE PRECISION,
    is_deactivation_request BOOLEAN NOT NULL DEFAULT FALSE,
    reason                  TEXT,
    status                  VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    previous_kpi_status     VARCHAR(32),
    reviewer_note           TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kpi_adj_requester      ON kpi_adjustment_requests (requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kpi_adj_criteria       ON kpi_adjustment_requests (kpi_criteria_id);
CREATE INDEX IF NOT EXISTS idx_kpi_adj_status_created ON kpi_adjustment_requests (status, created_at);

