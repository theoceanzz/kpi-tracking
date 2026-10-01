-- V29 — Căn cứ trích đoạn gốc cho nhận xét AI + nhân viên tự nhờ AI soi bài trước khi nộp.
--
-- Khách chốt hai câu của tài liệu phân tích yêu cầu:
--   C4 "giữ đoạn văn gốc để trích dẫn khi giải thích điểm" → mỗi kết quả chỉ tiêu lưu căn cứ (dòng bộ tiêu chí /
--      đoạn quy chế) KÈM đoạn văn gốc, bản chụp lúc chấm.
--   E3 "nhân viên tự soi bài trước khi nộp — có token thì được dùng" → bảng riêng ai_self_checks: kết quả chỉ
--      người nộp xem, không mức chất lượng, không điểm. Không lưu nội dung bài (chỉ băm để khỏi chấm lại bản y hệt).

ALTER TABLE ai_submission_review_items
    ADD COLUMN IF NOT EXISTS basis_citations JSONB;

CREATE TABLE IF NOT EXISTS ai_self_checks (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id      UUID NOT NULL REFERENCES organizations(id),
    user_id              UUID NOT NULL REFERENCES users(id),               -- người nộp, cũng là người xem
    kpi_criteria_id      UUID NOT NULL REFERENCES kpi_criteria(id) ON DELETE CASCADE,
    kpi_submission_id    UUID REFERENCES kpi_submissions(id) ON DELETE SET NULL,  -- bản nháp đang sửa (nếu có)
    input_hash           VARCHAR(64) NOT NULL,                             -- băm bài + tệp + bộ tiêu chí + prompt
    status               VARCHAR(20) NOT NULL DEFAULT 'QUEUED',            -- QUEUED|RUNNING|DONE|FAILED
    summary              TEXT,
    evidence_quotes      TEXT,                                             -- mỗi dòng một câu trích từ bài
    strengths            TEXT,
    gaps                 TEXT,
    suggestions          TEXT,
    basis_citations      JSONB,
    unreadable_files     TEXT,                                             -- mỗi dòng: "tên tệp: lý do"
    files_read           INT,
    files_total          INT,
    criteria_set_id      UUID,
    criteria_set_version INT,
    model_name           VARCHAR(120),
    prompt_version       VARCHAR(20),
    prompt_tokens        INT,
    completion_tokens    INT,
    duration_ms          INT,
    error_message        TEXT,                                             -- chỉ để tra lỗi, không hiện
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_self_checks_user_kpi
    ON ai_self_checks(user_id, kpi_criteria_id, created_at DESC);
