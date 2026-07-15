-- ====================================================
-- V4: BSC - GĐ2 Thẻ điểm (Scorecard) + trọng số viễn cảnh theo kỳ
-- - bsc_scorecards: "Chiến lược" gốc, mỗi org + kỳ một bản; giữ tham số chấm điểm theo kỳ
-- - bsc_scorecard_perspectives: viễn cảnh trong thẻ điểm + trọng số (%)
-- - bsc_weight_history: lịch sử đổi trọng số (truy vết tranh chấp điểm)
-- ====================================================

-- 1) Thẻ điểm (Scorecard) — mỗi tổ chức + kỳ một bản
CREATE TABLE bsc_scorecards (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id           UUID            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    kpi_period_id             UUID            NOT NULL REFERENCES kpi_periods(id) ON DELETE CASCADE,
    name                      VARCHAR(255)    NOT NULL,
    vision                    TEXT,
    status                    VARCHAR(20)     NOT NULL DEFAULT 'DRAFT'
                                  CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED')),
    -- Tham số chấm điểm đặt theo kỳ (đóng băng để tái lập điểm lịch sử)
    scoring_mode              VARCHAR(20)     NOT NULL DEFAULT 'SHADOW'
                                  CHECK (scoring_mode IN ('SHADOW','OFFICIAL')),
    empty_perspective_policy  VARCHAR(20)     NOT NULL DEFAULT 'RENORMALIZE'
                                  CHECK (empty_perspective_policy IN ('RENORMALIZE','ZERO_FILL')),
    created_at                TIMESTAMPTZ     DEFAULT NOW(),
    updated_at                TIMESTAMPTZ     DEFAULT NOW(),
    deleted_at                TIMESTAMPTZ
);

CREATE INDEX idx_bsc_scorecards_organization_id ON bsc_scorecards(organization_id);
CREATE INDEX idx_bsc_scorecards_kpi_period_id ON bsc_scorecards(kpi_period_id);
-- Mỗi org chỉ có 1 thẻ điểm cho một kỳ (bỏ qua bản xoá mềm)
CREATE UNIQUE INDEX uq_bsc_scorecards_org_period
    ON bsc_scorecards(organization_id, kpi_period_id) WHERE deleted_at IS NULL;

-- 2) Viễn cảnh trong thẻ điểm + trọng số (%) — tổng = 100 mỗi scorecard
CREATE TABLE bsc_scorecard_perspectives (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scorecard_id      UUID            NOT NULL REFERENCES bsc_scorecards(id) ON DELETE CASCADE,
    perspective_id    UUID            NOT NULL REFERENCES bsc_perspectives(id) ON DELETE CASCADE,
    weight_percentage DOUBLE PRECISION NOT NULL DEFAULT 0,
    display_order     INT             NOT NULL DEFAULT 0,
    UNIQUE (scorecard_id, perspective_id)
);

CREATE INDEX idx_bsc_scorecard_perspectives_scorecard_id ON bsc_scorecard_perspectives(scorecard_id);

-- 3) Lịch sử đổi trọng số (audit thông thường không lưu giá trị cũ + người đổi)
CREATE TABLE bsc_weight_history (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scorecard_id   UUID            NOT NULL REFERENCES bsc_scorecards(id) ON DELETE CASCADE,
    perspective_id UUID            NOT NULL REFERENCES bsc_perspectives(id) ON DELETE CASCADE,
    old_weight     DOUBLE PRECISION,
    new_weight     DOUBLE PRECISION,
    changed_by     UUID            REFERENCES users(id),
    reason         TEXT,
    changed_at     TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX idx_bsc_weight_history_scorecard_id ON bsc_weight_history(scorecard_id);
