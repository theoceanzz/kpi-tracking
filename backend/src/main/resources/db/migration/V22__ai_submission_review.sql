-- V22 — Kết quả AI đọc bài nộp và đề xuất điểm.
--
-- Bảng CHỈ lưu kết quả THAM KHẢO: điểm chính thức vẫn nằm ở evaluations / kpi_submissions.
-- Một dòng reviews = một lượt phân tích cho MỘT nhân viên trong MỘT đợt (đơn vị công việc thật của
-- quản lý, xem tài liệu phân tích mục 2.1). Dòng items là kết quả theo từng chỉ tiêu.

CREATE TABLE IF NOT EXISTS ai_submission_reviews (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id    UUID NOT NULL REFERENCES organizations(id),
    kpi_period_id      UUID NOT NULL REFERENCES kpi_periods(id),
    user_id            UUID NOT NULL REFERENCES users(id),      -- người được phân tích
    requested_by       UUID NOT NULL REFERENCES users(id),      -- quản lý bấm
    status             VARCHAR(20) NOT NULL DEFAULT 'QUEUED',   -- QUEUED|RUNNING|DONE|FAILED
    overall_summary    TEXT,
    confidence         VARCHAR(20),                             -- CAO|TRUNG_BINH|THAP
    missing_data       TEXT,                                    -- mỗi dòng một thứ còn thiếu
    unreadable_files   TEXT,                                    -- mỗi dòng: "tên tệp: lý do"
    criteria_snapshot  JSONB,                                   -- bộ tiêu chí tại thời điểm chấm
    model_name         VARCHAR(120),
    prompt_version     VARCHAR(20),
    prompt_tokens      INT,
    completion_tokens  INT,
    duration_ms        INT,
    error_message      TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_reviews_period_user
    ON ai_submission_reviews(kpi_period_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_reviews_org ON ai_submission_reviews(organization_id);

CREATE TABLE IF NOT EXISTS ai_submission_review_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id           UUID NOT NULL REFERENCES ai_submission_reviews(id) ON DELETE CASCADE,
    kpi_submission_id   UUID REFERENCES kpi_submissions(id),    -- NULL = chỉ tiêu chưa có bài nộp
    kpi_criteria_id     UUID NOT NULL REFERENCES kpi_criteria(id),
    summary             TEXT,
    quality_comment     TEXT,
    quality_level       VARCHAR(40),
    evidence_quotes     TEXT,
    -- Ba cột số dưới đây do MÃ NGUỒN điền, không nhận từ mô hình (validator ghi đè).
    achievement_percent NUMERIC(6,2),
    on_time_percent     NUMERIC(6,2),
    suggested_score     NUMERIC(6,2),
    strengths           TEXT,
    gaps                TEXT,
    suggestions         TEXT,
    error_message       TEXT,                                   -- lỗi riêng của chỉ tiêu này (lượt vẫn DONE)
    -- Quyết định của quản lý, ghi lại để đo AI lệch bao nhiêu so với người.
    manager_score       NUMERIC(6,2),
    manager_comment     TEXT,
    manager_changed     BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_review_items_review ON ai_submission_review_items(review_id);

-- Cờ và trọng số theo tổ chức. Module mở rộng mặc định TẮT.
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS enable_ai_review          BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS ai_review_weight_target   INT     NOT NULL DEFAULT 60,
    ADD COLUMN IF NOT EXISTS ai_review_weight_quality  INT     NOT NULL DEFAULT 30,
    ADD COLUMN IF NOT EXISTS ai_review_weight_on_time  INT     NOT NULL DEFAULT 10;

-- Postgres không có ADD CONSTRAINT IF NOT EXISTS, nên bọc để chạy lại không vỡ.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_org_ai_review_weights') THEN
        ALTER TABLE organizations ADD CONSTRAINT ck_org_ai_review_weights
            CHECK (ai_review_weight_target + ai_review_weight_quality + ai_review_weight_on_time = 100);
    END IF;
END $$;

-- Quyền. Gán theo thuộc tính vai trò (bám quyền có sẵn) để công ty tạo sau cũng có.
INSERT INTO permissions (id, code, resource, action, description) VALUES
    ('00000000-0000-0000-0000-000000000801', 'AI_REVIEW:USE', 'AI_REVIEW', 'USE',
     'Cho phép nhờ AI đọc trước bài nộp và xem điểm đề xuất khi chấm'),
    ('00000000-0000-0000-0000-000000000802', 'AI_REVIEW:CONFIG', 'AI_REVIEW', 'CONFIG',
     'Cho phép bật/tắt tính năng AI đánh giá và đặt trọng số chấm điểm cho tổ chức')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, p.id
FROM role_permissions rp
JOIN permissions src ON src.id = rp.permission_id AND src.code = 'SUBMISSION:REVIEW'
CROSS JOIN permissions p
WHERE p.code = 'AI_REVIEW:USE'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, p.id
FROM role_permissions rp
JOIN permissions src ON src.id = rp.permission_id AND src.code = 'COMPANY:UPDATE'
CROSS JOIN permissions p
WHERE p.code = 'AI_REVIEW:CONFIG'
ON CONFLICT DO NOTHING;
