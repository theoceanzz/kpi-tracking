-- CHUỖI DUYỆT KPI THEO PHÂN CẤP + QUYỀN DUYỆT CUỐI (KPI:APPROVE_FINAL).
--
-- Mỗi lần gửi duyệt (chỉ tiêu, hoặc yêu cầu điều chỉnh) sinh MỘT flow. Chuỗi người duyệt được
-- chụp lại vào kpi_approval_steps ngay lúc gửi: cơ cấu tổ chức đổi giữa chừng thì chuỗi đang chạy
-- không đổi theo, admin gán lại người duyệt của bước đang chờ nếu cần. Trạng thái KPI vẫn là
-- PENDING_APPROVAL (hoặc EDIT với điều chỉnh) trong suốt chuỗi, nên khoá kỳ / BSC / thống kê
-- trọng số không phải biết tới bảng này.
--
-- Cả bốn bảng đều mới nên index tạo thường.

-- ── Flow: một lần gửi duyệt ──
CREATE TABLE IF NOT EXISTS kpi_approval_flows (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subject_type          VARCHAR(20) NOT NULL,
    kpi_criteria_id       UUID        NOT NULL REFERENCES kpi_criteria(id) ON DELETE CASCADE,
    adjustment_request_id UUID        REFERENCES kpi_adjustment_requests(id) ON DELETE CASCADE,
    requester_id          UUID        REFERENCES users(id) ON DELETE SET NULL,
    round                 INT         NOT NULL DEFAULT 1,
    status                VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
    current_step_order    INT,
    started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at           TIMESTAMPTZ,
    version               BIGINT      NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ
);
COMMENT ON COLUMN kpi_approval_flows.subject_type IS 'CRITERIA | ADJUSTMENT';
COMMENT ON COLUMN kpi_approval_flows.status IS 'IN_PROGRESS | APPROVED | REJECTED | CANCELLED | CLOSED_BY_LOCK';
COMMENT ON COLUMN kpi_approval_flows.round IS 'Lần gửi thứ mấy của cùng đối tượng (bị từ chối rồi gửi lại thì tăng).';

-- Mỗi đối tượng có tối đa MỘT flow đang chạy — chốt chặn cuối cho trường hợp gửi trùng.
CREATE UNIQUE INDEX IF NOT EXISTS uq_kpi_approval_flows_criteria_running
    ON kpi_approval_flows (kpi_criteria_id)
    WHERE status = 'IN_PROGRESS' AND subject_type = 'CRITERIA';
CREATE UNIQUE INDEX IF NOT EXISTS uq_kpi_approval_flows_adjustment_running
    ON kpi_approval_flows (adjustment_request_id)
    WHERE status = 'IN_PROGRESS' AND subject_type = 'ADJUSTMENT';
CREATE INDEX IF NOT EXISTS idx_kpi_approval_flows_kpi ON kpi_approval_flows (kpi_criteria_id, started_at);

-- ── Bước: ảnh chụp chuỗi lúc gửi ──
CREATE TABLE IF NOT EXISTS kpi_approval_steps (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id          UUID        NOT NULL REFERENCES kpi_approval_flows(id) ON DELETE CASCADE,
    step_order       INT         NOT NULL,
    kind             VARCHAR(20) NOT NULL DEFAULT 'UNIT_HEAD',
    org_unit_id      UUID        REFERENCES org_units(id) ON DELETE SET NULL,
    org_unit_name    VARCHAR(255),
    -- Một người kiêm trưởng nhiều cấp liên tiếp ⇒ các cấp gộp thành một bước: [{id,name}, ...]
    merged_units     JSONB,
    status           VARCHAR(30) NOT NULL,
    skip_reason      TEXT,
    pending_since    TIMESTAMPTZ,
    last_reminded_at TIMESTAMPTZ,
    acted_by_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
    acted_at         TIMESTAMPTZ,
    reason           TEXT,
    CONSTRAINT uq_kpi_approval_steps_order UNIQUE (flow_id, step_order)
);
COMMENT ON COLUMN kpi_approval_steps.kind IS 'UNIT_HEAD | ADMIN_FALLBACK';
COMMENT ON COLUMN kpi_approval_steps.status IS
    'WAITING | PENDING | APPROVED_FORWARDED | APPROVED_FINAL | REJECTED | SKIPPED_DELEGATED | SKIPPED_NO_HEAD | SKIPPED_INACTIVE | CANCELLED';
-- Quét nhắc việc: chỉ bước đang chờ.
CREATE INDEX IF NOT EXISTS idx_kpi_approval_steps_pending
    ON kpi_approval_steps (pending_since) WHERE status = 'PENDING';

