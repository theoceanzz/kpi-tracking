-- BỘ TIÊU CHÍ HẠNH KIỂM THEO KỲ
--
-- Trước: mỗi tổ chức đúng MỘT bộ tiêu chí, đổi bộ là đổi cho mọi kỳ. Nay giống hệt cách
-- "xếp loại đơn vị" đang làm với hồ sơ luật: nhiều BỘ, mỗi bộ gán cho (các) kỳ, kỳ không
-- được gán thì rơi về bộ MẶC ĐỊNH. Nhờ vậy sửa tiêu chí cho kỳ mới không viết lại tiêu
-- chí của kỳ cũ.
--
-- Thang điểm cũng chuyển xuống từng bộ: đổi thang giữa hai kỳ là chuyện bình thường, để
-- ở cấp tổ chức thì một lần sửa làm lệch mọi kỳ. organizations.conduct_max_score giữ lại
-- làm giá trị nền cho bộ mặc định sinh ra ở đây.

CREATE TABLE conduct_criteria_sets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID             NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT             NOT NULL,
    -- Bộ áp cho mọi kỳ chưa được gán bộ riêng. Mỗi tổ chức đúng một bộ như vậy.
    is_default      BOOLEAN          NOT NULL DEFAULT FALSE,
    max_score       DOUBLE PRECISION NOT NULL DEFAULT 4,
    created_at      TIMESTAMPTZ      DEFAULT NOW(),
    updated_at      TIMESTAMPTZ      DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_conduct_set_org ON conduct_criteria_sets(organization_id);

-- Một tổ chức chỉ được MỘT bộ mặc định còn sống — nếu không, kỳ chưa gán sẽ bốc bộ ngẫu nhiên.
CREATE UNIQUE INDEX uq_conduct_set_default
    ON conduct_criteria_sets(organization_id) WHERE is_default AND deleted_at IS NULL;

-- ── Kỳ áp dụng bộ nào ────────────────────────────────────────────────────────
-- Một kỳ chỉ thuộc MỘT bộ (khoá chính trên kpi_cycle_id): gán kỳ cho bộ khác thì bộ cũ
-- tự mất kỳ đó, không có chuyện hai bộ cùng tranh một kỳ.
CREATE TABLE conduct_criteria_set_cycles (
    kpi_cycle_id            UUID PRIMARY KEY REFERENCES kpi_cycles(id) ON DELETE CASCADE,
    conduct_criteria_set_id UUID NOT NULL    REFERENCES conduct_criteria_sets(id) ON DELETE CASCADE
);

CREATE INDEX idx_conduct_set_cycles_set ON conduct_criteria_set_cycles(conduct_criteria_set_id);

-- ── Tiêu chí thuộc về một bộ ─────────────────────────────────────────────────
ALTER TABLE conduct_criteria
    ADD COLUMN IF NOT EXISTS conduct_criteria_set_id UUID REFERENCES conduct_criteria_sets(id) ON DELETE CASCADE;

-- Mỗi tổ chức đang có tiêu chí ⇒ dựng bộ mặc định mang đúng thang điểm hiện hành của nó.
INSERT INTO conduct_criteria_sets (organization_id, name, is_default, max_score)
SELECT o.id, 'Bộ mặc định', TRUE, COALESCE(o.conduct_max_score, 4)
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM conduct_criteria_sets s
    WHERE s.organization_id = o.id AND s.deleted_at IS NULL
);

UPDATE conduct_criteria c
SET conduct_criteria_set_id = s.id
FROM conduct_criteria_sets s
WHERE s.organization_id = c.organization_id
  AND s.is_default
  AND s.deleted_at IS NULL
  AND c.conduct_criteria_set_id IS NULL;

-- Tiêu chí mồ côi (tổ chức đã bị xoá cứng) không còn ý nghĩa — bỏ hẳn để đặt được NOT NULL.
DELETE FROM conduct_criteria WHERE conduct_criteria_set_id IS NULL;

ALTER TABLE conduct_criteria ALTER COLUMN conduct_criteria_set_id SET NOT NULL;

CREATE INDEX idx_conduct_criteria_set ON conduct_criteria(conduct_criteria_set_id);

-- ── Phiếu chấm ghi lại bộ đã dùng ────────────────────────────────────────────
-- Chỉ để truy vết "phiếu này chấm theo bộ nào"; điểm vẫn tính từ bản chụp tiêu chí trong
-- phiếu, nên xoá bộ đi không làm sai điểm đã chấm (vì vậy SET NULL chứ không CASCADE).
ALTER TABLE conduct_evaluations
    ADD COLUMN IF NOT EXISTS conduct_criteria_set_id UUID REFERENCES conduct_criteria_sets(id) ON DELETE SET NULL;

COMMENT ON COLUMN organizations.conduct_max_score IS
    'Thang điểm nền khi tổ chức chưa có bộ tiêu chí nào. Thang thật nằm ở conduct_criteria_sets.max_score của từng bộ.';
