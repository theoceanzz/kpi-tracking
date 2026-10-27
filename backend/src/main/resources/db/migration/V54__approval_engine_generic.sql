-- Chuỗi duyệt dùng chung cho mọi đối tượng có quy trình duyệt (không chỉ chỉ tiêu KPI / điều chỉnh).
--
-- Flow của chỉ tiêu / điều chỉnh giữ nguyên kpi_criteria_id + adjustment_request_id như cũ. Đối
-- tượng mới (bài nộp kết quả, rồi đánh giá, chốt kỳ, BSC, thưởng ở các đợt sau) chỉ ghi
-- (subject_type, subject_id) và để kpi_criteria_id trống: mọi truy vấn cũ theo KPI (lịch sử duyệt,
-- người xem KPI, huỷ khi KPI bị thay thế) vì thế không vô tình kéo theo flow của đối tượng khác.

ALTER TABLE kpi_approval_flows ALTER COLUMN kpi_criteria_id DROP NOT NULL;
ALTER TABLE kpi_approval_flows ALTER COLUMN subject_type TYPE VARCHAR(30);

ALTER TABLE kpi_approval_flows ADD COLUMN IF NOT EXISTS subject_id UUID;
ALTER TABLE kpi_approval_flows ADD COLUMN IF NOT EXISTS subject_org_unit_id UUID REFERENCES org_units(id) ON DELETE SET NULL;
ALTER TABLE kpi_approval_flows ADD COLUMN IF NOT EXISTS subject_name VARCHAR(500);

COMMENT ON COLUMN kpi_approval_flows.subject_type IS 'CRITERIA | ADJUSTMENT | SUBMISSION';
COMMENT ON COLUMN kpi_approval_flows.subject_id IS 'Id đối tượng đang duyệt (KPI, yêu cầu điều chỉnh, bài nộp…).';
COMMENT ON COLUMN kpi_approval_flows.subject_org_unit_id IS 'Đơn vị của đối tượng — phạm vi kiểm quyền và tìm người duyệt.';
COMMENT ON COLUMN kpi_approval_flows.subject_name IS 'Tên đối tượng lúc gửi, để hiện trong hộp chờ duyệt và thông báo.';

UPDATE kpi_approval_flows f
SET subject_id = CASE WHEN f.subject_type = 'ADJUSTMENT' THEN f.adjustment_request_id ELSE f.kpi_criteria_id END,
    subject_org_unit_id = k.org_unit_id,
    subject_name = k.name
FROM kpi_criteria k
WHERE k.id = f.kpi_criteria_id AND f.subject_id IS NULL;

-- Mỗi đối tượng mới có tối đa MỘT flow đang chạy (chỉ tiêu / điều chỉnh đã có chỉ mục riêng ở V19).
CREATE UNIQUE INDEX IF NOT EXISTS uq_kpi_approval_flows_subject_running
    ON kpi_approval_flows (subject_type, subject_id)
    WHERE status = 'IN_PROGRESS' AND subject_type NOT IN ('CRITERIA', 'ADJUSTMENT');
CREATE INDEX IF NOT EXISTS idx_kpi_approval_flows_subject
    ON kpi_approval_flows (subject_type, subject_id, started_at);

COMMENT ON COLUMN approval_processes.object_type IS
    'KPI_CRITERIA | KPI_SUBMISSION | KPI_EVALUATION | KPI_ADJUSTMENT | CYCLE_FINALIZE | BSC_SCORECARD | BSC_RESULT | REWARD_GRANT | GIFT_REDEMPTION';
