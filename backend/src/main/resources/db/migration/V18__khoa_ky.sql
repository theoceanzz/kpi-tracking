-- KHOÁ KỲ: kỳ OPEN → LOCKED, đợt có trạng thái kết thúc riêng, KPI dở khi chốt được đánh dấu
-- CLOSED_BY_LOCK, và một bảng lịch sử nghiệp vụ cho mọi thao tác khoá / gia hạn / chuyển đợt /
-- mở lại.
--
-- Kỳ chỉ khoá ở MỘT chỗ: khoá kết quả đánh giá kỳ ở ĐƠN VỊ GỐC (cùng transaction); mở khoá kết
-- quả ở đó thì kỳ mở lại. Khoá kỳ đóng VÒNG ĐỜI KPI của cả tổ chức trong kỳ (tạo/sửa/duyệt/nộp/
-- chấm đợt).
--
-- Không bảng nào ở đây thuộc nhóm "bảng lớn" nên index tạo thường.

-- ── Kỳ ──
ALTER TABLE kpi_cycles ADD COLUMN IF NOT EXISTS status        VARCHAR(20) NOT NULL DEFAULT 'OPEN';
ALTER TABLE kpi_cycles ADD COLUMN IF NOT EXISTS locked_by     UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE kpi_cycles ADD COLUMN IF NOT EXISTS locked_at     TIMESTAMPTZ;
ALTER TABLE kpi_cycles ADD COLUMN IF NOT EXISTS reopened_by   UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE kpi_cycles ADD COLUMN IF NOT EXISTS reopened_at   TIMESTAMPTZ;
ALTER TABLE kpi_cycles ADD COLUMN IF NOT EXISTS reopen_reason TEXT;
COMMENT ON COLUMN kpi_cycles.status IS 'OPEN | LOCKED';

-- Tra "kỳ kế tiếp cùng loại" và kiểm tra chồng lấn.
CREATE INDEX IF NOT EXISTS idx_kpi_cycles_org_type_start
    ON kpi_cycles (organization_id, cycle_type, start_date) WHERE deleted_at IS NULL;

-- ── Đợt ──
ALTER TABLE kpi_periods ADD COLUMN IF NOT EXISTS status                  VARCHAR(30) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE kpi_periods ADD COLUMN IF NOT EXISTS transferred_to_cycle_id UUID REFERENCES kpi_cycles(id) ON DELETE SET NULL;
ALTER TABLE kpi_periods ADD COLUMN IF NOT EXISTS source_period_id        UUID REFERENCES kpi_periods(id) ON DELETE SET NULL;
ALTER TABLE kpi_periods ADD COLUMN IF NOT EXISTS original_cycle_id       UUID REFERENCES kpi_cycles(id) ON DELETE SET NULL;
COMMENT ON COLUMN kpi_periods.status IS 'ACTIVE | CLOSED_BY_LOCK | TRANSFERRED | CANCELLED';
COMMENT ON COLUMN kpi_periods.transferred_to_cycle_id IS
    'Đợt bị TÁCH khi khoá kỳ: phần KPI dở đã sang một đợt mới ở kỳ này.';
COMMENT ON COLUMN kpi_periods.source_period_id IS
    'Đợt mới sinh ra khi tách: trỏ về đợt gốc ở kỳ cũ.';
COMMENT ON COLUMN kpi_periods.original_cycle_id IS
    'Đợt được CHUYỂN NGUYÊN sang kỳ khác: kỳ trước khi chuyển (lần chuyển gần nhất).';

-- ── KPI ──
-- kpi_criteria.status không có CHECK constraint nên CLOSED_BY_LOCK chỉ là giá trị enum mới.
ALTER TABLE kpi_criteria ADD COLUMN IF NOT EXISTS closed_at     TIMESTAMPTZ;
ALTER TABLE kpi_criteria ADD COLUMN IF NOT EXISTS closed_reason VARCHAR(255);

-- ── Lịch sử kỳ ──
CREATE TABLE IF NOT EXISTS kpi_cycle_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_cycle_id      UUID        NOT NULL REFERENCES kpi_cycles(id) ON DELETE CASCADE,
    action            VARCHAR(30) NOT NULL,
    actor_id          UUID        REFERENCES users(id) ON DELETE SET NULL,
    period_id         UUID        REFERENCES kpi_periods(id) ON DELETE SET NULL,
    -- Đợt mới sinh ra khi tách (PERIOD_SPLIT).
    new_period_id     UUID        REFERENCES kpi_periods(id) ON DELETE SET NULL,
    target_cycle_id   UUID        REFERENCES kpi_cycles(id) ON DELETE SET NULL,
    old_end_date      TIMESTAMPTZ,
    new_end_date      TIMESTAMPTZ,
    affected_kpi_ids  JSONB,
    reason            TEXT,
    detail            JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON COLUMN kpi_cycle_events.action IS
    'LOCK | EXTEND | REOPEN | PERIOD_TRANSFER | PERIOD_SPLIT | PERIOD_CLOSE | PERIOD_CANCEL';
CREATE INDEX IF NOT EXISTS idx_kpi_cycle_events_cycle ON kpi_cycle_events (kpi_cycle_id, created_at);
CREATE INDEX IF NOT EXISTS idx_kpi_cycle_events_target ON kpi_cycle_events (target_cycle_id) WHERE target_cycle_id IS NOT NULL;
