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
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
CREATE TABLE kpi_periods (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
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
    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_objectives_org_id ON objectives(organization_id);

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
    weight          DOUBLE PRECISION,
    target_value    DOUBLE PRECISION,
    minimum_value   DOUBLE PRECISION,
    compensated_achievement_percent DOUBLE PRECISION,
    unit            VARCHAR(50),
    frequency       VARCHAR(20)     NOT NULL,
    key_result_id   UUID            REFERENCES key_results(id) ON DELETE SET NULL,
    parent_id       UUID            REFERENCES kpi_criteria(id) ON DELETE SET NULL,
    parent_relation_type VARCHAR(20),
    is_reverse_kpi  BOOLEAN         NOT NULL DEFAULT FALSE,
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