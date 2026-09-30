-- V23 — AI đánh giá bài nộp, giai đoạn 2–3.
--
-- 1. Bộ tiêu chí chấm của tổ chức theo hướng "máy bóc, người xác nhận" (tài liệu phân tích mục 9.3):
--    quản trị tải tài liệu lên, AI bóc thành bảng, người đối chiếu rồi xác nhận. Mỗi lần xác nhận là một
--    PHIÊN BẢN mới; lượt chấm ghi lại phiên bản đã dùng nên sửa bộ tiêu chí không làm đổi hồ sơ cũ.
-- 2. Cấu hình theo ĐƠN VỊ: không có bản ghi thì theo công ty (cùng khuôn module thưởng).

CREATE TABLE IF NOT EXISTS ai_criteria_sets (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id),
    org_unit_id       UUID REFERENCES org_units(id),              -- NULL = áp cho cả tổ chức
    title             VARCHAR(255) NOT NULL,
    version           INT,                                         -- chỉ có khi đã xác nhận
    status            VARCHAR(20) NOT NULL DEFAULT 'DRAFT',        -- DRAFT|CONFIRMED|ARCHIVED
    source_file_name  VARCHAR(255),
    source_text       TEXT,                                        -- chữ gốc đã bóc, giữ để trích dẫn
    created_by        UUID NOT NULL REFERENCES users(id),
    confirmed_by      UUID REFERENCES users(id),
    confirmed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_criteria_sets_org ON ai_criteria_sets(organization_id, status);

CREATE TABLE IF NOT EXISTS ai_criteria_set_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    set_id            UUID NOT NULL REFERENCES ai_criteria_sets(id) ON DELETE CASCADE,
    position          INT NOT NULL DEFAULT 0,
    name              VARCHAR(255) NOT NULL,
    description       TEXT,
    weight            NUMERIC(6,2),
    scale_levels      TEXT,                                        -- mỗi dòng "Mức: mô tả"
    scope             TEXT,                                        -- phạm vi áp dụng, chữ tự do
    source_excerpt    TEXT,                                        -- đoạn văn gốc máy bóc dòng này ra
    excerpt_verified  BOOLEAN NOT NULL DEFAULT false               -- đoạn gốc có thật trong tài liệu không
);

CREATE INDEX IF NOT EXISTS idx_ai_criteria_set_items_set ON ai_criteria_set_items(set_id, position);

CREATE TABLE IF NOT EXISTS ai_review_unit_settings (
    org_unit_id       UUID PRIMARY KEY REFERENCES org_units(id) ON DELETE CASCADE,
    organization_id   UUID NOT NULL REFERENCES organizations(id),
    enabled           BOOLEAN NOT NULL DEFAULT true,
    weight_target     INT NOT NULL DEFAULT 60,
    weight_quality    INT NOT NULL DEFAULT 30,
    weight_on_time    INT NOT NULL DEFAULT 10,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_ai_unit_weights CHECK (weight_target + weight_quality + weight_on_time = 100)
);

ALTER TABLE ai_submission_reviews
    ADD COLUMN IF NOT EXISTS criteria_set_id      UUID REFERENCES ai_criteria_sets(id),
    ADD COLUMN IF NOT EXISTS criteria_set_version INT,
    ADD COLUMN IF NOT EXISTS files_read           INT,               -- số tệp minh chứng đọc được
    ADD COLUMN IF NOT EXISTS files_total          INT;
