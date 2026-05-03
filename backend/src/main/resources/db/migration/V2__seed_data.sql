-- ====================================================
-- V2: Seed Data - Provinces, Districts, Sample Company
-- ====================================================

-- ====================================================
-- Provinces (Vietnam - sample)
-- ====================================================
INSERT INTO provinces (id, name, code) VALUES
    ('a1000000-0000-0000-0000-000000000001', 'Hà Nội', 'HN'),
    ('a1000000-0000-0000-0000-000000000002', 'Hồ Chí Minh', 'HCM'),
    ('a1000000-0000-0000-0000-000000000003', 'Đà Nẵng', 'DN'),
    ('a1000000-0000-0000-0000-000000000004', 'Hải Phòng', 'HP'),
    ('a1000000-0000-0000-0000-000000000005', 'Cần Thơ', 'CT');

-- ====================================================
-- Districts (sample for Hà Nội & HCM)
-- ====================================================
INSERT INTO districts (id, name, code, province_id) VALUES
    -- Hà Nội
    ('b1000000-0000-0000-0000-000000000001', 'Ba Đình', 'HN-BD', 'a1000000-0000-0000-0000-000000000001'),
    ('b1000000-0000-0000-0000-000000000002', 'Hoàn Kiếm', 'HN-HK', 'a1000000-0000-0000-0000-000000000001'),
    ('b1000000-0000-0000-0000-000000000003', 'Cầu Giấy', 'HN-CG', 'a1000000-0000-0000-0000-000000000001'),
    ('b1000000-0000-0000-0000-000000000004', 'Đống Đa', 'HN-DD', 'a1000000-0000-0000-0000-000000000001'),
    ('b1000000-0000-0000-0000-000000000005', 'Hai Bà Trưng', 'HN-HBT', 'a1000000-0000-0000-0000-000000000001'),
    -- Hồ Chí Minh
    ('b1000000-0000-0000-0000-000000000006', 'Quận 1', 'HCM-Q1', 'a1000000-0000-0000-0000-000000000002'),
    ('b1000000-0000-0000-0000-000000000007', 'Quận 3', 'HCM-Q3', 'a1000000-0000-0000-0000-000000000002'),
    ('b1000000-0000-0000-0000-000000000008', 'Quận 7', 'HCM-Q7', 'a1000000-0000-0000-0000-000000000002'),
    ('b1000000-0000-0000-0000-000000000009', 'Bình Thạnh', 'HCM-BT', 'a1000000-0000-0000-0000-000000000002'),
    ('b1000000-0000-0000-0000-000000000010', 'Thủ Đức', 'HCM-TD', 'a1000000-0000-0000-0000-000000000002');

-- ====================================================
-- 1. Insert Organization
-- ====================================================
INSERT INTO organizations (id, name, code) VALUES 
('11111111-1111-1111-1111-111111111111', 'FPT Education', 'FPT');

-- ====================================================
-- 2. Insert Hierarchy Levels
-- ====================================================
-- Cấp 1: Chi nhánh
INSERT INTO org_hierarchy_levels (id, organization_id, level_order, unit_type_name, manager_role_label)
VALUES ('21111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 1, 'Chi nhánh', 'Giám đốc chi nhánh');

-- Cấp 2: Phòng ban
INSERT INTO org_hierarchy_levels (id, organization_id, level_order, unit_type_name, manager_role_label)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 2, 'Phòng ban', 'Trưởng phòng');

-- Cấp 3: Tổ đội
INSERT INTO org_hierarchy_levels (id, organization_id, level_order, unit_type_name, manager_role_label)
VALUES ('23333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 3, 'Tổ', 'Nhân viên');


-- ====================================================
-- 3. Insert Sample Org Units
-- ====================================================

-- Level 1: Chi nhánh Hà Nội
INSERT INTO org_units (id, name, org_hierarchy_id, district_id, status)
VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Chi nhánh Hà Nội',
    '21111111-1111-1111-1111-111111111111', -- Đã sửa ID tham chiếu
    'b1000000-0000-0000-0000-000000000001',
    'ACTIVE'
);

-- Level 2: Phòng IT
INSERT INTO org_units (id, name, parent_id, org_hierarchy_id, district_id, status)
VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Phòng IT',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222', -- Đã sửa ID tham chiếu
    'b1000000-0000-0000-0000-000000000001',
    'ACTIVE'
);

