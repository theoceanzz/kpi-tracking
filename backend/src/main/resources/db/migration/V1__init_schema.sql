-- ====================================================
-- V1: KPI Tracking - Initial Schema
-- ====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

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

-- ====================================================
-- Companies (Tenants)
-- ====================================================
CREATE TABLE companies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255)    NOT NULL,
    tax_code    VARCHAR(50)     UNIQUE,
    email       VARCHAR(255),
    phone       VARCHAR(20),
    address     TEXT,
    province_id UUID            REFERENCES provinces(id),
    district_id UUID            REFERENCES districts(id),
    logo_url    TEXT,
    status      VARCHAR(20)     NOT NULL DEFAULT 'TRIAL',
    created_at  TIMESTAMPTZ     DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_companies_deleted_at ON companies(deleted_at);

-- ====================================================
-- Users
-- ====================================================
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID            NOT NULL REFERENCES companies(id),
    email               VARCHAR(255)    NOT NULL UNIQUE,
    password            VARCHAR(255)    NOT NULL,
    full_name           VARCHAR(255)    NOT NULL,
    phone               VARCHAR(20),
    avatar_url          TEXT,
    role                VARCHAR(20)     NOT NULL,
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

CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

-- ====================================================
-- Departments
-- ====================================================
CREATE TABLE departments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID            NOT NULL REFERENCES companies(id),
    name        VARCHAR(255)    NOT NULL,
    description TEXT,
    head_id     UUID            REFERENCES users(id),
    deputy_id   UUID            REFERENCES users(id),
    created_at  TIMESTAMPTZ     DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_departments_company_id ON departments(company_id);
CREATE INDEX idx_departments_deleted_at ON departments(deleted_at);

-- ====================================================
-- Department Members (N:N join table)
-- ====================================================
CREATE TABLE department_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id   UUID            NOT NULL REFERENCES departments(id),
    user_id         UUID            NOT NULL REFERENCES users(id),
    position        VARCHAR(20)     NOT NULL,
    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    UNIQUE(department_id, user_id)
);

CREATE INDEX idx_dept_members_department_id ON department_members(department_id);
CREATE INDEX idx_dept_members_user_id ON department_members(user_id);

-- ====================================================
-- KPI Criteria
-- ====================================================
CREATE TABLE kpi_criteria (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID            NOT NULL REFERENCES companies(id),
    department_id   UUID            REFERENCES departments(id),
    assigned_to     UUID            REFERENCES users(id),
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

CREATE INDEX idx_kpi_criteria_company_id ON kpi_criteria(company_id);
CREATE INDEX idx_kpi_criteria_department_id ON kpi_criteria(department_id);
CREATE INDEX idx_kpi_criteria_assigned_to ON kpi_criteria(assigned_to);
CREATE INDEX idx_kpi_criteria_status ON kpi_criteria(status);
CREATE INDEX idx_kpi_criteria_deleted_at ON kpi_criteria(deleted_at);

-- ====================================================
-- KPI Submissions
-- ====================================================
CREATE TABLE kpi_submissions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID            NOT NULL REFERENCES companies(id),
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

CREATE INDEX idx_submissions_company_id ON kpi_submissions(company_id);
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
    company_id          UUID            NOT NULL REFERENCES companies(id),
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

CREATE INDEX idx_evaluations_company_id ON evaluations(company_id);
CREATE INDEX idx_evaluations_user_id ON evaluations(user_id);
CREATE INDEX idx_evaluations_kpi_criteria_id ON evaluations(kpi_criteria_id);
CREATE INDEX idx_evaluations_deleted_at ON evaluations(deleted_at);

-- ====================================================
-- Notifications
-- ====================================================
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID            NOT NULL REFERENCES companies(id),
    user_id         UUID            NOT NULL REFERENCES users(id),
    title           VARCHAR(255)    NOT NULL,
    message         TEXT            NOT NULL,
    type            VARCHAR(50),
    reference_id    UUID,
    is_read         BOOLEAN         NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX idx_notifications_company_user ON notifications(company_id, user_id);
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
