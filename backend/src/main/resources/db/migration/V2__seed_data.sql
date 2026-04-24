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
INSERT INTO organizations (id, name, code) VALUES 
    ('11111111-1111-1111-1111-111111111111', 'FPT Education', 'FPT');

INSERT INTO org_hierarchy_levels (id, organization_id, level_order, unit_type_name, manager_role_label) VALUES 
    ('21111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 1, 'Chi nhánh', 'Giám đốc chi nhánh'),
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 2, 'Phòng ban', 'Trưởng phòng'),
    ('23333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 3, 'Tổ', 'Nhóm trưởng');

INSERT INTO org_units (id, name, parent_id, org_hierarchy_id, district_id, status) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Chi nhánh Hà Nội', NULL, '21111111-1111-1111-1111-111111111111', 'b1000000-0000-0000-0000-000000000001', 'ACTIVE'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Phòng IT', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'b1000000-0000-0000-0000-000000000001', 'ACTIVE'),
    ('10000000-0000-0000-0000-000000000033', 'Phòng Marketing', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'b1000000-0000-0000-0000-000000000001', 'ACTIVE'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Team Backend', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '23333333-3333-3333-3333-333333333333', 'b1000000-0000-0000-0000-000000000001', 'ACTIVE');


-- 3. ROLES & PERMISSIONS
-- ============================================================================
INSERT INTO roles (id, name) VALUES
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'DIRECTOR'),
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'HEAD'),
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', 'DEPUTY'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', 'STAFF');

INSERT INTO permissions (id, code, resource, action, description) VALUES
    ('p101', 'DASHBOARD:VIEW', 'DASHBOARD', 'VIEW', 'Xem biểu đồ thống kê'),
    ('p102', 'COMPANY:VIEW', 'COMPANY', 'VIEW', 'Xem hồ sơ công ty'),
    ('p103', 'ORG:VIEW', 'ORG', 'VIEW', 'Xem sơ đồ tổ chức'),
    ('p104', 'ORG:CREATE', 'ORG', 'CREATE', 'Tạo mới phòng ban'),
    ('p105', 'ORG:UPDATE', 'ORG', 'UPDATE', 'Cập nhật phòng ban'),
    ('p106', 'ORG:DELETE', 'ORG', 'DELETE', 'Xóa phòng ban'),
    ('p107', 'USER:VIEW', 'USER', 'VIEW', 'Xem danh mục nhân sự'),
    ('p108', 'USER:CREATE', 'USER', 'CREATE', 'Thêm mới nhân sự'),
    ('p109', 'USER:UPDATE', 'USER', 'UPDATE', 'Sửa thông tin nhân sự'),
    ('p110', 'USER:DELETE', 'USER', 'DELETE', 'Xóa nhân sự'),
    ('p111', 'USER:IMPORT', 'USER', 'IMPORT', 'Nhập nhân sự hàng loạt'),
    ('p112', 'ROLE:VIEW', 'ROLE', 'VIEW', 'Xem danh sách vai trò'),
    ('p113', 'ROLE:ASSIGN', 'ROLE', 'ASSIGN', 'Gán quyền cho người dùng'),
    ('p114', 'PERMISSION:EDIT', 'PERMISSION', 'EDIT', 'Thiết lập chi tiết quyền'),
    ('p115', 'KPI:VIEW', 'KPI', 'VIEW', 'Xem danh mục KPI'),
    ('p116', 'KPI:CREATE', 'KPI', 'CREATE', 'Thiết lập KPI'),
    ('p117', 'KPI:UPDATE', 'KPI', 'UPDATE', 'Sửa chỉ tiêu KPI'),
    ('p118', 'KPI:DELETE', 'KPI', 'DELETE', 'Xóa chỉ tiêu KPI'),
    ('p119', 'KPI:APPROVE', 'KPI', 'APPROVE', 'Phê duyệt chỉ tiêu KPI'),
    ('p120', 'KPI:VIEW_MY', 'KPI', 'VIEW_MY', 'Xem KPI cá nhân'),
    ('p121', 'SUBMISSION:REVIEW', 'SUBMISSION', 'REVIEW', 'Duyệt bài nộp KPI'),
    ('p122', 'SUBMISSION:CREATE', 'SUBMISSION', 'CREATE', 'Nộp báo cáo KPI'),
    ('p123', 'SUBMISSION:VIEW_MY', 'SUBMISSION', 'VIEW_MY', 'Xem lịch sử nộp báo cáo'),
    ('p124', 'EVALUATION:VIEW', 'EVALUATION', 'VIEW', 'Xem kết quả đánh giá'),
    ('p125', 'EVALUATION:CREATE', 'EVALUATION', 'CREATE', 'Thực hiện đánh giá xếp loại'),
    ('p126', 'NOTIF:VIEW', 'NOTIFICATION', 'VIEW', 'Xem thông báo');