-- Level 3: Team Backend
INSERT INTO org_units (id, name, parent_id, org_hierarchy_id, district_id, status)
VALUES (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'Team Backend',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '23333333-3333-3333-3333-333333333333', -- Đã sửa ID tham chiếu
    'b1000000-0000-0000-0000-000000000001',
    'ACTIVE'
);

-- Level 2: Phòng Marketing
INSERT INTO org_units (id, name, parent_id, org_hierarchy_id, district_id, status)
VALUES (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'Phòng Marketing',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'b1000000-0000-0000-0000-000000000001',
    'ACTIVE'
);

-- Level 2: Phòng Nhân sự
INSERT INTO org_units (id, name, parent_id, org_hierarchy_id, district_id, status)
VALUES (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'Phòng Nhân sự',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'b1000000-0000-0000-0000-000000000001',
    'ACTIVE'
);

-- Level 3: Team Frontend
INSERT INTO org_units (id, name, parent_id, org_hierarchy_id, district_id, status)
VALUES (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'Team Frontend',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '23333333-3333-3333-3333-333333333333',
    'b1000000-0000-0000-0000-000000000001',
    'ACTIVE'
);

-- Level 3: Team Content
INSERT INTO org_units (id, name, parent_id, org_hierarchy_id, district_id, status)
VALUES (
    '11111111-2222-3333-4444-555555555555',
    'Team Content',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '23333333-3333-3333-3333-333333333333',
    'b1000000-0000-0000-0000-000000000001',
    'ACTIVE'
);

-- Level 1: Chi nhánh Hồ Chí Minh
INSERT INTO org_units (id, name, org_hierarchy_id, district_id, status)
VALUES (
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    'Chi nhánh Hồ Chí Minh',
    '21111111-1111-1111-1111-111111111111',
    'b1000000-0000-0000-0000-000000000006',
    'ACTIVE'
);

-- Level 2: Phòng Kinh doanh (HCM)
INSERT INTO org_units (id, name, parent_id, org_hierarchy_id, district_id, status)
VALUES (
    'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
    'Phòng Kinh doanh',
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    '22222222-2222-2222-2222-222222222222',
    'b1000000-0000-0000-0000-000000000006',
    'ACTIVE'
);

INSERT INTO users (id, email, password, full_name, phone, status, is_email_verified) VALUES
    ('d1000000-0000-0000-0000-000000000001',
     'director@demo.com', '$2a$12$Ab.ay.J8o0ExWqdKKXcpmuhU0Itfrn9eUa05wMQGmLh.nfPf5yD92',
     'Nguyễn Văn Director', '0901000001', 'ACTIVE', true),

    ('d1000000-0000-0000-0000-000000000002',
     'head@demo.com', '$2a$12$Mzmf4O7Yqg3NZlHlBA8dt.WZKJRPp4KLU5Hd1YhyQWPYxzHpitZza',
     'Trần Thị Head', '0901000002', 'ACTIVE', true),

    ('d1000000-0000-0000-0000-000000000003',
     'deputy@demo.com', '$2a$12$FLg.uqn4LZK9ooFgc12a5.iaH6sfH212mNiPc0Hjt8HaMA5Qh7nMy',
     'Lê Văn Deputy', '0901000003', 'ACTIVE', true),

    ('d1000000-0000-0000-0000-000000000004',
     'staff@demo.com', '$2a$12$qI4LsOS.rbo/YoyRAJHUduh1PHiYw25CYssLvdV3hyhiN07EFV45G',
     'Phạm Thị Staff', '0901000004', 'ACTIVE', true),

    ('d1000000-0000-0000-0000-000000000005',
     'marketing_head@demo.com', '$2a$12$Ab.ay.J8o0ExWqdKKXcpmuhU0Itfrn9eUa05wMQGmLh.nfPf5yD92',
     'Lê Marketing', '0901000005', 'ACTIVE', true),

    ('d1000000-0000-0000-0000-000000000006',
     'hr_head@demo.com', '$2a$12$Ab.ay.J8o0ExWqdKKXcpmuhU0Itfrn9eUa05wMQGmLh.nfPf5yD92',
     'Hoàng Nhân Sự', '0901000006', 'ACTIVE', true),

    ('d1000000-0000-0000-0000-000000000007',
     'it_staff1@demo.com', '$2a$12$qI4LsOS.rbo/YoyRAJHUduh1PHiYw25CYssLvdV3hyhiN07EFV45G',
     'Nguyễn IT 1', '0901000007', 'ACTIVE', true),

    ('d1000000-0000-0000-0000-000000000008',
     'it_staff2@demo.com', '$2a$12$qI4LsOS.rbo/YoyRAJHUduh1PHiYw25CYssLvdV3hyhiN07EFV45G',
     'Trần IT 2', '0901000008', 'ACTIVE', true),

    ('d1000000-0000-0000-0000-000000000009',
     'sale_head@demo.com', '$2a$12$Ab.ay.J8o0ExWqdKKXcpmuhU0Itfrn9eUa05wMQGmLh.nfPf5yD92',
     'Phạm Kinh Doanh', '0901000009', 'ACTIVE', true);

