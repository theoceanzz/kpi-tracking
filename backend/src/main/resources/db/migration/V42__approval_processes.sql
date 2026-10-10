-- QUY TRÌNH DUYỆT (kiểu 1Office): admin vẽ sơ đồ Bắt đầu → điều kiện → bước duyệt → Đã duyệt /
-- Không duyệt cho một đối tượng (Giao KPI, Yêu cầu điều chỉnh KPI). Lúc gửi duyệt, quy trình khớp
-- được đi một lượt theo điều kiện và chụp thành các bước của chuỗi duyệt (kpi_approval_steps) — nên
-- hộp "Chờ tôi duyệt", thông báo, nhắc hạn, gán lại và lịch sử dùng lại nguyên.
--
-- Bảng mới nên index tạo thường; hai ALTER chỉ thêm cột cho phép NULL, không mặc định.

CREATE TABLE IF NOT EXISTS approval_processes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title            VARCHAR(255) NOT NULL,
    object_type      VARCHAR(30)  NOT NULL,
    -- Mã đối tượng con áp dụng; mảng rỗng = tất cả.
    sub_object_types JSONB        NOT NULL DEFAULT '[]'::jsonb,
    approval_type    VARCHAR(20)  NOT NULL DEFAULT 'PROCESS',
    show_in_object   BOOLEAN      NOT NULL DEFAULT FALSE,
    active           BOOLEAN      NOT NULL DEFAULT TRUE,
    -- Sơ đồ: {schemaVersion, nodes:[…], edges:[…]} — xem ProcessGraph.java.
    definition       JSONB        NOT NULL,
    created_by_id    UUID         REFERENCES users(id) ON DELETE SET NULL,
    updated_by_id    UUID         REFERENCES users(id) ON DELETE SET NULL,
    version          BIGINT       NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ,
    deleted_at       TIMESTAMPTZ
);
COMMENT ON COLUMN approval_processes.object_type IS 'KPI_CRITERIA | KPI_ADJUSTMENT';
COMMENT ON COLUMN approval_processes.sub_object_types IS
    'KPI_CRITERIA: QUANTITATIVE | QUALITATIVE; KPI_ADJUSTMENT: CHANGE_TARGET | DEACTIVATE. Rỗng = tất cả.';
COMMENT ON COLUMN approval_processes.approval_type IS 'PROCESS (kiểu "Tùy chọn" của 1Office chưa làm)';
CREATE INDEX IF NOT EXISTS idx_approval_processes_org_object
    ON approval_processes (organization_id, object_type) WHERE deleted_at IS NULL;

-- Người theo dõi: nhận thông báo khi một yêu cầu bắt đầu theo quy trình và khi có kết quả.
CREATE TABLE IF NOT EXISTS approval_process_followers (
    process_id UUID NOT NULL REFERENCES approval_processes(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (process_id, user_id)
);

-- Flow chạy theo quy trình nào (ảnh chụp: sửa/xoá quy trình không đổi flow đang chạy).
ALTER TABLE kpi_approval_flows ADD COLUMN IF NOT EXISTS process_id UUID
    REFERENCES approval_processes(id) ON DELETE SET NULL;
ALTER TABLE kpi_approval_flows ADD COLUMN IF NOT EXISTS process_title VARCHAR(255);
-- {graph, pathNodeIds, showInObject}: graph chỉ lưu khi quy trình bật "hiển thị trong đối tượng".
ALTER TABLE kpi_approval_flows ADD COLUMN IF NOT EXISTS process_snapshot JSONB;

ALTER TABLE kpi_approval_steps ADD COLUMN IF NOT EXISTS step_name VARCHAR(255);
ALTER TABLE kpi_approval_steps ADD COLUMN IF NOT EXISTS step_code VARCHAR(20);
ALTER TABLE kpi_approval_steps ADD COLUMN IF NOT EXISTS process_node_id VARCHAR(64);
COMMENT ON COLUMN kpi_approval_steps.kind IS 'UNIT_HEAD | ADMIN_FALLBACK | PROCESS_STEP';
