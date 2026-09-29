-- V20 — Quy chế chấm AI áp THEO ĐƠN VỊ, có phân cấp.
--
-- Quản lý (GĐ, Phó GĐ, Trưởng đơn vị) tải và áp quy chế cho đơn vị mình quản lý và các đơn vị con, mỗi đơn vị
-- MỘT tài liệu đang áp. Tài liệu do cấp trên áp thì cấp dưới không thay được — chỉ gửi ĐỀ NGHỊ, người đã áp
-- (hoặc cấp cao hơn) đồng ý / từ chối.

-- Quyền mới, gán cho mọi vai trò đang được dùng AI chấm (bám quyền có sẵn, như V14) để công ty tạo sau cũng có.
INSERT INTO permissions (id, code, resource, action, description) VALUES
    ('00000000-0000-0000-0000-000000000603', 'AI_CRITERIA:MANAGE', 'AI_CRITERIA', 'MANAGE',
     'Tải và áp quy chế chấm AI cho đơn vị mình quản lý và các đơn vị con')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, p.id
FROM role_permissions rp
JOIN permissions src ON src.id = rp.permission_id AND src.code = 'AI_REVIEW:USE'
CROSS JOIN permissions p
WHERE p.code = 'AI_CRITERIA:MANAGE'
ON CONFLICT DO NOTHING;

-- Đề nghị đổi tài liệu đang áp cho một đơn vị (cấp dưới gửi, người đã áp / cấp trên quyết).
CREATE TABLE IF NOT EXISTS ai_criteria_change_requests (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL REFERENCES organizations(id),
    org_unit_id      UUID NOT NULL REFERENCES org_units(id),
    current_set_id   UUID REFERENCES ai_criteria_sets(id) ON DELETE SET NULL,     -- tài liệu đang áp lúc gửi
    proposed_set_id  UUID NOT NULL REFERENCES ai_criteria_sets(id) ON DELETE CASCADE,
    requested_by     UUID NOT NULL REFERENCES users(id),
    approver_id      UUID REFERENCES users(id),                                  -- người được báo để quyết
    status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    note             TEXT,
    decision_note    TEXT,
    decided_by       UUID REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at       TIMESTAMPTZ,
    CONSTRAINT ck_ai_criteria_request_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'))
);

-- Một tài liệu chỉ có một đề nghị đang chờ.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_criteria_request_pending
    ON ai_criteria_change_requests(proposed_set_id) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_ai_criteria_request_org_status
    ON ai_criteria_change_requests(organization_id, status);
