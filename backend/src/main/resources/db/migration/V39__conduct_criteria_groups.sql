-- Hạnh kiểm: thêm tầng NHÓM giữa bộ và tiêu chí (bộ → nhóm → tiêu chí), như phiếu "Phù hợp văn hoá
-- doanh nghiệp": 5 giá trị cốt lõi 30% / 10 đặc điểm 40% / 6 chữ vàng 30%, mỗi nhóm có tiêu chí cộng 100%.
--
-- Không bắt buộc: bộ không có nhóm chạy y như trước (conduct_criteria.weight = % trên tổng 100).
-- Tiêu chí thuộc nhóm thì conduct_criteria.weight = % TRONG NHÓM (cộng 100 trong mỗi nhóm).
--
-- Dòng phiếu (conduct_evaluation_items) chụp lại nhóm lúc mở phiếu: weight vẫn là % TRÊN TỔNG
-- (= % trong nhóm × % nhóm / 100) nên mọi phép tính điểm cũ giữ nguyên; group_* và weight_in_group chỉ
-- để hiển thị theo nhóm. Phiếu cũ để NULL = không nhóm. Mọi câu chạy lại được.

CREATE TABLE IF NOT EXISTS conduct_criteria_groups (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         UUID             NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    conduct_criteria_set_id UUID             NOT NULL REFERENCES conduct_criteria_sets(id) ON DELETE CASCADE,
    name                    TEXT             NOT NULL,
    weight                  DOUBLE PRECISION NOT NULL,   -- % của nhóm trong tổng 100
    position_index          INT              NOT NULL,
    created_at              TIMESTAMPTZ      DEFAULT NOW(),
    updated_at              TIMESTAMPTZ      DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_conduct_groups_set ON conduct_criteria_groups(conduct_criteria_set_id);

ALTER TABLE conduct_criteria ADD COLUMN IF NOT EXISTS conduct_criteria_group_id UUID
    REFERENCES conduct_criteria_groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_conduct_criteria_group ON conduct_criteria(conduct_criteria_group_id);

ALTER TABLE conduct_evaluation_items ADD COLUMN IF NOT EXISTS group_name      TEXT;
ALTER TABLE conduct_evaluation_items ADD COLUMN IF NOT EXISTS group_weight    DOUBLE PRECISION;
ALTER TABLE conduct_evaluation_items ADD COLUMN IF NOT EXISTS group_position  INT;
ALTER TABLE conduct_evaluation_items ADD COLUMN IF NOT EXISTS weight_in_group DOUBLE PRECISION;
