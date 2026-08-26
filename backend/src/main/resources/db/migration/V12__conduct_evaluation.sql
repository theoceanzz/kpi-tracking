-- ĐÁNH GIÁ XẾP LOẠI HÀNH VI ("hạnh kiểm") THEO TRIẾT LÝ GIÁO DỤC
--
-- Bảng tiêu chí định tính chấm theo ĐỢT hoặc theo KỲ: mỗi tiêu chí một trọng số %,
-- người được đánh giá tự chấm + nêu dẫn chứng, cán bộ quản lý trực tiếp chấm + nhận xét.
-- Điểm tổng = Σ(điểm tiêu chí × trọng số).
--
-- Điểm hạnh kiểm LẤP TRỤC CÒN THIẾU của ma trận xếp loại hiệu quả:
--   - tổ chức chỉ có KPI định lượng (trục cột) ⇒ hạnh kiểm quy về trục hàng (thang 0..5);
--   - tổ chức chỉ có KPI định tính  (trục hàng) ⇒ hạnh kiểm quy về trục cột (thang %).
-- Xem ConductAxisResolver.

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS enable_conduct    BOOLEAN          NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS conduct_max_score DOUBLE PRECISION NOT NULL DEFAULT 4;

COMMENT ON COLUMN organizations.conduct_max_score IS
    'Thang điểm mỗi tiêu chí hạnh kiểm (mặc định 4). Điểm tổng cũng nằm trong 0..thang này vì trọng số cộng lại = 100%.';

-- ── Bộ tiêu chí (cấu hình cấp tổ chức, thêm/bớt/sửa được) ────────────────────
CREATE TABLE conduct_criteria (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID             NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT             NOT NULL,
    description     TEXT,
    weight          DOUBLE PRECISION NOT NULL,   -- % trong tổng 100
    position_index  INT              NOT NULL,
    created_at      TIMESTAMPTZ      DEFAULT NOW(),
    updated_at      TIMESTAMPTZ      DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_conduct_criteria_org ON conduct_criteria(organization_id);

-- ── Phiếu chấm của một người trong một đợt HOẶC một kỳ ───────────────────────
CREATE TABLE conduct_evaluations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID             NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id           UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kpi_period_id     UUID             REFERENCES kpi_periods(id) ON DELETE CASCADE,
    kpi_cycle_id      UUID             REFERENCES kpi_cycles(id) ON DELETE CASCADE,
    scope             VARCHAR(20)      NOT NULL,   -- PERIOD | CYCLE
    status            VARCHAR(20)      NOT NULL DEFAULT 'DRAFT',  -- DRAFT | SELF_SUBMITTED | REVIEWED
    self_score        DOUBLE PRECISION,            -- Σ(điểm tự chấm × trọng số)
    manager_score     DOUBLE PRECISION,            -- Σ(điểm CBQLTT × trọng số)
    -- Chụp lại thang điểm lúc chấm: đổi thang ở cấu hình KHÔNG được làm đổi phiếu đã chấm.
    max_score         DOUBLE PRECISION NOT NULL DEFAULT 4,
    comment           TEXT,
    self_submitted_at TIMESTAMPTZ,
    evaluator_id      UUID             REFERENCES users(id) ON DELETE SET NULL,
    evaluated_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ      DEFAULT NOW(),
    updated_at        TIMESTAMPTZ      DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ,
    CONSTRAINT chk_conduct_scope_target CHECK (
        (scope = 'PERIOD' AND kpi_period_id IS NOT NULL AND kpi_cycle_id IS NULL) OR
        (scope = 'CYCLE'  AND kpi_cycle_id  IS NOT NULL AND kpi_period_id IS NULL)
    )
);

-- Mỗi người chỉ có MỘT phiếu còn sống cho mỗi đợt/kỳ (unique một phần vì bảng có xoá mềm).
CREATE UNIQUE INDEX uq_conduct_eval_user_period
    ON conduct_evaluations(user_id, kpi_period_id) WHERE deleted_at IS NULL AND kpi_period_id IS NOT NULL;
