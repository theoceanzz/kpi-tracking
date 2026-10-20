-- Uỷ quyền "ký thay trưởng đơn vị" sinh một vai trò trưởng THẬT ở đơn vị đích, trong thời
-- hạn uỷ quyền. Nhờ vậy mọi luật dựa trên trưởng/phó (xem KPI, chuỗi duyệt, công việc, BSC,
-- hạnh kiểm…) coi người được uỷ quyền như trưởng đơn vị mà không phải dạy từng luật về bảng
-- uỷ quyền. Hết hạn / thu hồi thì vai trò sinh kèm bị gỡ (DelegationLeaderRoles).

-- Vai trò này sinh ra từ uỷ quyền nào. NULL = vai trò gán tay như trước.
ALTER TABLE user_role_org_units
    ADD COLUMN IF NOT EXISTS delegation_id UUID REFERENCES org_unit_delegations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_uro_delegation_id
    ON user_role_org_units (delegation_id) WHERE delegation_id IS NOT NULL;

-- Lúc đã gán vai trò trưởng cho uỷ quyền này. Chỉ gán MỘT lần: quản trị gỡ tay vai trò đó ở
-- màn thành viên thì job không âm thầm gán lại.
ALTER TABLE org_unit_delegations
    ADD COLUMN IF NOT EXISTS leader_role_granted_at TIMESTAMPTZ;
