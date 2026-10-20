-- Tách tệp của công việc thành hai loại: REFERENCE = tệp đính kèm (người giao đưa để làm việc, như cũ),
-- RESULT = kết quả người thực hiện nộp lại khi làm xong. Tệp đã có đều là REFERENCE.
-- Luật thêm / xoá: KpiTaskAccess.Scope.canRemoveFile. Bảng nhỏ, cột có mặc định hằng ⇒ không viết lại bảng.
ALTER TABLE kpi_task_attachments
    ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'REFERENCE';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_kpi_task_attachments_kind') THEN
        ALTER TABLE kpi_task_attachments
            ADD CONSTRAINT chk_kpi_task_attachments_kind CHECK (kind IN ('REFERENCE', 'RESULT'));
    END IF;
END $$;
