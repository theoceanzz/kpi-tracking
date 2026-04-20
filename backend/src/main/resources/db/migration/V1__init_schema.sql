-- ====================================================
-- V1: KPI Tracking - Initial Schema
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
  status      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','ARCHIVED')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====================================================
-- Organization Hierarchy Levels
-- ====================================================

CREATE TABLE org_hierarchy_levels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    level_order     INT NOT NULL,
    unit_type_name   VARCHAR(100) NOT NULL,
    manager_role_label VARCHAR(100), -- Nullable for the last level
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
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

-- ====================================================
-- Roles
-- ====================================================
CREATE TABLE roles (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  parent_role_id UUID     REFERENCES roles(id) ON DELETE SET NULL,
  is_system  BOOLEAN      NOT NULL DEFAULT false,
  created_by UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (name)
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
-- KPI Criteria
-- ====================================================
CREATE TABLE kpi_criteria (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_unit_id      UUID            NOT NULL REFERENCES org_units(id),
    name            VARCHAR(255)    NOT NULL,
    description     TEXT,
    weight          DOUBLE PRECISION,
    target_value    DOUBLE PRECISION,
    unit            VARCHAR(50),
    frequency       VARCHAR(20)     NOT NULL,
    status          VARCHAR(20)     NOT NULL DEFAULT 'DRAFT',
    created_by      UUID            NOT NULL REFERENCES users(id),
    approved_by     UUID            REFERENCES users(id),
    reject_reason   TEXT,
    submitted_at    TIMESTAMPTZ,
    approved_at     TIMESTAMPTZ,
    start_date      TIMESTAMPTZ,
    end_date        TIMESTAMPTZ,
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
-- KPI Submissions
-- ====================================================
CREATE TABLE kpi_submissions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_unit_id          UUID            NOT NULL REFERENCES org_units(id),
    kpi_criteria_id     UUID            NOT NULL REFERENCES kpi_criteria(id),
    submitted_by        UUID            NOT NULL REFERENCES users(id),
    actual_value        DOUBLE PRECISION,
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
    kpi_criteria_id     UUID            NOT NULL REFERENCES kpi_criteria(id),
    evaluator_id        UUID            NOT NULL REFERENCES users(id),
    score               DOUBLE PRECISION,
    comment             TEXT,
    period_start        TIMESTAMPTZ,
    period_end          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_evaluations_org_unit_id ON evaluations(org_unit_id);
CREATE INDEX idx_evaluations_user_id ON evaluations(user_id);
CREATE INDEX idx_evaluations_kpi_criteria_id ON evaluations(kpi_criteria_id);
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