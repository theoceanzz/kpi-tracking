-- Đơn từ (kiểu Lark Approval): nhóm đơn, đơn (form + quy trình duyệt riêng của đơn), đơn đã nộp.
-- Quy trình duyệt của đơn nằm ngay trên đơn (process_definition, cùng định dạng approval_processes.definition)
-- và chạy qua chuỗi duyệt chung (kpi_approval_flows, subject_type = 'FORM_REQUEST', subject_id = id đơn đã nộp).

-- ═══ 1. Nhóm đơn ═════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS approval_form_groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    -- Tên theo ngôn ngữ: {"vi": "...", "en": "..."}; hiển thị theo ngôn ngữ người xem, thiếu thì lấy bản còn lại.
    name            JSONB NOT NULL DEFAULT '{}'::jsonb,
    sort_order      INT NOT NULL DEFAULT 0,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    -- Mã nhóm dựng sẵn (PERSONNEL, ATTENDANCE…); NULL = nhóm người dùng tạo.
    code            VARCHAR(40),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_approval_form_groups_org
    ON approval_form_groups(organization_id, sort_order) WHERE deleted_at IS NULL;

-- ═══ 2. Đơn ══════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS approval_forms (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    group_id           UUID NOT NULL REFERENCES approval_form_groups(id),
    -- Mã mẫu trong thư viện (resources/approval-forms/library.json) nếu đơn tạo từ mẫu.
    template_code      VARCHAR(60),
    icon               VARCHAR(40) NOT NULL,
    color              VARCHAR(20) NOT NULL,
    name               JSONB NOT NULL DEFAULT '{}'::jsonb,
    description        JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Ai được nộp: ALL | SPECIFIED (người + đơn vị kể cả đơn vị con trong submitters) | NONE.
    submitter_scope    VARCHAR(20) NOT NULL DEFAULT 'ALL',
    submitters         JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Người quản lý đơn: [{"userId": "...", "permissions": ["EDIT_FORM", "MANAGE_ADMINS", "MANAGE_PROCESS"]}].
    admins             JSONB NOT NULL DEFAULT '[]'::jsonb,
    form_schema        JSONB NOT NULL DEFAULT '{}'::jsonb,
    process_definition JSONB NOT NULL DEFAULT '{}'::jsonb,
    active             BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order         INT NOT NULL DEFAULT 0,
    version            BIGINT NOT NULL DEFAULT 0,
    created_by_id      UUID REFERENCES users(id),
    updated_by_id      UUID REFERENCES users(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ,
    deleted_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_approval_forms_org
    ON approval_forms(organization_id, group_id, sort_order) WHERE deleted_at IS NULL;

-- ═══ 3. Đơn đã nộp ═══════════════════════════════════════════════════════════════════════════════
CREATE SEQUENCE IF NOT EXISTS approval_request_no_seq;

CREATE TABLE IF NOT EXISTS approval_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    form_id         UUID NOT NULL REFERENCES approval_forms(id),
    -- Mã hiển thị: yyyyMMdd + 6 số từ approval_request_no_seq.
    code            VARCHAR(30) NOT NULL UNIQUE,
    requester_id    UUID NOT NULL REFERENCES users(id),
    org_unit_id     UUID NOT NULL REFERENCES org_units(id),
    -- Chụp lúc nộp: đơn bị sửa / xoá sau đó thì đơn đã nộp vẫn hiện đúng như lúc nộp.
    form_name       JSONB NOT NULL DEFAULT '{}'::jsonb,
    form_icon       VARCHAR(40) NOT NULL,
    form_color      VARCHAR(20) NOT NULL,
    form_snapshot   JSONB NOT NULL DEFAULT '{}'::jsonb,
    form_values     JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- PENDING | APPROVED | REJECTED | WITHDRAWN
    status          VARCHAR(20) NOT NULL,
    reject_reason   TEXT,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requester
    ON approval_requests(organization_id, requester_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status
    ON approval_requests(organization_id, status);

-- ═══ 4. Cờ đã dựng sẵn nhóm + đơn mẫu cho tổ chức ════════════════════════════════════════════════
-- Dựng lần đầu có người mở mục Đơn từ (ApprovalFormSeeder); quản trị xoá hết thì không dựng lại.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS approval_forms_seeded_at TIMESTAMPTZ;

-- ═══ 5. Quyền ════════════════════════════════════════════════════════════════════════════════════
-- Id dải 0Bxx (0Axx = KPI_COMMENT / TASK).
INSERT INTO permissions (id, code, resource, action, description) VALUES
  ('00000000-0000-0000-0000-000000000b01', 'APPROVAL_FORM:MANAGE', 'APPROVAL_FORM', 'MANAGE',
   'Quản trị đơn từ: nhóm đơn, tạo / sửa / tắt / xoá mọi đơn và quy trình duyệt của đơn')
ON CONFLICT DO NOTHING;

-- Vai trò quản trị và vai trò đang quản lý quy trình duyệt.
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT r.id, np.id
  FROM roles r
  JOIN permissions np ON np.code = 'APPROVAL_FORM:MANAGE'
 WHERE r.deleted_at IS NULL
   AND EXISTS (SELECT 1 FROM role_permissions rp JOIN permissions op ON op.id = rp.permission_id
                WHERE rp.role_id = r.id AND op.code IN ('SYSTEM:ADMIN', 'WORKFLOW:MANAGE'))
ON CONFLICT DO NOTHING;
