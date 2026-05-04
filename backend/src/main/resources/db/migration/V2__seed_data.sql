-- ============================================================================
-- V2: SEED DATA - COMPREHENSIVE INITIAL DATA
-- ============================================================================

-- 1. GEOGRAPHICAL DATA
-- ============================================================================
INSERT INTO provinces (id, name, code) VALUES
    ('a1000000-0000-0000-0000-000000000001', 'Hà Nội', 'HN'),
    ('a1000000-0000-0000-0000-000000000002', 'Hồ Chí Minh', 'HCM');

INSERT INTO districts (id, name, code, province_id) VALUES
    ('b1000000-0000-0000-0000-000000000001', 'Ba Đình', 'HN-BD', 'a1000000-0000-0000-0000-000000000001'),
    ('b1000000-0000-0000-0000-000000000006', 'Quận 1', 'HCM-Q1', 'a1000000-0000-0000-0000-000000000002');


-- 2. ORGANIZATIONAL STRUCTURE
-- ============================================================================
INSERT INTO organizations (id, name, code, evaluation_max_score, excellent_threshold, good_threshold, fair_threshold, average_threshold, kpi_reminder_percentage) VALUES 
    ('11111111-1111-1111-1111-111111111111', 'FPT Education', 'FPT', 100.0, 90.0, 80.0, 70.0, 50.0, 50);

