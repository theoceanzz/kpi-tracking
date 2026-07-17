-- ====================================================
-- V5: BSC - GĐ3 Chấm điểm cá nhân theo viễn cảnh
-- - Cột bsc_score trên evaluations (LUÔN được tính & lưu, kể cả ở chế độ SHADOW)
-- - Bảng evaluation_perspective_scores: breakdown điểm từng viễn cảnh (audit + giải thích điểm cho HR)
--
-- LƯU Ý: score/system_score cũ giữ NGUYÊN. bsc_score chỉ THAY system_score làm điểm chính thức
-- khi scorecard của kỳ đó có scoring_mode = 'OFFICIAL'. Đổi mode KHÔNG cần tính lại gì.
-- ====================================================

ALTER TABLE evaluations
    ADD COLUMN IF NOT EXISTS bsc_score DOUBLE PRECISION;

CREATE TABLE evaluation_perspective_scores (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id     UUID             NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    perspective_id    UUID             NOT NULL REFERENCES bsc_perspectives(id) ON DELETE CASCADE,
    weight_percentage DOUBLE PRECISION,
    -- Điểm thô của viễn cảnh (0..150): trung bình có trọng số các KPI của NV trong viễn cảnh.
    -- NULL = nhân viên không có KPI nào trong viễn cảnh (viễn cảnh rỗng).
    raw_score         DOUBLE PRECISION,
    -- Đóng góp = weight_percentage% × raw_score
    weighted_score    DOUBLE PRECISION,
    kpi_count         INT              NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ      DEFAULT NOW()
);

CREATE INDEX idx_evaluation_perspective_scores_evaluation_id ON evaluation_perspective_scores(evaluation_id);
CREATE UNIQUE INDEX uq_evaluation_perspective_scores
    ON evaluation_perspective_scores(evaluation_id, perspective_id);
