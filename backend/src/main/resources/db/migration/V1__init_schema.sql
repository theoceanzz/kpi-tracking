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
  evaluation_max_score DOUBLE PRECISION DEFAULT 100.0,
  kpi_reminder_percentage INT DEFAULT 50,
  enable_okr BOOLEAN DEFAULT FALSE,
  enable_waterfall BOOLEAN DEFAULT FALSE,
  enable_ai   BOOLEAN NOT NULL DEFAULT TRUE,
  enable_qualitative BOOLEAN NOT NULL DEFAULT FALSE,
  enable_bsc  BOOLEAN NOT NULL DEFAULT FALSE,
  enable_reward BOOLEAN NOT NULL DEFAULT FALSE,
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
  -- Đơn vị/vai trò mặc định cho người dùng được tạo tự động khi đăng nhập Lark lần đầu.
  -- Khoá ngoại thêm ở cuối file vì org_units và roles được tạo sau bảng này.
  lark_default_org_unit_id UUID,
  lark_default_role_id     UUID,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

-- ====================================================
-- Khoá ngoại cho đơn vị/vai trò mặc định của luồng đăng nhập Lark.
-- Đặt ở đây vì organizations được tạo trước org_units và roles.
-- ====================================================
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

-- Quan hệ nhân-quả có hướng giữa các Objective (triết lý BSC: Học hỏi → Quy trình → Khách hàng → Tài chính)
CREATE TABLE bsc_objective_relations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_objective_id UUID            NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
    target_objective_id UUID            NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
    label               VARCHAR(255),
    created_at          TIMESTAMPTZ     DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    -- Không cho tự nối chính nó
    CHECK (source_objective_id <> target_objective_id)
);

CREATE INDEX idx_bsc_objective_relations_org ON bsc_objective_relations(organization_id);
-- Một cặp (nguồn, đích) chỉ có một cạnh (bỏ qua bản ghi xoá mềm)
CREATE UNIQUE INDEX uq_bsc_objective_relations
    ON bsc_objective_relations(source_objective_id, target_objective_id) WHERE deleted_at IS NULL;

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
    source_type                 VARCHAR(20) NOT NULL
        CHECK (source_type IN ('MANUAL_GRANT', 'AUTO_RANKING', 'REDEMPTION', 'SYSTEM', 'EXTERNAL')),
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
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW(),
    deleted_at           TIMESTAMPTZ
);

CREATE INDEX idx_reward_grants_org_status ON reward_grants(organization_id, status, created_at DESC);
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
    status            VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    display_order     INT          NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ  DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_reward_gift_items_org ON reward_gift_items(organization_id, status) WHERE deleted_at IS NULL;

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
    status                VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'DELIVERED', 'CANCELLED')),
    handled_by            UUID         REFERENCES users(id) ON DELETE SET NULL,
    handled_at            TIMESTAMPTZ,
    delivered_at          TIMESTAMPTZ,
    note                  TEXT,
    transaction_id        UUID         REFERENCES reward_transactions(id) ON DELETE SET NULL,
    refund_transaction_id UUID         REFERENCES reward_transactions(id) ON DELETE SET NULL,
    external_order_id     VARCHAR(255),
    fulfillment_payload   jsonb,
    created_at            TIMESTAMPTZ  DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  DEFAULT NOW(),
    deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_reward_redemptions_org_status ON reward_redemptions(organization_id, status, created_at DESC);
CREATE INDEX idx_reward_redemptions_user ON reward_redemptions(user_id, created_at DESC);


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
