-- V10: Tệp minh chứng đính kèm cho các lượt chấm (đợt, kỳ, hạnh kiểm) — ngoài bài nộp.
--
-- Bảng submission_attachments gắn cứng vào MỘT bài nộp. Người chấm đợt/kỳ và người tự đánh giá
-- cũng cần đính kèm bằng chứng, mà những lượt chấm đó không có bản ghi để trỏ FK vào lúc đang
-- soạn (bản ghi evaluations / cycle_user_evaluations chỉ sinh ra khi bấm lưu). Vì thế tệp gắn
-- vào một KHOÁ ĐÍCH dạng chuỗi do server quy ước theo loại:
--   PERIOD_EVALUATION  → "<kpi_period_id>:<user_id>"
--   CYCLE_EVALUATION   → "<kpi_cycle_id>:<user_id>"
--   CONDUCT_EVALUATION → "<scope>:<scope_id>:<user_id>"
-- Ai xem/chấm được lượt đó thì xem được tệp; uploader (hoặc quản trị) xoá được.
CREATE TABLE IF NOT EXISTS evidence_attachments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    target_type      VARCHAR(40)   NOT NULL,
    target_key       VARCHAR(160)  NOT NULL,
    file_name        VARCHAR(255)  NOT NULL,
    file_url         TEXT          NOT NULL,
    file_size        BIGINT,
    content_type     VARCHAR(100),
    storage_provider VARCHAR(20)   NOT NULL DEFAULT 'CLOUDINARY',
    storage_key      TEXT,
    note             VARCHAR(500),
    uploaded_by      UUID          NOT NULL REFERENCES users(id),
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_attachments_target
    ON evidence_attachments (organization_id, target_type, target_key);