CREATE UNIQUE INDEX uq_conduct_eval_user_cycle
    ON conduct_evaluations(user_id, kpi_cycle_id)  WHERE deleted_at IS NULL AND kpi_cycle_id IS NOT NULL;
CREATE INDEX idx_conduct_eval_org  ON conduct_evaluations(organization_id);
CREATE INDEX idx_conduct_eval_user ON conduct_evaluations(user_id);

-- ── Từng dòng tiêu chí trong phiếu ───────────────────────────────────────────
-- Tên/mô tả/trọng số CHỤP LẠI từ conduct_criteria: sửa bộ tiêu chí về sau không
-- được viết lại phiếu đã chấm (điểm đã cộng theo trọng số cũ).
CREATE TABLE conduct_evaluation_items (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conduct_evaluation_id UUID             NOT NULL REFERENCES conduct_evaluations(id) ON DELETE CASCADE,
    criteria_id           UUID             REFERENCES conduct_criteria(id) ON DELETE SET NULL,
    criteria_name         TEXT             NOT NULL,
    criteria_description  TEXT,
    weight                DOUBLE PRECISION NOT NULL,
    position_index        INT              NOT NULL,
    self_score            DOUBLE PRECISION,
    self_evidence         TEXT,   -- "Dẫn chứng"
    manager_score         DOUBLE PRECISION,
    manager_comment       TEXT    -- "Nhận xét của Cán bộ quản lý"
);

CREATE INDEX idx_conduct_eval_items_eval ON conduct_evaluation_items(conduct_evaluation_id);

-- ── Bộ 4 tiêu chí mặc định cho các tổ chức đang có ───────────────────────────
INSERT INTO conduct_criteria (organization_id, name, description, weight, position_index)
SELECT o.id, c.name, c.description, 25, c.position_index
FROM organizations o
CROSS JOIN (VALUES
    ('Trung thực', 'Ngay thẳng, thật thà, dám nói lên sự thật.
Tôn trọng lẽ phải, không gian dối từ lời nói đến hành vi.
Sẵn sàng dũng cảm nói lên sự thật và sẵn sàng nhận lỗi khi phạm sai lầm.
Khiêm tốn với khả năng của bản thân, thể hiện sự chính trực, đặt lợi ích chung lên hàng đầu, không vụ lợi.', 1),
    ('Nhân ái', 'Chia sẻ, cảm thông cho nhau những lúc hoạn nạn, khó khăn.
Sẵn sàng giúp đỡ, thấu hiểu người khác dù trong bất kỳ hoàn cảnh nào, sống chan hoà.
Không gây bè phái, hiềm khích, hiểu lầm cá nhân, không làm ảnh hưởng tới văn hoá và truyền thống giáo dục của Nhà trường.', 2),
    ('Trách nhiệm', 'Luôn hoàn thành nhiệm vụ được giao đúng thời hạn.
Có tính kỷ luật cao, luôn lập kế hoạch thực hiện công việc của mình.
Có trách nhiệm với mọi công việc được giao.
Không đổ lỗi, luôn lắng nghe ý kiến đóng góp để hoàn thiện bản thân và công việc.', 3),
    ('Học tập suốt đời', 'Học bất cứ lúc nào, ở đâu, luôn duy trì việc học ngay cả khi đã đạt được những thành tựu, mục tiêu trong cuộc sống, miễn là khi có điều kiện thuận lợi, đặc biệt là còn sức khoẻ.
Chủ động nâng cao nhận thức, trình độ; phải học tập, tự học tập, học tập thường xuyên.
Sẵn sàng đón nhận và tiếp thu những kiến thức, kỹ năng mới. Không ngừng "thay và sửa", áp dụng những kiến thức tiên tiến vào quá trình công tác, làm việc.', 4)
) AS c(name, description, position_index);
