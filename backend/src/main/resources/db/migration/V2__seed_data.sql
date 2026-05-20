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
INSERT INTO organizations (id, name, code, evaluation_max_score, kpi_reminder_percentage) VALUES 
    ('11111111-1111-1111-1111-111111111111', 'FPT Education', 'FPT', 100.0, 50);

INSERT INTO evaluation_levels (organization_id, name, threshold, color) VALUES
    ('11111111-1111-1111-1111-111111111111', 'XUẤT SẮC', 90.0, '#10b981'),
    ('11111111-1111-1111-1111-111111111111', 'TỐT', 80.0, '#3b82f6'),
    ('11111111-1111-1111-1111-111111111111', 'KHÁ', 70.0, '#f59e0b'),
    ('11111111-1111-1111-1111-111111111111', 'TRUNG BÌNH', 50.0, '#6366f1'),
    ('11111111-1111-1111-1111-111111111111', 'YẾU', 0.0, '#ef4444');

INSERT INTO org_hierarchy_levels (id, organization_id, level_order, unit_type_name, manager_role_label, role_level) VALUES 
    ('21111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 0, 'Chi nhánh', 'Giám đốc chi nhánh', 2),
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 1, 'Phòng ban', 'Trưởng phòng', 3),
    ('23333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 2, 'Tổ', 'Nhóm trưởng', 4);

INSERT INTO org_units (id, name, code, parent_id, org_hierarchy_id, district_id, status) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Chi nhánh Hà Nội', 'HN-BRANCH', NULL, '21111111-1111-1111-1111-111111111111', 'b1000000-0000-0000-0000-000000000001', 'ACTIVE'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Phòng IT', 'IT-DEPT', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'b1000000-0000-0000-0000-000000000001', 'ACTIVE'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Team Backend', 'BE-TEAM', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '23333333-3333-3333-3333-333333333333', 'b1000000-0000-0000-0000-000000000001', 'ACTIVE');

-- 3. ROLES & PERMISSIONS
-- ================================================================
-- ROLES
-- ================================================================
INSERT INTO roles (id, organization_id, name, level, rank) VALUES
    -- Level 0: Tập đoàn
    ('f0ffffff-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Tổng Giám đốc',      0, 0),
    ('f0ffffff-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Phó Tổng Giám đốc',  0, 1),

    -- Level 1: Vùng / Chi nhánh lớn
    ('f1ffffff-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111111', 'Giám đốc Vùng',      1, 0),
    ('f1ffffff-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111111', 'Phó Giám đốc Vùng',  1, 1),

    -- Level 2: Công ty / Chi nhánh
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Giám đốc',           2, 0),
    ('a2aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', '11111111-1111-1111-1111-111111111111', 'Phó Giám đốc',       2, 1),

    -- Level 3: Phòng ban
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Trưởng phòng',       3, 0),
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Phó phòng',          3, 1),

    -- Level 4: Nhóm / Cá nhân
    ('e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'Trưởng nhóm',        4, 0),
    ('e6eeeeee-eeee-eeee-eeee-eeeeeeeeeeef', '11111111-1111-1111-1111-111111111111', 'Phó nhóm',           4, 1),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'Nhân viên',          4, 2);

-- ================================================================
-- PERMISSIONS
-- ================================================================
INSERT INTO permissions (id, code, resource, action, description) VALUES
    ('00000000-0000-0000-0000-000000000101', 'DASHBOARD:VIEW',        'DASHBOARD',    'VIEW',         'Xem biểu đồ thống kê'),
    ('00000000-0000-0000-0000-000000000102', 'COMPANY:VIEW',          'COMPANY',      'VIEW',         'Xem hồ sơ công ty'),
    ('00000000-0000-0000-0000-000000000103', 'ORG:VIEW',              'ORG',          'VIEW',         'Xem sơ đồ tổ chức'),
    ('00000000-0000-0000-0000-000000000104', 'ORG:CREATE',            'ORG',          'CREATE',       'Tạo mới phòng ban'),
    ('00000000-0000-0000-0000-000000000105', 'ORG:UPDATE',            'ORG',          'UPDATE',       'Cập nhật phòng ban'),
    ('00000000-0000-0000-0000-000000000106', 'ORG:DELETE',            'ORG',          'DELETE',       'Xóa phòng ban'),
    ('00000000-0000-0000-0000-000000000107', 'USER:VIEW',             'USER',         'VIEW',         'Xem danh mục nhân sự'),
    ('00000000-0000-0000-0000-000000000108', 'USER:CREATE',           'USER',         'CREATE',       'Thêm mới nhân sự'),
    ('00000000-0000-0000-0000-000000000109', 'USER:UPDATE',           'USER',         'UPDATE',       'Sửa thông tin nhân sự'),
    ('00000000-0000-0000-0000-000000000110', 'USER:DELETE',           'USER',         'DELETE',       'Xóa nhân sự'),
    ('00000000-0000-0000-0000-000000000111', 'USER:IMPORT',           'USER',         'IMPORT',       'Nhập nhân sự hàng loạt'),
    ('00000000-0000-0000-0000-000000000112', 'ROLE:VIEW',             'ROLE',         'VIEW',         'Xem danh sách vai trò'),
    ('00000000-0000-0000-0000-000000000113', 'ROLE:ASSIGN',           'ROLE',         'ASSIGN',       'Gán quyền cho người dùng'),
    ('00000000-0000-0000-0000-000000000114', 'PERMISSION:EDIT',       'PERMISSION',   'EDIT',         'Thiết lập chi tiết quyền'),
    ('00000000-0000-0000-0000-000000000115', 'KPI:VIEW',              'KPI',          'VIEW',         'Xem danh mục KPI'),
    ('00000000-0000-0000-0000-000000000116', 'KPI:CREATE',            'KPI',          'CREATE',       'Thiết lập KPI'),
    ('00000000-0000-0000-0000-000000000117', 'KPI:UPDATE',            'KPI',          'UPDATE',       'Sửa chỉ tiêu KPI'),
    ('00000000-0000-0000-0000-000000000118', 'KPI:DELETE',            'KPI',          'DELETE',       'Xóa chỉ tiêu KPI'),
    ('00000000-0000-0000-0000-000000000119', 'KPI:APPROVE_CRITERIA',  'KPI',          'APPROVE_CRITERIA',      'Phê duyệt chỉ tiêu KPI'),
    ('00000000-0000-0000-0000-000000000132', 'KPI:APPROVE_ADJUSTMENT','KPI',          'APPROVE_ADJUSTMENT',    'Phê duyệt điều chỉnh KPI'),
    ('00000000-0000-0000-0000-000000000120', 'KPI:VIEW_MY',           'KPI',          'VIEW_MY',      'Xem KPI cá nhân'),
    ('00000000-0000-0000-0000-000000000121', 'SUBMISSION:REVIEW',     'SUBMISSION',   'REVIEW',       'Duyệt bài nộp KPI'),
    ('00000000-0000-0000-0000-000000000127', 'SUBMISSION:REVIEW_KPI', 'SUBMISSION',   'REVIEW_KPI',   'Xem bài nộp KPI'),
    ('00000000-0000-0000-0000-000000000122', 'SUBMISSION:CREATE',     'SUBMISSION',   'CREATE',       'Nộp báo cáo KPI'),
    ('00000000-0000-0000-0000-000000000123', 'SUBMISSION:VIEW_MY',    'SUBMISSION',   'VIEW_MY',      'Xem lịch sử nộp báo cáo'),
    ('00000000-0000-0000-0000-000000000124', 'EVALUATION:VIEW',       'EVALUATION',   'VIEW',         'Xem kết quả đánh giá'),
    ('00000000-0000-0000-0000-000000000125', 'EVALUATION:CREATE',     'EVALUATION',   'CREATE',       'Thực hiện đánh giá xếp loại'),
    ('00000000-0000-0000-0000-000000000126', 'NOTIF:VIEW',            'NOTIFICATION', 'VIEW',         'Xem thông báo'),
    ('00000000-0000-0000-0000-000000000201', 'ROLE:CREATE',           'ROLE',         'CREATE',       'Tạo mới vai trò'),
    ('00000000-0000-0000-0000-000000000202', 'ROLE:UPDATE',           'ROLE',         'UPDATE',       'Chỉnh sửa vai trò'),
    ('00000000-0000-0000-0000-000000000203', 'ROLE:DELETE',           'ROLE',         'DELETE',       'Xoá vai trò'),
    ('00000000-0000-0000-0000-000000000204', 'PERMISSION:VIEW',       'PERMISSION',   'VIEW',         'Xem danh sách quyền'),
    ('00000000-0000-0000-0000-000000000205', 'COMPANY:UPDATE',        'COMPANY',      'UPDATE',       'Cập nhật thông tin tổ chức'),
    ('00000000-0000-0000-0000-000000000206', 'COMPANY:DELETE',        'COMPANY',      'DELETE',       'Xoá/Lưu trữ tổ chức'),
    ('00000000-0000-0000-0000-000000000207', 'KPI_PERIOD:VIEW',       'KPI_PERIOD',   'VIEW',         'Xem danh sách kỳ đánh giá'),
    ('00000000-0000-0000-0000-000000000208', 'KPI_PERIOD:CREATE',     'KPI_PERIOD',   'CREATE',       'Tạo kỳ đánh giá'),
    ('00000000-0000-0000-0000-000000000209', 'KPI_PERIOD:UPDATE',     'KPI_PERIOD',   'UPDATE',       'Cập nhật kỳ đánh giá'),
    ('00000000-0000-0000-0000-000000000210', 'KPI_PERIOD:DELETE',     'KPI_PERIOD',   'DELETE',       'Xoá kỳ đánh giá'),
    ('00000000-0000-0000-0000-000000000211', 'KPI:IMPORT',            'KPI',          'IMPORT',       'Nhập KPI hàng loạt từ file'),
    ('00000000-0000-0000-0000-000000000212', 'KPI:SUBMIT',            'KPI',          'SUBMIT',       'Gửi KPI để phê duyệt'),
    ('00000000-0000-0000-0000-000000000213', 'KPI:REJECT',            'KPI',          'REJECT',       'Từ chối chỉ tiêu KPI'),
    ('00000000-0000-0000-0000-000000000214', 'SUBMISSION:VIEW',       'SUBMISSION',   'VIEW',         'Xem tất cả bản nộp KPI'),
    ('00000000-0000-0000-0000-000000000215', 'SUBMISSION:DELETE',     'SUBMISSION',   'DELETE',       'Xoá bản nộp KPI'),
    ('00000000-0000-0000-0000-000000000216', 'SUBMISSION:UPDATE',     'SUBMISSION',   'UPDATE',       'Chỉnh sửa bản nộp KPI'),
    ('00000000-0000-0000-0000-000000000217', 'EVALUATION:UPDATE',     'EVALUATION',   'UPDATE',       'Chỉnh sửa đánh giá'),
    ('00000000-0000-0000-0000-000000000218', 'EVALUATION:DELETE',     'EVALUATION',   'DELETE',       'Xoá đánh giá'),
    ('00000000-0000-0000-0000-000000000219', 'EVALUATION:VIEW_MY',    'EVALUATION',   'VIEW_MY',      'Xem đánh giá cá nhân'),
    ('00000000-0000-0000-0000-000000000220', 'NOTIF:MANAGE',          'NOTIFICATION', 'MANAGE',       'Quản lý thông báo hệ thống'),
    ('00000000-0000-0000-0000-000000000221', 'AI:SUGGEST_KPI',        'AI',           'SUGGEST_KPI',  'Sử dụng AI gợi ý KPI'),
    ('00000000-0000-0000-0000-000000000222', 'POLICY:VIEW',           'POLICY',       'VIEW',         'Xem chính sách bảo mật'),
    ('00000000-0000-0000-0000-000000000223', 'POLICY:CREATE',         'POLICY',       'CREATE',       'Tạo chính sách'),
    ('00000000-0000-0000-0000-000000000224', 'POLICY:UPDATE',         'POLICY',       'UPDATE',       'Cập nhật chính sách'),
    ('00000000-0000-0000-0000-000000000225', 'POLICY:DELETE',         'POLICY',       'DELETE',       'Xoá chính sách'),
    ('00000000-0000-0000-0000-000000000226', 'POLICY:ASSIGN',         'POLICY',       'ASSIGN',       'Gán chính sách cho vai trò'),
    ('00000000-0000-0000-0000-000000000227', 'STATS:VIEW_ORG',        'STATS',        'VIEW_ORG',     'Xem thống kê theo phòng ban'),
    ('00000000-0000-0000-0000-000000000228', 'STATS:VIEW_EMPLOYEE',   'STATS',        'VIEW_EMPLOYEE','Xem thống kê nhân viên'),
    ('00000000-0000-0000-0000-000000000229', 'STATS:VIEW_MY',         'STATS',        'VIEW_MY',      'Xem tiến độ cá nhân'),
    ('00000000-0000-0000-0000-000000000230', 'SYSTEM:ADMIN',          'SYSTEM',       'ADMIN',        'Quyền quản trị toàn hệ thống (bypass phạm vi đơn vị)'),
    ('00000000-0000-0000-0000-000000000231', 'USER_ROLE:VIEW',        'USER_ROLE',    'VIEW',         'Xem gán vai trò người dùng'),
    ('00000000-0000-0000-0000-000000000232', 'USER_ROLE:ASSIGN',      'USER_ROLE',    'ASSIGN',       'Gán vai trò cho người dùng'),
    ('00000000-0000-0000-0000-000000000233', 'USER_ROLE:REVOKE',      'USER_ROLE',    'REVOKE',       'Thu hồi vai trò người dùng'),
    ('00000000-0000-0000-0000-000000000234', 'ATTACHMENT:UPLOAD',     'ATTACHMENT',   'UPLOAD',       'Upload tệp đính kèm'),
    ('00000000-0000-0000-0000-000000000235', 'ATTACHMENT:DELETE',     'ATTACHMENT',   'DELETE',       'Xoá tệp đính kèm'),
    ('00000000-0000-0000-0000-000000000236', 'USER:VIEW_LIST',       'USER',         'VIEW_LIST',    'Xem danh sách nhân sự rút gọn (cho Dashboard)'),
    ('00000000-0000-0000-0000-000000000237', 'REMINDER:SEND',        'REMINDER',     'SEND',         'Gửi thông báo nhắc nhở nhân viên')
ON CONFLICT (code) DO NOTHING;

-- ================================================================
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
INSERT INTO users (id, email, password, full_name, employee_code, phone, status, is_email_verified, has_seen_onboarding) VALUES
    ('22222222-0000-0000-0000-000000000100', 'director@demo.com', '$2a$12$Ab.ay.J8o0ExWqdKKXcpmuhU0Itfrn9eUa05wMQGmLh.nfPf5yD92', 'Nguyễn Văn Director', 'EM001', '0901000001', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000000101', 'head@demo.com', '$2a$12$Mzmf4O7Yqg3NZlHlBA8dt.WZKJRPp4KLU5Hd1YhyQWPYxzHpitZza', 'Trần Thị Head', 'EM002', '0901000002', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000000102', 'deputy@demo.com', '$2a$12$FLg.uqn4LZK9ooFgc12a5.iaH6sfH212mNiPc0Hjt8HaMA5Qh7nMy', 'Lê Văn Deputy', 'EM003', '0901000003', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000000103', 'staff@demo.com', '$2a$12$qI4LsOS.rbo/YoyRAJHUduh1PHiYw25CYssLvdV3hyhiN07EFV45G', 'Phạm Thị Staff', 'EM004', '0901000004', 'ACTIVE', true, false);

INSERT INTO user_role_org_units (user_id, role_id, org_unit_id) VALUES
    ('22222222-0000-0000-0000-000000000100', 'a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    ('22222222-0000-0000-0000-000000000101', 'b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    ('22222222-0000-0000-0000-000000000102', 'c3cccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    ('22222222-0000-0000-0000-000000000103', 'd4dddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');


-- 6. KPI PERIODS & CRITERIA
-- ============================================================================
INSERT INTO kpi_periods (id, organization_id, name, period_type, start_date, end_date, notification_date) VALUES
    ('33333333-0000-0000-0000-000000000101', '11111111-1111-1111-1111-111111111111', 'Tháng 10/2026', 'MONTHLY', '2026-10-01 00:00:00+07', '2026-10-31 23:59:59+07', '2026-10-15 00:00:00+07'),
    ('33333333-0000-0000-0000-000000000102', '11111111-1111-1111-1111-111111111111', 'Quý 4/2026', 'QUARTERLY', '2026-10-01 00:00:00+07', '2026-12-31 23:59:59+07', '2026-11-15 00:00:00+07');

INSERT INTO kpi_criteria (id, org_unit_id, kpi_period_id, name, description, weight, target_value, minimum_value, unit, frequency, status, created_by, approved_by, submitted_at, approved_at) VALUES
    ('44444444-0000-0000-0000-000000000101','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-0000-0000-0000-000000000101', 'Doanh thu tháng', 'Đạt doanh thu tối thiểu hàng tháng', 30, 100000000, 80000000, 'VND', 'MONTHLY', 'APPROVED', '22222222-0000-0000-0000-000000000101', '22222222-0000-0000-0000-000000000100', NOW(), NOW()),
    ('44444444-0000-0000-0000-000000000102','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-0000-0000-0000-000000000101', 'Khách hàng mới', 'Số lượng khách hàng mới tiếp cận được', 20, 10, 5, 'khách hàng', 'MONTHLY', 'APPROVED', '22222222-0000-0000-0000-000000000101', '22222222-0000-0000-0000-000000000100', NOW(), NOW());

INSERT INTO kpi_criteria_assignees (kpi_criteria_id, user_id) VALUES
    ('44444444-0000-0000-0000-000000000101', '22222222-0000-0000-0000-000000000103'), 
    ('44444444-0000-0000-0000-000000000102', '22222222-0000-0000-0000-000000000103');

INSERT INTO kpi_reminders (id, kpi_criteria_id, user_id, batch_number, sent_at) VALUES
    ('55555555-0000-0000-0000-000000000101', '44444444-0000-0000-0000-000000000101', '22222222-0000-0000-0000-000000000103', 1, NOW());

-- 7. SIDEBAR CUSTOM LABELS
-- ============================================================================
INSERT INTO sidebar_settings (id, organization_id, menu_key, custom_label) VALUES
    -- Dashboards
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/dashboard', 'Tổng quan'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/dashboard/staff', 'Dashboard cá nhân'),
    
    -- Thiết lập công ty (Menu Cha & Con)
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Thiết lập công ty', 'Thiết lập công ty'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/company', 'Thông tin công ty'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/roles', 'Phân quyền vai trò'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/org-structure', 'Cấu trúc tổ chức'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/users', 'Quản lý nhân sự'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/settings', 'Cấu hình hệ thống'),
    
    -- Quản lý KPI (Menu Cha & Con)
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Quản lý KPI', 'Quản trị KPI'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/kpi-periods', 'Danh mục đợt KPI'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/kpi-criteria', 'Thiết lập chỉ tiêu'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/kpi-criteria/pending', 'Phê duyệt chỉ tiêu'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/kpi-adjustments/pending', 'Duyệt điều chỉnh'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/submissions/org-unit', 'Kiểm soát bài nộp'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/evaluations', 'Đánh giá xếp loại'),
    
    -- Cá nhân & Thống kê
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/my-kpi', 'KPI của tôi'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/my-adjustments', 'Yêu cầu điều chỉnh'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/submissions', 'Lịch sử báo cáo'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/analytics', 'Phân tích & Thống kê');

-- ============================================================================
-- 8. OBJECTIVE LAYER (OKR) SEED DATA FOR 2026
-- ============================================================================

-- ============================================================================
-- 8. OBJECTIVE LAYER (OKR) SEED DATA FOR 2026 (RICH & WEIGHTED MULTI-KPI)
-- ============================================================================

-- Add 2026 periods
INSERT INTO kpi_periods (id, organization_id, name, period_type, start_date, end_date, notification_date) VALUES
    ('33333333-0000-0000-0000-000000000201', '11111111-1111-1111-1111-111111111111', 'Quý 1/2026', 'QUARTERLY', '2026-01-01 00:00:00+07', '2026-03-31 23:59:59+07', '2026-03-15 00:00:00+07'),
    ('33333333-0000-0000-0000-000000000202', '11111111-1111-1111-1111-111111111111', 'Quý 2/2026', 'QUARTERLY', '2026-04-01 00:00:00+07', '2026-06-30 23:59:59+07', '2026-06-15 00:00:00+07');

-- Add Objectives
-- Obj 1: Tối ưu Core Backend (IT-DEPT) - Created Jan 2026
INSERT INTO objectives (id, organization_id, org_unit_id, code, name, description, start_date, end_date, status, created_at, updated_at) VALUES
    ('77777777-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'OBJ-001', 'Tối ưu hệ thống Core Backend', 'Cải thiện hiệu năng và giảm độ trễ của hệ thống Core API', '2026-01-01', '2026-12-31', 'ACTIVE', '2026-01-15 09:00:00+07', '2026-01-15 09:00:00+07');

-- Obj 2: Xây dựng cổng thanh toán trực tuyến (BE-TEAM) - Created Feb 2026
INSERT INTO objectives (id, organization_id, org_unit_id, code, name, description, start_date, end_date, status, created_at, updated_at) VALUES
    ('77777777-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'OBJ-002', 'Xây dựng cổng thanh toán trực tuyến', 'Tích hợp các cổng ví điện tử phổ biến trong nước', '2026-02-01', '2026-08-31', 'ACTIVE', '2026-02-10 10:00:00+07', '2026-02-10 10:00:00+07');

-- Obj 3: Nâng cao trải nghiệm Web App (HN-BRANCH) - Created Mar 2026
INSERT INTO objectives (id, organization_id, org_unit_id, code, name, description, start_date, end_date, status, created_at, updated_at) VALUES
    ('77777777-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'OBJ-004', 'Nâng cao trải nghiệm người dùng Web App', 'Nâng cấp giao diện Mobile-first và tối ưu hóa thời gian tải trang', '2026-03-01', '2026-09-30', 'ACTIVE', '2026-03-05 08:30:00+07', '2026-03-05 08:30:00+07');

-- Obj 4: Triển khai microservices Analytics (BE-TEAM) - Created May 2026 (New in May)
INSERT INTO objectives (id, organization_id, org_unit_id, code, name, description, start_date, end_date, status, created_at, updated_at) VALUES
    ('77777777-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'OBJ-003', 'Triển khai microservices cho module Analytics', 'Tách module phân tích thống kê thành các service độc lập', '2026-05-01', '2026-11-30', 'ACTIVE', '2026-05-10 14:00:00+07', '2026-05-10 14:00:00+07');


-- Add Key Results
-- KR 1: Giảm latency API & Tối ưu Database (Obj 1)
INSERT INTO key_results (id, objective_id, code, name, description, target_value, current_value, unit, created_at, updated_at) VALUES
    ('88888888-1111-1111-1111-111111111111', '77777777-1111-1111-1111-111111111111', 'KR-1.1', 'Nâng cao hiệu năng Core Backend', 'Bao gồm tối ưu độ trễ API và hiệu suất Database', 100.0, 88.5, '%', '2026-01-15 09:30:00+07', '2026-01-15 09:30:00+07');

-- KR 2: Tích hợp thành công 3 ví điện tử (Obj 2)
INSERT INTO key_results (id, objective_id, code, name, description, target_value, current_value, unit, created_at, updated_at) VALUES
    ('88888888-2222-2222-2222-222222222222', '77777777-2222-2222-2222-222222222222', 'KR-2.1', 'Tích hợp thành công 3 ví điện tử', 'Momo, ZaloPay, VNPay', 3.0, 3.0, 'ví', '2026-02-10 10:30:00+07', '2026-02-10 10:30:00+07');

-- KR 3: Tối ưu UI & Tốc độ Web App (Obj 3)
INSERT INTO key_results (id, objective_id, code, name, description, target_value, current_value, unit, created_at, updated_at) VALUES
    ('88888888-4444-4444-4444-444444444444', '77777777-4444-4444-4444-444444444444', 'KR-4.1', 'Tối ưu UI và Tốc độ Web App', 'Hoàn thiện giao diện mới và thời gian phản hồi', 100.0, 89.5, '%', '2026-03-05 09:00:00+07', '2026-03-05 09:00:00+07');

-- KR 4: Đưa 5 services lên Production (Obj 4)
INSERT INTO key_results (id, objective_id, code, name, description, target_value, current_value, unit, created_at, updated_at) VALUES
    ('88888888-3333-3333-3333-333333333333', '77777777-3333-3333-3333-333333333333', 'KR-3.1', 'Đưa 5 services lên Production', 'Deploy thành công các core analytical services', 5.0, 2.0, 'service', '2026-05-10 14:30:00+07', '2026-05-10 14:30:00+07');


-- Add KPI Criteria (Multiple KPIs for KR 1 and KR 3 with distinct weights)
-- MULTIPLE KPIs for KR 1 (Total Weight = 100: 40% and 60%)
-- KPI 1a: Đo lường độ trễ API Core (Weight = 40.0)
INSERT INTO kpi_criteria (id, org_unit_id, kpi_period_id, name, description, weight, target_value, minimum_value, unit, frequency, key_result_id, status, created_by, approved_by, submitted_at, approved_at, created_at) VALUES
    ('99999999-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-0000-0000-0000-000000000201', 'Độ trễ API Core', 'Thời gian phản hồi mục tiêu là 100ms', 40.0, 100.0, 150.0, 'ms', 'DAILY', '88888888-1111-1111-1111-111111111111', 'APPROVED', '22222222-0000-0000-0000-000000000101', '22222222-0000-0000-0000-000000000100', '2026-01-20 00:00:00+07', '2026-01-20 00:00:00+07', '2026-01-20 00:00:00+07');

-- KPI 1b: Tối ưu hoá Database Query (Weight = 60.0)
INSERT INTO kpi_criteria (id, org_unit_id, kpi_period_id, name, description, weight, target_value, minimum_value, unit, frequency, key_result_id, status, created_by, approved_by, submitted_at, approved_at, created_at) VALUES
    ('99999999-1111-1111-1111-111111111112', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-0000-0000-0000-000000000201', 'Tỷ lệ tối ưu Database', 'Tỷ lệ các query nặng được tối ưu hóa thành công', 60.0, 80.0, 50.0, '%', 'DAILY', '88888888-1111-1111-1111-111111111111', 'APPROVED', '22222222-0000-0000-0000-000000000101', '22222222-0000-0000-0000-000000000100', '2026-01-20 00:00:00+07', '2026-01-20 00:00:00+07', '2026-01-20 00:00:00+07');


-- KPI 2: Tích hợp Ví Điện Tử (Weight = 100.0)
INSERT INTO kpi_criteria (id, org_unit_id, kpi_period_id, name, description, weight, target_value, minimum_value, unit, frequency, key_result_id, status, created_by, approved_by, submitted_at, approved_at, created_at) VALUES
    ('99999999-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '33333333-0000-0000-0000-000000000201', 'Tích hợp Ví Điện Tử', 'Số lượng ví điện tử được tích hợp thành công', 100.0, 3.0, 1.0, 'ví', 'MONTHLY', '88888888-2222-2222-2222-222222222222', 'APPROVED', '22222222-0000-0000-0000-000000000101', '22222222-0000-0000-0000-000000000100', '2026-02-15 00:00:00+07', '2026-02-15 00:00:00+07', '2026-02-15 00:00:00+07');


-- MULTIPLE KPIs for KR 3 (Total Weight = 100: 30% and 70%)
-- KPI 3a: Hoàn thiện giao diện mới (Weight = 30.0)
INSERT INTO kpi_criteria (id, org_unit_id, kpi_period_id, name, description, weight, target_value, minimum_value, unit, frequency, key_result_id, status, created_by, approved_by, submitted_at, approved_at, created_at) VALUES
    ('99999999-4444-4444-4444-444444444441', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-0000-0000-0000-000000000201', 'Hoàn thiện UI Dashboard', 'Tỷ lệ hoàn thành code giao diện mới', 30.0, 100.0, 80.0, '%', 'MONTHLY', '88888888-4444-4444-4444-444444444444', 'APPROVED', '22222222-0000-0000-0000-000000000101', '22222222-0000-0000-0000-000000000100', '2026-03-10 00:00:00+07', '2026-03-10 00:00:00+07', '2026-03-10 00:00:00+07');

-- KPI 3b: Đo lường tốc độ phản hồi nhanh (Weight = 70.0)
INSERT INTO kpi_criteria (id, org_unit_id, kpi_period_id, name, description, weight, target_value, minimum_value, unit, frequency, key_result_id, status, created_by, approved_by, submitted_at, approved_at, created_at) VALUES
    ('99999999-4444-4444-4444-444444444442', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-0000-0000-0000-000000000201', 'Tỷ lệ phản hồi nhanh', 'Tỷ lệ trang tải dưới 2 giây', 70.0, 100.0, 90.0, '%', 'DAILY', '88888888-4444-4444-4444-444444444444', 'APPROVED', '22222222-0000-0000-0000-000000000101', '22222222-0000-0000-0000-000000000100', '2026-03-10 00:00:00+07', '2026-03-10 00:00:00+07', '2026-03-10 00:00:00+07');


-- KPI 4: Deploy Analytics Services (Weight = 100.0)
INSERT INTO kpi_criteria (id, org_unit_id, kpi_period_id, name, description, weight, target_value, minimum_value, unit, frequency, key_result_id, status, created_by, approved_by, submitted_at, approved_at, created_at) VALUES
    ('99999999-3333-3333-3333-333333333333', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '33333333-0000-0000-0000-000000000202', 'Deploy Analytics Services', 'Deploy các Analytics Microservices lên Kubernetes', 100.0, 5.0, 2.0, 'service', 'MONTHLY', '88888888-3333-3333-3333-333333333333', 'APPROVED', '22222222-0000-0000-0000-000000000101', '22222222-0000-0000-0000-000000000100', '2026-05-11 00:00:00+07', '2026-05-11 00:00:00+07', '2026-05-11 00:00:00+07');


-- Assignees
INSERT INTO kpi_criteria_assignees (kpi_criteria_id, user_id) VALUES
    ('99999999-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000103'),
    ('99999999-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000102'),
    ('99999999-1111-1111-1111-111111111112', '22222222-0000-0000-0000-000000000103'),
    ('99999999-2222-2222-2222-222222222222', '22222222-0000-0000-0000-000000000103'),
    ('99999999-4444-4444-4444-444444444441', '22222222-0000-0000-0000-000000000102'),
    ('99999999-4444-4444-4444-444444444442', '22222222-0000-0000-0000-000000000102'),
    ('99999999-3333-3333-3333-333333333333', '22222222-0000-0000-0000-000000000103');


-- Add KPI Submissions (with realistic timelines showing progression over months)
-- JAN 2026 Submissions
-- Sub 1a: KPI 1a (Latency) actual = 95.0
INSERT INTO kpi_submissions (id, org_unit_id, kpi_criteria_id, submitted_by, actual_value, status, created_at) VALUES
    ('aaaaaaab-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '99999999-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000103', 55.0, 'APPROVED', '2026-01-25 15:00:00+07'),
    ('aaaaaaab-1111-1111-1111-111111111113', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '99999999-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000102', 40.0, 'APPROVED', '2026-01-26 15:00:00+07');

-- FEB 2026 Submissions
-- Sub 1b: KPI 1b (DB Query) actual = 70.0 (70/80 = 87.5% progress)
INSERT INTO kpi_submissions (id, org_unit_id, kpi_criteria_id, submitted_by, actual_value, status, created_at) VALUES
    ('aaaaaaab-1111-1111-1111-111111111112', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '99999999-1111-1111-1111-111111111112', '22222222-0000-0000-0000-000000000103', 70.0, 'APPROVED', '2026-02-15 15:30:00+07');

-- Sub 2a: KPI 2 (Ví điện tử - actual 1 ví đầu tiên)
INSERT INTO kpi_submissions (id, org_unit_id, kpi_criteria_id, submitted_by, actual_value, status, created_at) VALUES
    ('aaaaaaab-2222-2222-2222-222222222221', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '99999999-2222-2222-2222-222222222222', '22222222-0000-0000-0000-000000000103', 1.0, 'APPROVED', '2026-02-28 16:00:00+07');

-- MAR 2026 Submissions
-- Sub 2b: KPI 2 (Ví điện tử - thêm 2 ví -> đạt 3/3 target)
INSERT INTO kpi_submissions (id, org_unit_id, kpi_criteria_id, submitted_by, actual_value, status, created_at) VALUES
    ('aaaaaaab-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '99999999-2222-2222-2222-222222222222', '22222222-0000-0000-0000-000000000103', 2.0, 'APPROVED', '2026-03-20 16:00:00+07');

-- Sub 3a: KPI 3a (Hoàn thiện UI Dashboard) actual = 100.0 (100% progress)
INSERT INTO kpi_submissions (id, org_unit_id, kpi_criteria_id, submitted_by, actual_value, status, created_at) VALUES
    ('aaaaaaab-4444-4444-4444-444444444441', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-4444-4444-4444-444444444441', '22222222-0000-0000-0000-000000000102', 100.0, 'APPROVED', '2026-03-25 10:00:00+07');

-- APR 2026 Submissions
-- Sub 3b: KPI 3b (Tốc độ phản hồi) actual = 85.0 (85% progress)
INSERT INTO kpi_submissions (id, org_unit_id, kpi_criteria_id, submitted_by, actual_value, status, created_at) VALUES
    ('aaaaaaab-4444-4444-4444-444444444442', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-4444-4444-4444-444444444442', '22222222-0000-0000-0000-000000000102', 85.0, 'APPROVED', '2026-04-15 10:00:00+07');

-- MAY 2026 Submissions
-- Sub 4: KPI 4 (Deploy Analytics Services) actual = 2.0 (target 5)
INSERT INTO kpi_submissions (id, org_unit_id, kpi_criteria_id, submitted_by, actual_value, status, created_at) VALUES
    ('aaaaaaab-3333-3333-3333-333333333333', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '99999999-3333-3333-3333-333333333333', '22222222-0000-0000-0000-000000000103', 2.0, 'APPROVED', '2026-05-12 10:00:00+07');

-- ============================================================================
-- 9. ROLE PERMISSIONS FOR LOCAL DIRECTOR ROLE (a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa)
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000101'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000102'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000103'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000104'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000105'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000106'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000107'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000108'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000109'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000110'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000111'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000112'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000113'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000114'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000115'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000116'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000117'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000118'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000119'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000121'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000124'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000125'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000126'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000132'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000201'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000202'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000203'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000204'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000205'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000206'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000207'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000208'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000209'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000210'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000211'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000212'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000213'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000214'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000215'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000216'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000217'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000218'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000220'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000221'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000222'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000223'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000224'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000225'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000226'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000227'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000228'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000230'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000231'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000232'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000233'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000234'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000235'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000237')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000101'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000102'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000103'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000104'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000105'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000106'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000107'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000108'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000109'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000110'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000111'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000112'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000113'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000114'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000115'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000116'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000117'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000118'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000119'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000121'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000124'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000125'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000126'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000132'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000201'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000202'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000203'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000204'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000205'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000206'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000207'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000208'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000209'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000210'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000211'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000212'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000213'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000214'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000215'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000216'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000217'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000218'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000220'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000221'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000222'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000223'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000224'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000225'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000226'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000227'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000228'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000230'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000231'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000232'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000233'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000234'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000235'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000237')
ON CONFLICT (role_id, permission_id) DO NOTHING;