INSERT INTO org_hierarchy_levels (id, organization_id, level_order, unit_type_name, manager_role_label) VALUES 
    ('21111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 0, 'Chi nhánh', 'Giám đốc chi nhánh'),
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 1, 'Phòng ban', 'Trưởng phòng'),
    ('23333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 2, 'Tổ', 'Nhóm trưởng');

INSERT INTO org_units (id, name, code, parent_id, org_hierarchy_id, district_id, status) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Chi nhánh Hà Nội', 'HN-BRANCH', NULL, '21111111-1111-1111-1111-111111111111', 'b1000000-0000-0000-0000-000000000001', 'ACTIVE'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Phòng IT', 'IT-DEPT', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'b1000000-0000-0000-0000-000000000001', 'ACTIVE'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Team Backend', 'BE-TEAM', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '23333333-3333-3333-3333-333333333333', 'b1000000-0000-0000-0000-000000000001', 'ACTIVE');

-- 3. ROLES & PERMISSIONS
-- ============================================================================
INSERT INTO roles (id, name, level, rank) VALUES
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Giám đốc', 0, 0),
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Trưởng phòng', 1, 0),
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', 'Phó phòng', 1, 1),
    ('e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Trưởng nhóm', 2, 0),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', 'Nhân viên', 2, 2);

INSERT INTO permissions (id, code, resource, action, description) VALUES
    ('00000000-0000-0000-0000-000000000101', 'DASHBOARD:VIEW', 'DASHBOARD', 'VIEW', 'Xem biểu đồ thống kê'),
    ('00000000-0000-0000-0000-000000000102', 'COMPANY:VIEW', 'COMPANY', 'VIEW', 'Xem hồ sơ công ty'),
    ('00000000-0000-0000-0000-000000000103', 'ORG:VIEW', 'ORG', 'VIEW', 'Xem sơ đồ tổ chức'),
    ('00000000-0000-0000-0000-000000000104', 'ORG:CREATE', 'ORG', 'CREATE', 'Tạo mới phòng ban'),
    ('00000000-0000-0000-0000-000000000105', 'ORG:UPDATE', 'ORG', 'UPDATE', 'Cập nhật phòng ban'),
    ('00000000-0000-0000-0000-000000000106', 'ORG:DELETE', 'ORG', 'DELETE', 'Xóa phòng ban'),
    ('00000000-0000-0000-0000-000000000107', 'USER:VIEW', 'USER', 'VIEW', 'Xem danh mục nhân sự'),
    ('00000000-0000-0000-0000-000000000108', 'USER:CREATE', 'USER', 'CREATE', 'Thêm mới nhân sự'),
    ('00000000-0000-0000-0000-000000000109', 'USER:UPDATE', 'USER', 'UPDATE', 'Sửa thông tin nhân sự'),
    ('00000000-0000-0000-0000-000000000110', 'USER:DELETE', 'USER', 'DELETE', 'Xóa nhân sự'),
    ('00000000-0000-0000-0000-000000000111', 'USER:IMPORT', 'USER', 'IMPORT', 'Nhập nhân sự hàng loạt'),
    ('00000000-0000-0000-0000-000000000112', 'ROLE:VIEW', 'ROLE', 'VIEW', 'Xem danh sách vai trò'),
    ('00000000-0000-0000-0000-000000000113', 'ROLE:ASSIGN', 'ROLE', 'ASSIGN', 'Gán quyền cho người dùng'),
    ('00000000-0000-0000-0000-000000000114', 'PERMISSION:EDIT', 'PERMISSION', 'EDIT', 'Thiết lập chi tiết quyền'),
    ('00000000-0000-0000-0000-000000000115', 'KPI:VIEW', 'KPI', 'VIEW', 'Xem danh mục KPI'),
    ('00000000-0000-0000-0000-000000000116', 'KPI:CREATE', 'KPI', 'CREATE', 'Thiết lập KPI'),
    ('00000000-0000-0000-0000-000000000117', 'KPI:UPDATE', 'KPI', 'UPDATE', 'Sửa chỉ tiêu KPI'),
    ('00000000-0000-0000-0000-000000000118', 'KPI:DELETE', 'KPI', 'DELETE', 'Xóa chỉ tiêu KPI'),
    ('00000000-0000-0000-0000-000000000119', 'KPI:APPROVE', 'KPI', 'APPROVE', 'Phê duyệt chỉ tiêu KPI'),
    ('00000000-0000-0000-0000-000000000120', 'KPI:VIEW_MY', 'KPI', 'VIEW_MY', 'Xem KPI cá nhân'),
    ('00000000-0000-0000-0000-000000000121', 'SUBMISSION:REVIEW', 'SUBMISSION', 'REVIEW', 'Duyệt bài nộp KPI'),
    ('00000000-0000-0000-0000-000000000122', 'SUBMISSION:CREATE', 'SUBMISSION', 'CREATE', 'Nộp báo cáo KPI'),
    ('00000000-0000-0000-0000-000000000123', 'SUBMISSION:VIEW_MY', 'SUBMISSION', 'VIEW_MY', 'Xem lịch sử nộp báo cáo'),
    ('00000000-0000-0000-0000-000000000124', 'EVALUATION:VIEW', 'EVALUATION', 'VIEW', 'Xem kết quả đánh giá'),
    ('00000000-0000-0000-0000-000000000125', 'EVALUATION:CREATE', 'EVALUATION', 'CREATE', 'Thực hiện đánh giá xếp loại'),
    ('00000000-0000-0000-0000-000000000126', 'NOTIF:VIEW', 'NOTIFICATION', 'VIEW', 'Xem thông báo'),
    ('00000000-0000-0000-0000-000000000201', 'ROLE:CREATE', 'ROLE', 'CREATE', 'Tạo mới vai trò'),
    ('00000000-0000-0000-0000-000000000202', 'ROLE:UPDATE', 'ROLE', 'UPDATE', 'Chỉnh sửa vai trò'),
    ('00000000-0000-0000-0000-000000000203', 'ROLE:DELETE', 'ROLE', 'DELETE', 'Xoá vai trò'),
    ('00000000-0000-0000-0000-000000000204', 'PERMISSION:VIEW', 'PERMISSION', 'VIEW', 'Xem danh sách quyền'),
    ('00000000-0000-0000-0000-000000000205', 'COMPANY:UPDATE', 'COMPANY', 'UPDATE', 'Cập nhật thông tin tổ chức'),
    ('00000000-0000-0000-0000-000000000206', 'COMPANY:DELETE', 'COMPANY', 'DELETE', 'Xoá/Lưu trữ tổ chức'),
    ('00000000-0000-0000-0000-000000000207', 'KPI_PERIOD:VIEW', 'KPI_PERIOD', 'VIEW', 'Xem danh sách kỳ đánh giá'),
    ('00000000-0000-0000-0000-000000000208', 'KPI_PERIOD:CREATE', 'KPI_PERIOD', 'CREATE', 'Tạo kỳ đánh giá'),
    ('00000000-0000-0000-0000-000000000209', 'KPI_PERIOD:UPDATE', 'KPI_PERIOD', 'UPDATE', 'Cập nhật kỳ đánh giá'),
    ('00000000-0000-0000-0000-000000000210', 'KPI_PERIOD:DELETE', 'KPI_PERIOD', 'DELETE', 'Xoá kỳ đánh giá'),
    ('00000000-0000-0000-0000-000000000211', 'KPI:IMPORT', 'KPI', 'IMPORT', 'Nhập KPI hàng loạt từ file'),
    ('00000000-0000-0000-0000-000000000212', 'KPI:SUBMIT', 'KPI', 'SUBMIT', 'Gửi KPI để phê duyệt'),
    ('00000000-0000-0000-0000-000000000213', 'KPI:REJECT', 'KPI', 'REJECT', 'Từ chối chỉ tiêu KPI'),
    ('00000000-0000-0000-0000-000000000214', 'SUBMISSION:VIEW', 'SUBMISSION', 'VIEW', 'Xem tất cả bản nộp KPI'),
    ('00000000-0000-0000-0000-000000000215', 'SUBMISSION:DELETE', 'SUBMISSION', 'DELETE', 'Xoá bản nộp KPI'),
    ('00000000-0000-0000-0000-000000000216', 'SUBMISSION:UPDATE', 'SUBMISSION', 'UPDATE', 'Chỉnh sửa bản nộp KPI'),
    ('00000000-0000-0000-0000-000000000217', 'EVALUATION:UPDATE', 'EVALUATION', 'UPDATE', 'Chỉnh sửa đánh giá'),
    ('00000000-0000-0000-0000-000000000218', 'EVALUATION:DELETE', 'EVALUATION', 'DELETE', 'Xoá đánh giá'),
    ('00000000-0000-0000-0000-000000000219', 'EVALUATION:VIEW_MY', 'EVALUATION', 'VIEW_MY', 'Xem đánh giá cá nhân'),
    ('00000000-0000-0000-0000-000000000220', 'NOTIF:MANAGE', 'NOTIFICATION', 'MANAGE', 'Quản lý thông báo hệ thống'),
    ('00000000-0000-0000-0000-000000000221', 'AI:SUGGEST_KPI', 'AI', 'SUGGEST_KPI', 'Sử dụng AI gợi ý KPI'),
    ('00000000-0000-0000-0000-000000000222', 'POLICY:VIEW', 'POLICY', 'VIEW', 'Xem chính sách bảo mật'),
    ('00000000-0000-0000-0000-000000000223', 'POLICY:CREATE', 'POLICY', 'CREATE', 'Tạo chính sách'),
    ('00000000-0000-0000-0000-000000000224', 'POLICY:UPDATE', 'POLICY', 'UPDATE', 'Cập nhật chính sách'),
    ('00000000-0000-0000-0000-000000000225', 'POLICY:DELETE', 'POLICY', 'DELETE', 'Xoá chính sách'),
    ('00000000-0000-0000-0000-000000000226', 'POLICY:ASSIGN', 'POLICY', 'ASSIGN', 'Gán chính sách cho vai trò'),
    ('00000000-0000-0000-0000-000000000227', 'STATS:VIEW_ORG', 'STATS', 'VIEW_ORG', 'Xem thống kê theo phòng ban'),
    ('00000000-0000-0000-0000-000000000228', 'STATS:VIEW_EMPLOYEE', 'STATS', 'VIEW_EMPLOYEE', 'Xem thống kê nhân viên'),
    ('00000000-0000-0000-0000-000000000229', 'STATS:VIEW_MY', 'STATS', 'VIEW_MY', 'Xem tiến độ cá nhân'),
    ('00000000-0000-0000-0000-000000000230', 'SYSTEM:ADMIN', 'SYSTEM', 'ADMIN', 'Quyền quản trị toàn hệ thống (bypass phạm vi đơn vị)'),
    ('00000000-0000-0000-0000-000000000231', 'USER_ROLE:VIEW', 'USER_ROLE', 'VIEW', 'Xem gán vai trò người dùng'),
    ('00000000-0000-0000-0000-000000000232', 'USER_ROLE:ASSIGN', 'USER_ROLE', 'ASSIGN', 'Gán vai trò cho người dùng'),
    ('00000000-0000-0000-0000-000000000233', 'USER_ROLE:REVOKE', 'USER_ROLE', 'REVOKE', 'Thu hồi vai trò người dùng'),
    ('00000000-0000-0000-0000-000000000234', 'ATTACHMENT:UPLOAD', 'ATTACHMENT', 'UPLOAD', 'Upload tệp đính kèm'),
    ('00000000-0000-0000-0000-000000000235', 'ATTACHMENT:DELETE', 'ATTACHMENT', 'DELETE', 'Xoá tệp đính kèm')
ON CONFLICT (code) DO NOTHING;

-- Role-Permission Mapping
-- DIRECTOR: Full permissions
INSERT INTO role_permissions (role_id, permission_id) 
SELECT 'a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id FROM permissions
WHERE code NOT IN ('KPI:VIEW_MY', 'SUBMISSION:VIEW_MY', 'EVALUATION:VIEW_MY');

-- HEAD: Management permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000101'), 
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000115'),
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000116'), 
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000117'),
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000118'), -- KPI:DELETE
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000121'),
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000124'), 
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000125'),
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000126'),
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000211'), -- KPI:IMPORT
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000212'), -- KPI:SUBMIT
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000213'), -- KPI:REJECT
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000214'), -- SUBMISSION:VIEW
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000221'), -- AI:SUGGEST_KPI
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000227'), -- STATS:VIEW_ORG
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000228'), -- STATS:VIEW_EMPLOYEE
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000229'), -- STATS:VIEW_MY
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000219'), -- EVALUATION:VIEW_MY
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000234'), -- ATTACHMENT:UPLOAD
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000103'), -- ORG:VIEW
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000107'), -- USER:VIEW
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000120'), -- KPI:VIEW_MY
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000123')  -- SUBMISSION:VIEW_MY
ON CONFLICT DO NOTHING;

-- DEPUTY: Assistant management
INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000101'), 
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000115'), 
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000117'),
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000121'), 
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000124'),
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000126'),
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000212'), -- KPI:SUBMIT
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000214'), -- SUBMISSION:VIEW
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000221'), -- AI:SUGGEST_KPI
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000229'), -- STATS:VIEW_MY
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000219'), -- EVALUATION:VIEW_MY
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000125'), -- EVALUATION:CREATE
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000234'), -- ATTACHMENT:UPLOAD
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000103'), -- ORG:VIEW
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000107'), -- USER:VIEW
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000227'), -- STATS:VIEW_ORG
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000228'), -- STATS:VIEW_EMPLOYEE
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000120'), -- KPI:VIEW_MY
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000123')  -- SUBMISSION:VIEW_MY
ON CONFLICT DO NOTHING;

-- STAFF: Individual worker
INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000101'), 
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000120'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000122'), 
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000123'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000126'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000207'), -- KPI_PERIOD:VIEW
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000212'), -- KPI:SUBMIT
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000229'), -- STATS:VIEW_MY
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000219'), -- EVALUATION:VIEW_MY
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000125'), -- EVALUATION:CREATE (for self-eval)
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000234')  -- ATTACHMENT:UPLOAD
ON CONFLICT DO NOTHING;