-- Role-Permission Mapping
-- DIRECTOR: Full permissions
INSERT INTO role_permissions (role_id, permission_id) 
SELECT 'a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id FROM permissions;

-- HEAD: Management permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'p101'), ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'p103'),
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'p107'), ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'p115'),
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'p116'), ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'p117'),
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'p119'), ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'p121'),
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'p124'), ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'p125'),
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'p126');

-- DEPUTY: Assistant management
INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', 'p101'), ('c3cccccc-cccc-cccc-cccc-cccccccccccc', 'p103'),
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', 'p115'), ('c3cccccc-cccc-cccc-cccc-cccccccccccc', 'p117'),
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', 'p121'), ('c3cccccc-cccc-cccc-cccc-cccccccccccc', 'p124'),
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', 'p126');

-- STAFF: Individual worker
INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', 'p101'), ('d4dddddd-dddd-dddd-dddd-dddddddddddd', 'p120'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', 'p122'), ('d4dddddd-dddd-dddd-dddd-dddddddddddd', 'p123'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', 'p124'), ('d4dddddd-dddd-dddd-dddd-dddddddddddd', 'p126');


-- 4. SECURITY POLICIES (ABAC)
-- ============================================================================
INSERT INTO scopes (id, code) VALUES
    ('s1', 'NODE'),
    ('s2', 'SUBTREE'),
    ('s3', 'CUSTOM');

INSERT INTO policies (id, org_unit_id, name, effect) VALUES
    ('pol-it-head', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'IT Department Management Policy', 'ALLOW'),
    ('pol-staff-deny', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Deny staff approval actions', 'DENY');

INSERT INTO policy_conditions (policy_id, type, condition_json) VALUES
    ('pol-it-head', 'ORG_UNIT', '{"scope": "SUBTREE"}'),
    ('pol-staff-deny', 'ATTRIBUTE', '{"role": "STAFF"}');

INSERT INTO role_policies (role_id, policy_id) VALUES
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'pol-it-head'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', 'pol-staff-deny');


-- 5. USERS & ACCOUNT SETUP
-- ============================================================================
INSERT INTO users (id, email, password, full_name, employee_code, phone, status, is_email_verified) VALUES
    ('d100', 'director@demo.com', '$2a$12$Ab.ay.J8o0ExWqdKKXcpmuhU0Itfrn9eUa05wMQGmLh.nfPf5yD92', 'Nguyễn Văn Director', 'EM001', '0901000001', 'ACTIVE', true),
    ('d101', 'head@demo.com', '$2a$12$Mzmf4O7Yqg3NZlHlBA8dt.WZKJRPp4KLU5Hd1YhyQWPYxzHpitZza', 'Trần Thị Head', 'EM002', '0901000002', 'ACTIVE', true),
    ('d102', 'deputy@demo.com', '$2a$12$FLg.uqn4LZK9ooFgc12a5.iaH6sfH212mNiPc0Hjt8HaMA5Qh7nMy', 'Lê Văn Deputy', 'EM003', '0901000003', 'ACTIVE', true),
    ('d103', 'staff@demo.com', '$2a$12$qI4LsOS.rbo/YoyRAJHUduh1PHiYw25CYssLvdV3hyhiN07EFV45G', 'Phạm Thị Staff', 'EM004', '0901000004', 'ACTIVE', true),
    -- Marketing Team
    ('m201', 'xuan.lead@marketing.demo', '$2a$12$Ab.ay.J8o0ExWqdKKXcpmuhU0Itfrn9eUa05wMQGmLh.nfPf5yD92', 'Xuân', 'MKT001', '0123456001', 'ACTIVE', true),
    ('m202', 'khoa.deputy@marketing.demo', '$2a$12$Ab.ay.J8o0ExWqdKKXcpmuhU0Itfrn9eUa05wMQGmLh.nfPf5yD92', 'Khoa', 'MKT002', '0123456002', 'ACTIVE', true),
    ('m203', 'hai@marketing.demo', '$2a$12$Ab.ay.J8o0ExWqdKKXcpmuhU0Itfrn9eUa05wMQGmLh.nfPf5yD92', 'Hải', 'MKT003', '0123456003', 'ACTIVE', true),
    ('m204', 'duc@marketing.demo', '$2a$12$Ab.ay.J8o0ExWqdKKXcpmuhU0Itfrn9eUa05wMQGmLh.nfPf5yD92', 'Đức', 'MKT004', '0123456004', 'ACTIVE', true),
    ('m205', 'nghia@marketing.demo', '$2a$12$Ab.ay.J8o0ExWqdKKXcpmuhU0Itfrn9eUa05wMQGmLh.nfPf5yD92', 'Nghĩa', 'MKT005', '0123456005', 'ACTIVE', true);

INSERT INTO user_role_org_units (user_id, role_id, org_unit_id) VALUES
    ('d100', 'a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    ('d101', 'b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    ('d102', 'c3cccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    ('d103', 'd4dddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    ('m201', 'b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '10000000-0000-0000-0000-000000000033'),
    ('m202', 'c3cccccc-cccc-cccc-cccc-cccccccccccc', '10000000-0000-0000-0000-000000000033'),
    ('m203', 'd4dddddd-dddd-dddd-dddd-dddddddddddd', '10000000-0000-0000-0000-000000000033'),
    ('m204', 'd4dddddd-dddd-dddd-dddd-dddddddddddd', '10000000-0000-0000-0000-000000000033'),
    ('m205', 'd4dddddd-dddd-dddd-dddd-dddddddddddd', '10000000-0000-0000-0000-000000000033');


-- 6. KPI PERIODS & CRITERIA
-- ============================================================================
INSERT INTO kpi_periods (id, organization_id, name, period_type, start_date, end_date) VALUES
    ('e101', '11111111-1111-1111-1111-111111111111', 'Tháng 10/2026', 'MONTHLY', '2026-10-01 00:00:00+07', '2026-10-31 23:59:59+07'),
    ('e102', '11111111-1111-1111-1111-111111111111', 'Quý 4/2026', 'QUARTERLY', '2026-10-01 00:00:00+07', '2026-12-31 23:59:59+07'),
    ('e103', '11111111-1111-1111-1111-111111111111', 'KPI Marketing Đợt 1', 'MONTHLY', '2026-04-22 00:00:00+07', '2026-05-22 23:59:59+07');

INSERT INTO kpi_criteria (id, org_unit_id, kpi_period_id, name, description, weight, target_value, minimum_value, unit, frequency, status, created_by, approved_by, submitted_at, approved_at) VALUES
    ('f101','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'e101', 'Doanh thu tháng', 'Đạt doanh thu tối thiểu hàng tháng', 30, 100000000, 80000000, 'VND', 'MONTHLY', 'APPROVED', 'd101', 'd100', NOW(), NOW()),
    ('f102','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'e101', 'Khách hàng mới', 'Số lượng khách hàng mới tiếp cận được', 20, 10, 5, 'khách hàng', 'MONTHLY', 'APPROVED', 'd101', 'd100', NOW(), NOW()),
    -- Marketing Criteria
    ('k301','10000000-0000-0000-0000-000000000033', 'e103', 'Tỷ lệ hoàn thành chung', 'Tỷ lệ hoàn thành chung của KeyPerson', 40, 100, 90, '%', 'WEEKLY', 'APPROVED', 'm201', 'd100', NOW(), NOW()),
    ('k302','10000000-0000-0000-0000-000000000033', 'e103', 'Tăng trưởng các kênh', 'Tăng trưởng lượt view hàng tháng', 30, 100, 15, '%', 'WEEKLY', 'APPROVED', 'm201', 'd100', NOW(), NOW()),
    ('k303','10000000-0000-0000-0000-000000000033', 'e103', 'Vị trí SEO Google', 'Các từ khóa nằm trong trang 1', 30, 1, 1, 'Trang', 'WEEKLY', 'APPROVED', 'm201', 'd100', NOW(), NOW());

INSERT INTO kpi_criteria_assignees (kpi_criteria_id, user_id) VALUES
    ('f101', 'd103'), ('f102', 'd103'),
    ('k301', 'm201'), ('k301', 'm202'), ('k301', 'm203'), ('k301', 'm204'), ('k301', 'm205'),
    ('k302', 'm203'), ('k303', 'm204');
