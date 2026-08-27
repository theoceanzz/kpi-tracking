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

CREATE INDEX idx_users_email ON users(email);
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

ALTER TABLE organizations
    ADD CONSTRAINT fk_org_lark_default_org_unit
        FOREIGN KEY (lark_default_org_unit_id) REFERENCES org_units (id),
    ADD CONSTRAINT fk_org_lark_default_role
        FOREIGN KEY (lark_default_role_id) REFERENCES roles (id);

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
    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (kpi_cycle_id, org_unit_id)
);

COMMENT ON COLUMN cycle_unit_evaluations.classification IS
    'Xếp loại đơn vị chụp lúc chốt kỳ — áp luật xếp loại lên phân bố mức của thành viên trong kỳ';

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
    parent_id       UUID            REFERENCES kpi_criteria(id) ON DELETE SET NULL,
    parent_relation_type VARCHAR(20),
    is_bonus_kpi    BOOLEAN         NOT NULL DEFAULT FALSE,
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
CREATE INDEX idx_submissions_deleted_at ON kpi_submissions(deleted_at);

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
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

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

CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

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
    UNIQUE (conversation_id, msg_index)
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);

-- ====================================================
-- BSC — Thẻ điểm (Scorecard) & trọng số viễn cảnh theo kỳ
-- Đặt cuối vì tham chiếu kpi_periods / users / evaluations / objectives.
-- (bsc_perspectives đã khai báo sớm ở trên, ngay sau organizations.)
-- ====================================================

-- Thẻ điểm — mỗi tổ chức + kỳ một bản.
-- Tham số chấm điểm đặt Ở ĐÂY (theo kỳ) chứ không ở organizations: mỗi kỳ "đóng băng" chính sách
-- của chính nó ⇒ tính lại điểm kỳ cũ luôn ra đúng số cũ, dù kỳ sau HR đổi chính sách.
CREATE TABLE bsc_scorecards (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id           UUID            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    kpi_period_id             UUID            NOT NULL REFERENCES kpi_periods(id) ON DELETE CASCADE,
    name                      VARCHAR(255)    NOT NULL,
    vision                    TEXT,
    status                    VARCHAR(20)     NOT NULL DEFAULT 'DRAFT'
                                  CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED')),
    scoring_mode              VARCHAR(20)     NOT NULL DEFAULT 'SHADOW'
                                  CHECK (scoring_mode IN ('SHADOW','OFFICIAL')),
    empty_perspective_policy  VARCHAR(20)     NOT NULL DEFAULT 'RENORMALIZE'
                                  CHECK (empty_perspective_policy IN ('RENORMALIZE','ZERO_FILL')),
    created_at                TIMESTAMPTZ     DEFAULT NOW(),
    updated_at                TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at                TIMESTAMPTZ
);

CREATE INDEX idx_bsc_scorecards_organization_id ON bsc_scorecards(organization_id);
CREATE INDEX idx_bsc_scorecards_kpi_period_id ON bsc_scorecards(kpi_period_id);
-- Tính duy nhất (1 thẻ mặc định/kỳ, mỗi đơn vị ≤1 thẻ/kỳ) được ENFORCE Ở SERVICE
-- vì thẻ điểm áp dụng cho NHIỀU đơn vị (bảng nối bsc_scorecard_org_units bên dưới).

-- Thẻ điểm áp dụng cho NHIỀU phòng ban (giống OKR objective_org_units). Danh sách RỖNG = mặc định toàn tổ chức.
CREATE TABLE bsc_scorecard_org_units (
    scorecard_id UUID NOT NULL REFERENCES bsc_scorecards(id) ON DELETE CASCADE,
    org_unit_id  UUID NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
    PRIMARY KEY (scorecard_id, org_unit_id)
);
CREATE INDEX idx_bsc_scorecard_org_units_unit ON bsc_scorecard_org_units(org_unit_id);

-- Viễn cảnh trong thẻ điểm + trọng số (%) — tổng = 100 mỗi scorecard
CREATE TABLE bsc_scorecard_perspectives (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scorecard_id      UUID            NOT NULL REFERENCES bsc_scorecards(id) ON DELETE CASCADE,
    perspective_id    UUID            NOT NULL REFERENCES bsc_perspectives(id) ON DELETE CASCADE,
    weight_percentage DOUBLE PRECISION NOT NULL DEFAULT 0,
    display_order     INT             NOT NULL DEFAULT 0,
    UNIQUE (scorecard_id, perspective_id)
);

CREATE INDEX idx_bsc_scorecard_perspectives_scorecard_id ON bsc_scorecard_perspectives(scorecard_id);

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
    -- Điểm thô của viễn cảnh (0..150): trung bình có trọng số các KPI của NV trong viễn cảnh.
    -- NULL = nhân viên không có KPI nào trong viễn cảnh (viễn cảnh rỗng).
    raw_score         DOUBLE PRECISION,
    -- Đóng góp = weight_percentage% × raw_score
    weighted_score    DOUBLE PRECISION,
    kpi_count         INT              NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ      DEFAULT NOW()
);

CREATE INDEX idx_evaluation_perspective_scores_evaluation_id ON evaluation_perspective_scores(evaluation_id);
CREATE UNIQUE INDEX uq_evaluation_perspective_scores
    ON evaluation_perspective_scores(evaluation_id, perspective_id);

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
