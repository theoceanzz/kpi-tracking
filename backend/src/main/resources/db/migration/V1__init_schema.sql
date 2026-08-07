-- ====================================================
-- V1: KeyGo - Initial Schema
-- ====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- Enable fuzzy search (LIKE %abc%) extension 
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

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
  performance_matrix jsonb,
  unit_classification_rules jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
    is_platform_admin   BOOLEAN         NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);
CREATE UNIQUE INDEX idx_users_employee_code ON users(employee_code);

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