INSERT INTO roles (id, name)
VALUES
('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'DIRECTOR'), -- Director
('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'HEAD'), -- Head
('c3cccccc-cccc-cccc-cccc-cccccccccccc', 'DEPUTY'), -- Deputy
('d4dddddd-dddd-dddd-dddd-dddddddddddd', 'STAFF'); -- Staff

-- ====================================================
-- Sample User Role Org Units
-- ====================================================
-- Director
INSERT INTO user_role_org_units (user_id, role_id, org_unit_id)
VALUES (
'd1000000-0000-0000-0000-000000000001',
'a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
);

-- Head
INSERT INTO user_role_org_units (user_id, role_id, org_unit_id)
VALUES (
'd1000000-0000-0000-0000-000000000002',
'b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);

-- Deputy
INSERT INTO user_role_org_units (user_id, role_id, org_unit_id)
VALUES (
'd1000000-0000-0000-0000-000000000003',
'c3cccccc-cccc-cccc-cccc-cccccccccccc',
'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);

-- Staff
INSERT INTO user_role_org_units (user_id, role_id, org_unit_id)
VALUES (
'd1000000-0000-0000-0000-000000000004',
'd4dddddd-dddd-dddd-dddd-dddddddddddd',
'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);

-- Marketing Head
INSERT INTO user_role_org_units (user_id, role_id, org_unit_id)
VALUES (
'd1000000-0000-0000-0000-000000000005',
'b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
'cccccccc-cccc-cccc-cccc-cccccccccccc'
);

-- HR Head
INSERT INTO user_role_org_units (user_id, role_id, org_unit_id)
VALUES (
'd1000000-0000-0000-0000-000000000006',
'b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
);

-- IT Staff 1
INSERT INTO user_role_org_units (user_id, role_id, org_unit_id)
VALUES ('d1000000-0000-0000-0000-000000000007', 'd4dddddd-dddd-dddd-dddd-dddddddddddd', 'dddddddd-dddd-dddd-dddd-dddddddddddd');

-- IT Staff 2
INSERT INTO user_role_org_units (user_id, role_id, org_unit_id)
VALUES ('d1000000-0000-0000-0000-000000000008', 'd4dddddd-dddd-dddd-dddd-dddddddddddd', 'ffffffff-ffff-ffff-ffff-ffffffffffff');

-- Sale Head (HCM)
INSERT INTO user_role_org_units (user_id, role_id, org_unit_id)
VALUES ('d1000000-0000-0000-0000-000000000009', 'b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff');


-- Director chỉ ở COMPANY
INSERT INTO role_scopes (role_id, org_unit_id)
VALUES ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Head chỉ ở DEPARTMENT
INSERT INTO role_scopes (role_id, org_unit_id)
VALUES ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- Deputy chỉ ở DEPARTMENT
INSERT INTO role_scopes (role_id, org_unit_id)
VALUES ('c3cccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- Staff chỉ ở TEAM
INSERT INTO role_scopes (role_id, org_unit_id)
VALUES ('d4dddddd-dddd-dddd-dddd-dddddddddddd', 'dddddddd-dddd-dddd-dddd-dddddddddddd');


-- ====================================================
-- Sample Permission
-- ====================================================
INSERT INTO permissions (id, code, resource, action, description) VALUES
-- Dashboard
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e01', 'DASHBOARD:VIEW', 'DASHBOARD', 'VIEW', 'Xem biểu đồ thống kê và báo cáo tổng quan'),
-- Company
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e02', 'COMPANY:VIEW', 'COMPANY', 'VIEW', 'Xem thông tin chi tiết và hồ sơ công ty'),
-- Organization
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e03', 'ORG:VIEW', 'ORG', 'VIEW', 'Xem sơ đồ tổ chức và danh sách phòng ban'),
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e04', 'ORG:CREATE', 'ORG', 'CREATE', 'Tạo mới phòng ban, tổ đội trong sơ đồ'),
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e05', 'ORG:UPDATE', 'ORG', 'UPDATE', 'Cập nhật thông tin phòng ban, tổ đội'),
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e06', 'ORG:DELETE', 'ORG', 'DELETE', 'Xóa phòng ban, tổ đội khỏi hệ thống'),
-- Users
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e07', 'USER:VIEW', 'USER', 'VIEW', 'Xem danh mục và thông tin nhân sự'),
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e08', 'USER:CREATE', 'USER', 'CREATE', 'Thêm mới tài khoản nhân sự'),
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e09', 'USER:UPDATE', 'USER', 'UPDATE', 'Cập nhật thông tin tài khoản nhân sự'),
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e10', 'USER:DELETE', 'USER', 'DELETE', 'Xóa tài khoản nhân sự (Soft delete)'),
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e11', 'USER:IMPORT', 'USER', 'IMPORT', 'Nhập dữ liệu nhân sự hàng loạt từ file'),
-- Roles & Permissions
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e12', 'ROLE:VIEW', 'ROLE', 'VIEW', 'Xem danh sách các vai trò trong hệ thống'),
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e13', 'ROLE:ASSIGN', 'ROLE', 'ASSIGN', 'Gán vai trò và quyền hạn cho người dùng'),
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e14', 'PERMISSION:EDIT', 'PERMISSION', 'EDIT', 'Thiết lập chi tiết quyền cho từng vai trò'),
-- KPI
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e15', 'KPI:VIEW', 'KPI', 'VIEW', 'Xem danh mục các chỉ tiêu KPI của đơn vị'),
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e16', 'KPI:CREATE', 'KPI', 'CREATE', 'Thiết lập mới chỉ tiêu KPI cho đơn vị'),
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e17', 'KPI:UPDATE', 'KPI', 'UPDATE', 'Chỉnh sửa nội dung chỉ tiêu KPI'),
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e18', 'KPI:DELETE', 'KPI', 'DELETE', 'Xóa bỏ chỉ tiêu KPI khỏi đơn vị'),
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e19', 'KPI:APPROVE', 'KPI', 'APPROVE', 'Phê duyệt hoặc từ chối chỉ tiêu KPI'),
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e20', 'KPI:VIEW_MY', 'KPI', 'VIEW_MY', 'Theo dõi các chỉ tiêu KPI cá nhân được giao'),
-- Submissions
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e21', 'SUBMISSION:REVIEW', 'SUBMISSION', 'REVIEW', 'Kiểm tra, đánh giá và duyệt bài nộp KPI'),
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e22', 'SUBMISSION:CREATE', 'SUBMISSION', 'CREATE', 'Nộp báo cáo và minh chứng kết quả KPI'),
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e23', 'SUBMISSION:VIEW_MY', 'SUBMISSION', 'VIEW_MY', 'Xem lịch sử các bài báo cáo đã nộp'),
-- Evaluations
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e24', 'EVALUATION:VIEW', 'EVALUATION', 'VIEW', 'Xem kết quả chấm điểm và xếp loại'),
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e25', 'EVALUATION:CREATE', 'EVALUATION', 'CREATE', 'Thực hiện chấm điểm, đánh giá xếp loại'),
-- Notifications
('7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e26', 'NOTIF:VIEW', 'NOTIFICATION', 'VIEW', 'Xem danh sách các thông báo hệ thống');

-- ====================================================
-- Sample Role Permission
-- ====================================================
-- ====================================================
-- Role-Permission Mappings (Production-Ready Sample)
-- ====================================================

-- 1. DIRECTOR (System/Org Admin): Absolute control over everything
INSERT INTO role_permissions (role_id, permission_id) 
SELECT 'a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id FROM permissions;

-- 2. HEAD (Trưởng phòng/Manager): Full management within their unit
INSERT INTO role_permissions (role_id, permission_id) VALUES
('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e01'), -- DASHBOARD:VIEW
('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e02'), -- COMPANY:VIEW
('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e03'), -- ORG:VIEW
('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e07'), -- USER:VIEW
('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e15'), -- KPI:VIEW
('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e16'), -- KPI:CREATE
('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e17'), -- KPI:UPDATE
('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e19'), -- KPI:APPROVE
('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e21'), -- SUBMISSION:REVIEW
('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e24'), -- EVALUATION:VIEW
('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e25'), -- EVALUATION:CREATE
('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e26'); -- NOTIF:VIEW

-- 3. DEPUTY (Phó phòng/Assistant): Operations and Review
INSERT INTO role_permissions (role_id, permission_id) VALUES
('c3cccccc-cccc-cccc-cccc-cccccccccccc', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e01'), -- DASHBOARD:VIEW
('c3cccccc-cccc-cccc-cccc-cccccccccccc', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e03'), -- ORG:VIEW
('c3cccccc-cccc-cccc-cccc-cccccccccccc', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e15'), -- KPI:VIEW
('c3cccccc-cccc-cccc-cccc-cccccccccccc', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e17'), -- KPI:UPDATE
('c3cccccc-cccc-cccc-cccc-cccccccccccc', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e21'), -- SUBMISSION:REVIEW
('c3cccccc-cccc-cccc-cccc-cccccccccccc', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e24'), -- EVALUATION:VIEW
('c3cccccc-cccc-cccc-cccc-cccccccccccc', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e26'); -- NOTIF:VIEW

-- 4. STAFF (Nhân viên): Execution and Self-Reporting
INSERT INTO role_permissions (role_id, permission_id) VALUES
('d4dddddd-dddd-dddd-dddd-dddddddddddd', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e01'), -- DASHBOARD:VIEW
('d4dddddd-dddd-dddd-dddd-dddddddddddd', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e20'), -- KPI:VIEW_MY
('d4dddddd-dddd-dddd-dddd-dddddddddddd', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e22'), -- SUBMISSION:CREATE
('d4dddddd-dddd-dddd-dddd-dddddddddddd', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e23'), -- SUBMISSION:VIEW_MY
('d4dddddd-dddd-dddd-dddd-dddddddddddd', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e24'), -- EVALUATION:VIEW
('d4dddddd-dddd-dddd-dddd-dddddddddddd', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e26'); -- NOTIF:VIEW

-- ====================================================
-- Sample Policy
-- ====================================================
-- Policy: Head chỉ approve trong phòng IT
INSERT INTO policies (id, org_unit_id, name, effect)
VALUES (
'aaa1aaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
'Head approve KPI IT',
'ALLOW'
);

-- Policy: Staff không được approve
INSERT INTO policies (id, org_unit_id, name, effect)
VALUES (
'bbb2bbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
'Deny staff approve',
'DENY'
);

-- ====================================================
-- Sample Policy Condition
-- ====================================================
-- Điều kiện theo org_unit subtree
INSERT INTO policy_conditions (policy_id, type, condition_json)
VALUES (
'aaa1aaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
'ORG_UNIT',
'{"scope": "SUBTREE"}'
);

-- Điều kiện deny cho role STAFF
INSERT INTO policy_conditions (policy_id, type, condition_json)
VALUES (
'bbb2bbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
'ATTRIBUTE',
'{"role": "STAFF"}'
);

-- ====================================================
-- Sample Role Policies
-- ====================================================
-- HEAD dùng policy allow
INSERT INTO role_policies VALUES
('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaa1aaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- STAFF dùng policy deny
INSERT INTO role_policies VALUES
('d4dddddd-dddd-dddd-dddd-dddddddddddd', 'bbb2bbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- ====================================================
-- Sample Scopes
-- ====================================================
INSERT INTO scopes (id, code) VALUES
('bbbbb2bb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'NODE'),
('ccccc3cc-cccc-cccc-cccc-cccccccccccc', 'SUBTREE'),
('ddddd4dd-dddd-dddd-dddd-dddddddddddd', 'CUSTOM');

-- ====================================================
-- Sample KPI Criteria
-- ====================================================
INSERT INTO kpi_criteria (id, org_unit_id, name, description, weight, target_value, unit,
                          frequency, status, created_by, approved_by, submitted_at, approved_at) VALUES
    ('f1000000-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     'Doanh thu tháng', 'Đạt doanh thu tối thiểu hàng tháng', 30, 100000000, 'VND',
     'MONTHLY', 'APPROVED', 'd1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001',
     NOW(), NOW()),

    ('f1000000-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     'Khách hàng mới', 'Số lượng khách hàng mới tiếp cận được', 20, 10, 'khách hàng',
     'MONTHLY', 'APPROVED', 'd1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001',
     NOW(), NOW()),

    ('f1000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'Tỷ lệ chốt đơn', 'Tỷ lệ chuyển đổi từ khách tiềm năng sang khách hàng', 25, 50, '%',
     'QUARTERLY', 'DRAFT', 'd1000000-0000-0000-0000-000000000002', NULL,
     NULL, NULL),

    ('f1000000-0000-0000-0000-000000000004', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     'Chất lượng code', 'Tỷ lệ lỗi trên mỗi 1000 dòng code', 15, 5, 'lỗi',
     'MONTHLY', 'APPROVED', 'd1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001',
     NOW(), NOW()),

    ('f1000000-0000-0000-0000-000000000005', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     'Thời gian phản hồi', 'Thời gian trung bình xử lý ticket hỗ trợ', 10, 2, 'giờ',
     'MONTHLY', 'APPROVED', 'd1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001',
     NOW(), NOW()),

    ('f1000000-0000-0000-0000-000000000006', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
     'Chiến dịch quảng cáo', 'Số lượng chiến dịch triển khai', 40, 5, 'chiến dịch',
     'MONTHLY', 'APPROVED', 'd1000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000001',
     NOW(), NOW()),

    ('f1000000-0000-0000-0000-000000000007', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
     'Tuyển dụng nhân sự', 'Số lượng nhân sự tuyển mới', 50, 10, 'người',
     'MONTHLY', 'APPROVED', 'd1000000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000001',
     NOW(), NOW()),

    ('f1000000-0000-0000-0000-000000000008', 'dddddddd-dddd-dddd-dddd-dddddddddddd',
     'Uptime Server', 'Tỷ lệ hoạt động của server', 20, 99.9, '%',
     'MONTHLY', 'APPROVED', 'd1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001',
     NOW(), NOW()),

    ('f1000000-0000-0000-0000-000000000009', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
     'Tốc độ tải trang', 'Thời gian tải trang LCP', 25, 2.5, 's',
     'MONTHLY', 'APPROVED', 'd1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001',
     NOW(), NOW()),

    ('f1000000-0000-0000-0000-000000000010', '11111111-2222-3333-4444-555555555555',
     'Số bài viết SEO', 'Số bài viết được index Google', 30, 20, 'bài',
     'MONTHLY', 'APPROVED', 'd1000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000001',
     NOW(), NOW()),

    ('f1000000-0000-0000-0000-000000000011', 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
     'Doanh số bán hàng', 'Chỉ tiêu doanh số chi nhánh HCM', 60, 500000000, 'VND',
     'MONTHLY', 'APPROVED', 'd1000000-0000-0000-0000-000000000009', 'd1000000-0000-0000-0000-000000000001',
     NOW(), NOW());

INSERT INTO kpi_criteria_assignees (kpi_criteria_id, user_id) VALUES
    ('f1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000004'),
    ('f1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000004'),
    ('f1000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000004'),
    ('f1000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000004');

-- ====================================================
-- Sample Submissions
-- ====================================================
INSERT INTO kpi_submissions (id, org_unit_id, kpi_criteria_id, submitted_by, actual_value, note, status, reviewed_by, reviewed_at, created_at) VALUES
    ('e1000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'f1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000004', 85000000, 'Báo cáo doanh thu tháng 1', 'APPROVED', 'd1000000-0000-0000-0000-000000000002', NOW(), NOW() - INTERVAL '30 days'),
    ('e1000000-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'f1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000004', 120000000, 'Báo cáo doanh thu tháng 2', 'APPROVED', 'd1000000-0000-0000-0000-000000000002', NOW(), NOW() - INTERVAL '10 days'),
    ('e1000000-0000-0000-0000-000000000003', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'f1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000004', 8, 'Tiếp cận được 8 khách hàng', 'PENDING', NULL, NULL, NOW() - INTERVAL '2 days'),
    ('e1000000-0000-0000-0000-000000000004', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'f1000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000004', 2, 'Hoàn thành sprint không lỗi nghiêm trọng', 'APPROVED', 'd1000000-0000-0000-0000-000000000002', NOW(), NOW() - INTERVAL '5 days'),
    ('e1000000-0000-0000-0000-000000000005', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'f1000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000004', 3, 'Ticket phức tạp cần nhiều thời gian', 'REJECTED', 'd1000000-0000-0000-0000-000000000002', NOW(), NOW() - INTERVAL '1 days'),
    -- Marketing Submissions
    ('e1000000-0000-0000-0000-000000000006', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'f1000000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000005', 4, 'Đã chạy 4 chiến dịch', 'APPROVED', 'd1000000-0000-0000-0000-000000000001', NOW(), NOW()),
    -- HR Submissions
    ('e1000000-0000-0000-0000-000000000007', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'f1000000-0000-0000-0000-000000000007', 'd1000000-0000-0000-0000-000000000006', 2, 'Mới tuyển được 2 người', 'APPROVED', 'd1000000-0000-0000-0000-000000000001', NOW(), NOW()),
    -- Backend Team Submissions
    ('e1000000-0000-0000-0000-000000000008', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'f1000000-0000-0000-0000-000000000008', 'd1000000-0000-0000-0000-000000000004', 100, 'Uptime tuyệt đối', 'APPROVED', 'd1000000-0000-0000-0000-000000000002', NOW(), NOW()),
    -- Frontend Team Submissions
    ('e1000000-0000-0000-0000-000000000009', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'f1000000-0000-0000-0000-000000000009', 'd1000000-0000-0000-0000-000000000002', 1.2, 'Tối ưu ảnh thành công', 'APPROVED', 'd1000000-0000-0000-0000-000000000001', NOW(), NOW()),
    -- Content Team Submissions
    ('e1000000-0000-0000-0000-000000000010', '11111111-2222-3333-4444-555555555555', 'f1000000-0000-0000-0000-000000000010', 'd1000000-0000-0000-0000-000000000005', 15, 'Mới index được 15 bài', 'APPROVED', 'd1000000-0000-0000-0000-000000000001', NOW(), NOW()),
    ('e1000000-0000-0000-0000-000000000011', 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff', 'f1000000-0000-0000-0000-000000000011', 'd1000000-0000-0000-0000-000000000009', 480000000, 'Sắp đạt chỉ tiêu tháng', 'APPROVED', 'd1000000-0000-0000-0000-000000000001', NOW(), NOW());

-- ====================================================
-- Sample Evaluations
-- ====================================================
INSERT INTO evaluations (id, org_unit_id, user_id, kpi_criteria_id, evaluator_id, score, comment, created_at) VALUES
    ('c1000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'd1000000-0000-0000-0000-000000000004', 'f1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 8.5, 'Làm việc rất tốt, vượt chỉ tiêu doanh thu', NOW() - INTERVAL '5 days'),
    ('c1000000-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'd1000000-0000-0000-0000-000000000004', 'f1000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000002', 9.0, 'Code sạch, ít bug', NOW() - INTERVAL '10 days'),
    ('c1000000-0000-0000-0000-000000000003', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'd1000000-0000-0000-0000-000000000004', 'f1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 7.0, 'Cần cố gắng hơn trong tháng tới', NOW() - INTERVAL '40 days');

-- ====================================================
-- Sample Notifications
-- ====================================================
INSERT INTO notifications (id, org_unit_id, user_id, title, message, type, reference_id, is_read, created_at) VALUES
    ('71000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'd1000000-0000-0000-0000-000000000004', 'KPI mới được giao', 'Bạn được giao KPI mới: Chất lượng code', 'KPI_ASSIGNED', 'f1000000-0000-0000-0000-000000000004', false, NOW() - INTERVAL '1 hour'),
    ('71000000-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'd1000000-0000-0000-0000-000000000004', 'Bài nộp bị từ chối', 'Báo cáo Thời gian phản hồi đã bị từ chối bởi Head', 'SUBMISSION_REJECTED', 'e1000000-0000-0000-0000-000000000005', false, NOW() - INTERVAL '2 hours'),
    ('71000000-0000-0000-0000-000000000003', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'd1000000-0000-0000-0000-000000000004', 'Đánh giá mới', 'Trần Thị Head đã đánh giá kết quả của bạn', 'EVALUATION_COMPLETED', 'c1000000-0000-0000-0000-000000000001', true, NOW() - INTERVAL '1 day'),
    ('71000000-0000-0000-0000-000000000004', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'd1000000-0000-0000-0000-000000000004', 'Hệ thống bảo trì', 'Hệ thống sẽ bảo trì vào lúc 2h sáng mai', 'SYSTEM', NULL, false, NOW() - INTERVAL '5 hours');
