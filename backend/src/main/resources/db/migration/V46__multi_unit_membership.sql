-- Kiêm nhiệm (một người thuộc nhiều đơn vị): đơn vị chính + "% công sức" theo nhánh + % chốt theo đợt.
-- Ba phần cùng một tính năng nên gộp một file (chưa từng lên prod).

-- ============ 1. Đơn vị chính ============
-- Đơn vị CHÍNH của một người. Một người có thể thuộc nhiều đơn vị (kiêm nhiệm, hoặc dòng
-- "nhân viên" tự sinh ở đơn vị cha) và giữ nhiều vai trò trong một đơn vị; đánh giá đợt/kỳ,
-- hạnh kiểm, xếp loại / bell curve, BSC, thưởng… chỉ tính theo MỘT đơn vị: đơn vị này.
-- Luật đọc nằm duy nhất ở PrimaryUnitResolver; cột trống hoặc trỏ vào đơn vị người đó không
-- còn thuộc ⇒ luật dự phòng (vai trò cao nhất, rồi đơn vị sâu nhất, rồi path).
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS primary_org_unit_id UUID REFERENCES org_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_primary_org_unit
    ON users (primary_org_unit_id) WHERE primary_org_unit_id IS NOT NULL;

-- Ghim đơn vị chính hiện tại cho mọi người theo đúng luật dự phòng, để gán thêm một đơn vị
-- sâu hơn về sau không âm thầm đổi "nhà" của họ. Bỏ qua vai trò sinh từ uỷ quyền ký thay.
UPDATE users u
SET primary_org_unit_id = p.org_unit_id
FROM (
    SELECT DISTINCT ON (uro.user_id) uro.user_id, uro.org_unit_id
    FROM user_role_org_units uro
    JOIN org_units ou ON ou.id = uro.org_unit_id AND ou.deleted_at IS NULL
    JOIN roles r ON r.id = uro.role_id
    WHERE uro.delegation_id IS NULL
    ORDER BY uro.user_id,
             r.rank ASC NULLS LAST,
             array_length(string_to_array(trim(both '/' from ou.path), '/'), 1) DESC NULLS LAST,
             ou.path ASC
) p
WHERE u.id = p.user_id
  AND u.primary_org_unit_id IS NULL;

-- ============ 2. % công sức theo nhánh ============
-- "% công sức" của người kiêm nhiệm: mỗi đơn vị giao KPI vẫn đủ 100% của riêng mình, còn điểm
-- KPI đợt của người đó = Σ (% công sức của nhánh × % hoàn thành KPI của nhánh). Một dòng cho mỗi
-- (người, đơn vị nhánh); nhánh không có dòng chia đều phần còn lại, không có dòng nào thì chia
-- đều. Người chỉ thuộc một nhánh không bao giờ đọc bảng này. Luật: KpiEffortShares.
CREATE TABLE IF NOT EXISTS user_unit_effort_shares (
    user_id       UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_unit_id   UUID             NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
    share_percent DOUBLE PRECISION NOT NULL CHECK (share_percent >= 0 AND share_percent <= 100),
    updated_by    UUID             REFERENCES users(id) ON DELETE SET NULL,
    updated_at    TIMESTAMPTZ      NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, org_unit_id)
);

-- ============ 3. % công sức chốt theo đợt ============
-- "% công sức" CHỐT theo đợt: lúc quản lý chấm đợt lần đầu cho người kiêm nhiệm, % đang áp dụng
-- (user_unit_effort_shares, mục 2) được chụp vào đây. Đợt đó từ đó luôn tính theo bản chụp — sửa %
-- về sau chỉ đổi các đợt chưa chấm, phiếu đã chấm sửa lại vẫn ra cùng điểm. Luật: KpiEffortShares.
CREATE TABLE IF NOT EXISTS user_period_effort_shares (
    user_id       UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kpi_period_id UUID             NOT NULL REFERENCES kpi_periods(id) ON DELETE CASCADE,
    org_unit_id   UUID             NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
    share_percent DOUBLE PRECISION NOT NULL CHECK (share_percent >= 0 AND share_percent <= 100),
    created_at    TIMESTAMPTZ      NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, kpi_period_id, org_unit_id)
);
