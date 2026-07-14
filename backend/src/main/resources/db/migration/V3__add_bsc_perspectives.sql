-- ====================================================
-- V3: BSC (Balanced Scorecard) - GĐ1 Nền tảng viễn cảnh
-- - Cờ enable_bsc trên organizations
-- - Bảng bsc_perspectives (danh mục viễn cảnh cấu hình theo org)
-- - Cột perspective_id trên kpi_criteria
-- - Permission BSC + seed 4 viễn cảnh mặc định cho org demo
-- ====================================================

-- 1) Feature flag ở cấp org (chỉ bật/tắt tính năng + menu)
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS enable_bsc BOOLEAN NOT NULL DEFAULT FALSE;

-- 2) Danh mục viễn cảnh cấu hình theo org (tái sử dụng nhiều kỳ)
CREATE TABLE bsc_perspectives (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code            VARCHAR(50)     NOT NULL,
    name            VARCHAR(255)    NOT NULL,
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

-- 3) Gán viễn cảnh trực tiếp cho KPI (nullable — KPI có thể suy viễn cảnh từ Objective cha)
ALTER TABLE kpi_criteria
    ADD COLUMN IF NOT EXISTS perspective_id UUID REFERENCES bsc_perspectives(id) ON DELETE SET NULL;

CREATE INDEX idx_kpi_criteria_perspective_id ON kpi_criteria(perspective_id);

-- 4) Permissions BSC
INSERT INTO permissions (id, code, resource, action, description) VALUES
    ('00000000-0000-0000-0000-000000000301', 'BSC:VIEW',          'BSC', 'VIEW',          'Cho phép xem thẻ điểm cân bằng (BSC): viễn cảnh, thẻ điểm, dashboard và bản đồ chiến lược'),
    ('00000000-0000-0000-0000-000000000302', 'BSC:MANAGE',        'BSC', 'MANAGE',        'Cho phép cấu hình viễn cảnh, dựng thẻ điểm, đặt trọng số và quản lý liên kết BSC'),
    ('00000000-0000-0000-0000-000000000303', 'BSC:PUBLISH_SCORE', 'BSC', 'PUBLISH_SCORE', 'Cho phép chuyển thẻ điểm sang chế độ chính thức (điểm BSC thay điểm hệ thống) — quyền cấp cao/HR trưởng')
ON CONFLICT (code) DO NOTHING;

-- 5) Gán permission theo cách data-driven (không hardcode UUID role), khớp với RolePermissionConstants:
--    - BSC:VIEW          → mọi role đã có KPI:VIEW (toàn bộ archetype, kể cả nhân viên — để dùng selector viễn cảnh)
--    - BSC:MANAGE        → role đã có ORG:CREATE (director/deputy_director — cấu hình viễn cảnh/thẻ điểm)
--    - BSC:PUBLISH_SCORE → role đã có EVALUATION:UPDATE (director/deputy_director — chốt điểm chính thức)
INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
FROM role_permissions rp
JOIN permissions src   ON src.id = rp.permission_id AND src.code = 'KPI:VIEW'
JOIN permissions target ON target.code = 'BSC:VIEW'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
FROM role_permissions rp
JOIN permissions src   ON src.id = rp.permission_id AND src.code = 'ORG:CREATE'
JOIN permissions target ON target.code = 'BSC:MANAGE'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
FROM role_permissions rp
JOIN permissions src   ON src.id = rp.permission_id AND src.code = 'EVALUATION:UPDATE'
JOIN permissions target ON target.code = 'BSC:PUBLISH_SCORE'
ON CONFLICT DO NOTHING;