-- Người giữ bước. Nhiều dòng khi đơn vị có nhiều trưởng (ai trong nhóm bấm trước thì được).
CREATE TABLE IF NOT EXISTS kpi_approval_step_approvers (
    step_id   UUID NOT NULL REFERENCES kpi_approval_steps(id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_name VARCHAR(255),
    PRIMARY KEY (step_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_kpi_approval_step_approvers_user ON kpi_approval_step_approvers (user_id);

-- ── Lịch sử: chỉ ghi thêm ──
CREATE TABLE IF NOT EXISTS kpi_approval_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id     UUID        NOT NULL REFERENCES kpi_approval_flows(id) ON DELETE CASCADE,
    step_id     UUID        REFERENCES kpi_approval_steps(id) ON DELETE SET NULL,
    step_order  INT,
    action      VARCHAR(30) NOT NULL,
    actor_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
    actor_name  VARCHAR(255),
    reason      TEXT,
    detail      JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON COLUMN kpi_approval_events.action IS
    'SUBMITTED | APPROVED_FORWARD | APPROVED_FINAL | REJECTED | SKIPPED_DELEGATED | SKIPPED_NO_HEAD | SKIPPED_INACTIVE | SELF_APPROVED_TOP | REASSIGNED | AUTO_ESCALATED | REMINDED | CANCELLED | CLOSED_BY_LOCK | MIGRATED';
CREATE INDEX IF NOT EXISTS idx_kpi_approval_events_flow ON kpi_approval_events (flow_id, created_at);

-- ── Điều chỉnh: bước trung gian gợi ý % bù trừ, người duyệt cuối mới chốt ──
ALTER TABLE kpi_adjustment_requests ADD COLUMN IF NOT EXISTS suggested_compensation_percent DOUBLE PRECISION;

-- ── Cấu hình luồng: chuỗi duyệt thành mặc định cho MỌI tổ chức ──
-- Tổ chức chưa lưu cấu hình thì tự nhận mặc định mới (CHAIN) từ code. Tổ chức đã lưu thì cột
-- definition đang chép lại "UNIT_HEAD" — giá trị mặc định cũ chứ không phải lựa chọn có chủ ý (đó
-- là lựa chọn duy nhất có trên giao diện) — nên chuyển luôn sang CHAIN. Muốn quay về luồng một cấp
-- thì đặt lại approverMode = UNIT_HEAD ở màn cấu hình luồng KPI, không cần sửa code.
UPDATE kpi_workflow_configs
   SET definition = regexp_replace(definition::text,
                                   '"approverMode"\s*:\s*"UNIT_HEAD"',
                                   '"approverMode": "CHAIN"', 'g')::jsonb
 WHERE definition::text ~ '"approverMode"\s*:\s*"UNIT_HEAD"';

-- ── Quyền duyệt cuối ──
INSERT INTO permissions (id, code, resource, action, description) VALUES
  ('00000000-0000-0000-0000-000000000701', 'KPI:APPROVE_FINAL', 'KPI', 'APPROVE_FINAL',
   'Duyệt cuối chỉ tiêu KPI và yêu cầu điều chỉnh của đơn vị mình quản lý (kể cả đơn vị con): duyệt xong là ĐÃ DUYỆT, các cấp phía trên được bỏ qua')
ON CONFLICT DO NOTHING;

-- Gán sẵn cho (1) vai trò TRƯỞNG (rank 0) đang được gán tại đơn vị GỐC của tổ chức — người duyệt
-- cấp cao nhất — và (2) vai trò có SYSTEM:ADMIN. Quyền duyệt cuối được kiểm TƯỜNG MINH, không suy
-- từ SYSTEM:ADMIN, nên muốn admin cũng duyệt cuối thì vai trò đó phải có dòng này; tắt ở màn cấu
-- hình quyền là tắt thật.
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT uro.role_id, np.id
  FROM user_role_org_units uro
  JOIN roles r       ON r.id = uro.role_id
  JOIN org_units ou  ON ou.id = uro.org_unit_id
  JOIN permissions np ON np.code = 'KPI:APPROVE_FINAL'
 WHERE ou.parent_id IS NULL
   AND ou.deleted_at IS NULL
   AND r.rank = 0
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, np.id
  FROM role_permissions rp
  JOIN permissions op ON op.id = rp.permission_id
  JOIN permissions np ON np.code = 'KPI:APPROVE_FINAL'
 WHERE op.code = 'SYSTEM:ADMIN'
ON CONFLICT DO NOTHING;

-- KPI:APPROVE_OWN giữ nghĩa cũ ở chuỗi duyệt: người có quyền tạo chỉ tiêu là ĐÃ DUYỆT ngay, không qua
-- chuỗi (chuỗi chỉ dành cho người không có quyền tự duyệt). Mô tả gốc của V2, thêm vế "không qua chuỗi duyệt".
UPDATE permissions
   SET description = 'Cho phép chỉ tiêu KPI tự tạo được duyệt ngay (tự động chuyển sang trạng thái đã duyệt khi tạo) mà không cần chờ người khác phê duyệt, không qua chuỗi duyệt'
 WHERE code = 'KPI:APPROVE_OWN';
