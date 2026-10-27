-- V44 — Điểm từng chỉ tiêu theo TỪNG người chấm (người dùng chốt 02/10).
--
-- kpi_submissions.manager_score chỉ có một ô: cấp sau chấm là đè điểm cấp trước, nên màn chấm không hiện được
-- "Quản lý chấm" và "Sếp chấm" cạnh nhau. Bảng này giữ một dòng cho mỗi (bài nộp, người chấm); kpi_submissions vẫn
-- giữ điểm của người chấm cuối như cũ — các luồng tính điểm hiện có không đổi.

CREATE TABLE IF NOT EXISTS kpi_submission_scores (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id        UUID NOT NULL REFERENCES kpi_submissions(id) ON DELETE CASCADE,
    evaluator_id         UUID NOT NULL REFERENCES users(id),
    manager_score        DOUBLE PRECISION,                       -- thang trọng số thô, như kpi_submissions.manager_score
    qualitative_level_id UUID REFERENCES qualitative_levels(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),     -- lần chấm ĐẦU: thứ tự cấp bậc (quản lý trước, sếp sau)
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_kpi_submission_scores UNIQUE (submission_id, evaluator_id)
);

CREATE INDEX IF NOT EXISTS idx_kpi_submission_scores_submission ON kpi_submission_scores(submission_id);

-- Bài đã chấm trước đây: điểm hiện có là của người chấm cuối — ghi lại thành dòng của người đó.
INSERT INTO kpi_submission_scores (submission_id, evaluator_id, manager_score, qualitative_level_id, created_at, updated_at)
SELECT s.id, s.reviewed_by, s.manager_score, s.qualitative_level_id,
       COALESCE(s.reviewed_at, now()), COALESCE(s.reviewed_at, now())
  FROM kpi_submissions s
 WHERE s.reviewed_by IS NOT NULL
   AND s.deleted_at IS NULL
   AND (s.manager_score IS NOT NULL OR s.qualitative_level_id IS NOT NULL)
ON CONFLICT (submission_id, evaluator_id) DO NOTHING;