-- LEADER: Team leader permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000101'), 
    ('e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000115'), 
    ('e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000117'),
    ('e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000121'), 
    ('e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000124'),
    ('e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000126'),
    ('e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000212'), -- KPI:SUBMIT
    ('e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000214'), -- SUBMISSION:VIEW
    ('e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000221'), -- AI:SUGGEST_KPI
    ('e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000229'), -- STATS:VIEW_MY
    ('e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000219'), -- EVALUATION:VIEW_MY
    ('e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000125'), -- EVALUATION:CREATE
    ('e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000234'), -- ATTACHMENT:UPLOAD
    ('e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000103'), -- ORG:VIEW
    ('e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000107'), -- USER:VIEW
    ('e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000120'), -- KPI:VIEW_MY
    ('e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000123')  -- SUBMISSION:VIEW_MY
ON CONFLICT DO NOTHING;


-- 4. SECURITY POLICIES (ABAC)
-- ============================================================================
INSERT INTO scopes (id, code) VALUES
    ('00000000-0000-0000-0000-000000000001', 'NODE'),
    ('00000000-0000-0000-0000-000000000002', 'SUBTREE'),
    ('00000000-0000-0000-0000-000000000003', 'CUSTOM');

INSERT INTO policies (id, org_unit_id, name, effect) VALUES
    ('11111111-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'IT Department Management Policy', 'ALLOW'),
    ('11111111-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Deny staff approval actions', 'DENY');

INSERT INTO policy_conditions (policy_id, type, condition_json) VALUES
    ('11111111-0000-0000-0000-000000000001', 'ORG_UNIT', '{"scope": "SUBTREE"}'),
    ('11111111-0000-0000-0000-000000000002', 'ATTRIBUTE', '{"role": "STAFF"}');

INSERT INTO role_policies (role_id, policy_id) VALUES
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-0000-0000-0000-000000000001'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '11111111-0000-0000-0000-000000000002');


-- 5. USERS & ACCOUNT SETUP
-- ============================================================================
INSERT INTO users (id, email, password, full_name, employee_code, phone, status, is_email_verified) VALUES
    ('22222222-0000-0000-0000-000000000100', 'director@demo.com', '$2a$12$Ab.ay.J8o0ExWqdKKXcpmuhU0Itfrn9eUa05wMQGmLh.nfPf5yD92', 'Nguyễn Văn Director', 'EM001', '0901000001', 'ACTIVE', true),
    ('22222222-0000-0000-0000-000000000101', 'head@demo.com', '$2a$12$Mzmf4O7Yqg3NZlHlBA8dt.WZKJRPp4KLU5Hd1YhyQWPYxzHpitZza', 'Trần Thị Head', 'EM002', '0901000002', 'ACTIVE', true),
    ('22222222-0000-0000-0000-000000000102', 'deputy@demo.com', '$2a$12$FLg.uqn4LZK9ooFgc12a5.iaH6sfH212mNiPc0Hjt8HaMA5Qh7nMy', 'Lê Văn Deputy', 'EM003', '0901000003', 'ACTIVE', true),
    ('22222222-0000-0000-0000-000000000103', 'staff@demo.com', '$2a$12$qI4LsOS.rbo/YoyRAJHUduh1PHiYw25CYssLvdV3hyhiN07EFV45G', 'Phạm Thị Staff', 'EM004', '0901000004', 'ACTIVE', true);

INSERT INTO user_role_org_units (user_id, role_id, org_unit_id) VALUES
    ('22222222-0000-0000-0000-000000000100', 'a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    ('22222222-0000-0000-0000-000000000101', 'b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    ('22222222-0000-0000-0000-000000000102', 'c3cccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    ('22222222-0000-0000-0000-000000000103', 'd4dddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');


-- 6. KPI PERIODS & CRITERIA
-- ============================================================================
INSERT INTO kpi_periods (id, organization_id, name, period_type, start_date, end_date) VALUES
    ('33333333-0000-0000-0000-000000000101', '11111111-1111-1111-1111-111111111111', 'Tháng 10/2026', 'MONTHLY', '2026-10-01 00:00:00+07', '2026-10-31 23:59:59+07'),
    ('33333333-0000-0000-0000-000000000102', '11111111-1111-1111-1111-111111111111', 'Quý 4/2026', 'QUARTERLY', '2026-10-01 00:00:00+07', '2026-12-31 23:59:59+07');

INSERT INTO kpi_criteria (id, org_unit_id, kpi_period_id, name, description, weight, target_value, minimum_value, unit, frequency, status, created_by, approved_by, submitted_at, approved_at) VALUES
    ('44444444-0000-0000-0000-000000000101','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-0000-0000-0000-000000000101', 'Doanh thu tháng', 'Đạt doanh thu tối thiểu hàng tháng', 30, 100000000, 80000000, 'VND', 'MONTHLY', 'APPROVED', '22222222-0000-0000-0000-000000000101', '22222222-0000-0000-0000-000000000100', NOW(), NOW()),
    ('44444444-0000-0000-0000-000000000102','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-0000-0000-0000-000000000101', 'Khách hàng mới', 'Số lượng khách hàng mới tiếp cận được', 20, 10, 5, 'khách hàng', 'MONTHLY', 'APPROVED', '22222222-0000-0000-0000-000000000101', '22222222-0000-0000-0000-000000000100', NOW(), NOW());

INSERT INTO kpi_criteria_assignees (kpi_criteria_id, user_id) VALUES
    ('44444444-0000-0000-0000-000000000101', '22222222-0000-0000-0000-000000000103'), 
    ('44444444-0000-0000-0000-000000000102', '22222222-0000-0000-0000-000000000103');

INSERT INTO kpi_reminders (id, kpi_criteria_id, user_id, batch_number, sent_at) VALUES
    ('55555555-0000-0000-0000-000000000101', '44444444-0000-0000-0000-000000000101', '22222222-0000-0000-0000-000000000103', 1, NOW());
