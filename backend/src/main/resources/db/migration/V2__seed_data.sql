-- ============================================================================
-- V2: SEED DATA - COMPREHENSIVE INITIAL DATA
-- ============================================================================

-- 1. PROVINCES & DISTRICTS
-- ============================================================================
INSERT INTO provinces (id, name, code) VALUES
    ('a1000000-0000-0000-0000-000000000001', 'Hà Nội', 'HN'),
    ('a1000000-0000-0000-0000-000000000002', 'Hồ Chí Minh', 'HCM'),
    ('a1000000-0000-0000-0000-000000000003', 'Đà Nẵng', 'DN'),
    ('a1000000-0000-0000-0000-000000000004', 'Hải Phòng', 'HP'),
    ('a1000000-0000-0000-0000-000000000005', 'Cần Thơ', 'CT');

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


-- 2. ORGANIZATIONAL STRUCTURE
-- ============================================================================
INSERT INTO organizations (id, name, code) VALUES 
    ('11111111-1111-1111-1111-111111111111', 'FPT Education', 'FPT');

INSERT INTO org_hierarchy_levels (id, organization_id, level_order, unit_type_name, manager_role_label) VALUES 
    ('21111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 1, 'Chi nhánh', 'Giám đốc chi nhánh'),
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 2, 'Phòng ban', 'Trưởng phòng'),
    ('23333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 3, 'Tổ', 'Nhân viên');

INSERT INTO org_units (id, name, parent_id, org_hierarchy_id, district_id, status) VALUES
    -- Level 1: Chi nhánh
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Chi nhánh Hà Nội', NULL, '21111111-1111-1111-1111-111111111111', 'b1000000-0000-0000-0000-000000000001', 'ACTIVE'),
    -- Level 2: Phòng ban
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Phòng IT', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'b1000000-0000-0000-0000-000000000001', 'ACTIVE'),
    ('10000000-0000-0000-0000-000000000033', 'Phòng Marketing', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'b1000000-0000-0000-0000-000000000001', 'ACTIVE'),
    -- Level 3: Tổ đội
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Team Backend', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '23333333-3333-3333-3333-333333333333', 'b1000000-0000-0000-0000-000000000001', 'ACTIVE');


-- 3. ROLES & PERMISSIONS
-- ============================================================================
INSERT INTO roles (id, name) VALUES
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'DIRECTOR'),
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'HEAD'),
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', 'DEPUTY'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', 'STAFF');

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

INSERT INTO role_permissions (role_id, permission_id) VALUES
    -- DIRECTOR permissions
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e01'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e02'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e03'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e04'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e05'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e06'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e07'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e08'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e09'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e10'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e11'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e12'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e13'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e14'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e15'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e16'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e17'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e18'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e19'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e20'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e21'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e22'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e23'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e24'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e25'),
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e26'),
    -- HEAD permissions
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e01'),
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e03'),
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e07'),
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e15'),
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e16'),
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e17'),
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e19'),
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e21'),
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e24'),
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e25'),
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e26'),
    -- DEPUTY permissions
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e01'),
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e03'),
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e15'),
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e17'),
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e21'),
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e24'),
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e26'),
    -- STAFF permissions
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e01'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e20'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e22'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e23'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e24'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '7c9e8a1a-4d3b-4f5a-8c9e-1a2b3c4d5e26');


-- 4. SECURITY POLICIES & CONDITIONS
-- ============================================================================
INSERT INTO scopes (id, code) VALUES
    ('bbbbb2bb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'NODE'),
    ('ccccc3cc-cccc-cccc-cccc-cccccccccccc', 'SUBTREE'),
    ('ddddd4dd-dddd-dddd-dddd-dddddddddddd', 'CUSTOM');

INSERT INTO policies (id, org_unit_id, name, effect) VALUES
    ('aaa1aaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Head approve KPI IT', 'ALLOW'),
    ('bbb2bbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Deny staff approve', 'DENY');

INSERT INTO policy_conditions (policy_id, type, condition_json) VALUES
    ('aaa1aaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ORG_UNIT', '{"scope": "SUBTREE"}'),
    ('bbb2bbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ATTRIBUTE', '{"role": "STAFF"}');

INSERT INTO role_policies (role_id, policy_id) VALUES
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaa1aaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', 'bbb2bbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');


-- 5. USERS & ACCOUNT SETUP
-- ============================================================================
INSERT INTO users (id, email, password, full_name, employee_code, phone, status, is_email_verified) VALUES
    -- Sample Core Team
    ('d1000000-0000-0000-0000-000000000001', 'director@demo.com', '$2a$12$Ab.ay.J8o0ExWqdKKXcpmuhU0Itfrn9eUa05wMQGmLh.nfPf5yD92', 'Nguyễn Văn Director', 'EM001', '0901000001', 'ACTIVE', true),
    ('d1000000-0000-0000-0000-000000000002', 'head@demo.com', '$2a$12$Mzmf4O7Yqg3NZlHlBA8dt.WZKJRPp4KLU5Hd1YhyQWPYxzHpitZza', 'Trần Thị Head', 'EM002', '0901000002', 'ACTIVE', true),
    ('d1000000-0000-0000-0000-000000000003', 'deputy@demo.com', '$2a$12$FLg.uqn4LZK9ooFgc12a5.iaH6sfH212mNiPc0Hjt8HaMA5Qh7nMy', 'Lê Văn Deputy', 'EM003', '0901000003', 'ACTIVE', true),
    ('d1000000-0000-0000-0000-000000000004', 'staff@demo.com', '$2a$12$qI4LsOS.rbo/YoyRAJHUduh1PHiYw25CYssLvdV3hyhiN07EFV45G', 'Phạm Thị Staff', 'EM004', '0901000004', 'ACTIVE', true),
    -- Marketing Team
    ('20000000-0000-0000-0000-000000000011', 'xuan.lead@marketing.demo', '$2a$12$Ab.ay.J8o0ExWqdKKXcpmuhU0Itfrn9eUa05wMQGmLh.nfPf5yD92', 'Xuân', 'MKT001', '0123456001', 'ACTIVE', true),
    ('20000000-0000-0000-0000-000000000012', 'khoa.deputy@marketing.demo', '$2a$12$Ab.ay.J8o0ExWqdKKXcpmuhU0Itfrn9eUa05wMQGmLh.nfPf5yD92', 'Khoa', 'MKT002', '0123456002', 'ACTIVE', true),
    ('20000000-0000-0000-0000-000000000013', 'hai@marketing.demo', '$2a$12$Ab.ay.J8o0ExWqdKKXcpmuhU0Itfrn9eUa05wMQGmLh.nfPf5yD92', 'Hải', 'MKT003', '0123456003', 'ACTIVE', true),
    ('20000000-0000-0000-0000-000000000014', 'duc@marketing.demo', '$2a$12$Ab.ay.J8o0ExWqdKKXcpmuhU0Itfrn9eUa05wMQGmLh.nfPf5yD92', 'Đức', 'MKT004', '0123456004', 'ACTIVE', true),
    ('20000000-0000-0000-0000-000000000015', 'nghia@marketing.demo', '$2a$12$Ab.ay.J8o0ExWqdKKXcpmuhU0Itfrn9eUa05wMQGmLh.nfPf5yD92', 'Nghĩa', 'MKT005', '0123456005', 'ACTIVE', true);

INSERT INTO user_role_org_units (user_id, role_id, org_unit_id) VALUES
    -- Core Assignments
    ('d1000000-0000-0000-0000-000000000001', 'a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), -- Director @ Chi nhánh Hà Nội
    ('d1000000-0000-0000-0000-000000000002', 'b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), -- Head @ Phòng IT
    ('d1000000-0000-0000-0000-000000000003', 'c3cccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), -- Deputy @ Phòng IT
    ('d1000000-0000-0000-0000-000000000004', 'd4dddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), -- Staff @ Phòng IT
    -- Marketing Assignments
    ('20000000-0000-0000-0000-000000000011', 'b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '10000000-0000-0000-0000-000000000033'), -- Xuân (HEAD) @ Marketing
    ('20000000-0000-0000-0000-000000000012', 'c3cccccc-cccc-cccc-cccc-cccccccccccc', '10000000-0000-0000-0000-000000000033'), -- Khoa (DEPUTY) @ Marketing
    ('20000000-0000-0000-0000-000000000013', 'd4dddddd-dddd-dddd-dddd-dddddddddddd', '10000000-0000-0000-0000-000000000033'), -- Hải (STAFF) @ Marketing
    ('20000000-0000-0000-0000-000000000014', 'd4dddddd-dddd-dddd-dddd-dddddddddddd', '10000000-0000-0000-0000-000000000033'), -- Đức (STAFF) @ Marketing
    ('20000000-0000-0000-0000-000000000015', 'd4dddddd-dddd-dddd-dddd-dddddddddddd', '10000000-0000-0000-0000-000000000033'); -- Nghĩa (STAFF) @ Marketing

INSERT INTO role_scopes (role_id, org_unit_id) VALUES
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), -- Director: COMPANY scope
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), -- Head: DEPARTMENT scope
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), -- Deputy: DEPARTMENT scope
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', 'dddddddd-dddd-dddd-dddd-dddddddddddd'); -- Staff: TEAM scope


-- 6. KPI PERIODS & CRITERIA
-- ============================================================================
INSERT INTO kpi_periods (id, organization_id, name, period_type, start_date, end_date) VALUES
    ('e1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Tháng 10/2026', 'MONTHLY', '2026-10-01 00:00:00+07', '2026-10-31 23:59:59+07'),
    ('e1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Quý 4/2026', 'QUARTERLY', '2026-10-01 00:00:00+07', '2026-12-31 23:59:59+07'),
    ('e1000000-0000-0000-0000-000000000022', '11111111-1111-1111-1111-111111111111', 'KPI Marketing Đợt 1 (22/04 - 22/05)', 'MONTHLY', '2026-04-22 00:00:00+07', '2026-05-22 23:59:59+07');

INSERT INTO kpi_criteria (id, org_unit_id, kpi_period_id, name, description, weight, target_value, minimum_value, unit, frequency, status, created_by, approved_by, submitted_at, approved_at) VALUES
    -- Sample IT Criteria
    ('f1000000-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'e1000000-0000-0000-0000-000000000001', 'Doanh thu tháng', 'Đạt doanh thu tối thiểu hàng tháng', 30, 100000000, 80000000, 'VND', 'MONTHLY', 'APPROVED', 'd1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', NOW(), NOW()),
    ('f1000000-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'e1000000-0000-0000-0000-000000000001', 'Khách hàng mới', 'Số lượng khách hàng mới tiếp cận được', 20, 10, 5, 'khách hàng', 'MONTHLY', 'APPROVED', 'd1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', NOW(), NOW()),
    ('f1000000-0000-0000-0000-000000000003','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'e1000000-0000-0000-0000-000000000002', 'Tỷ lệ chốt đơn', 'Tỷ lệ chuyển đổi từ khách tiềm năng sang khách hàng', 25, 50, 40, '%', 'QUARTERLY', 'DRAFT', 'd1000000-0000-0000-0000-000000000002', NULL, NULL, NULL),
    -- Marketing Criteria
    ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000033', 'e1000000-0000-0000-0000-000000000022', 'Kết quả chung KeyPerson', 'Tỷ lệ hoàn thành chung của KeyPerson', 30, 100, 90, '%', 'WEEKLY', 'APPROVED', '20000000-0000-0000-0000-000000000011', NULL, NULL, NULL),
    ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000033', 'e1000000-0000-0000-0000-000000000022', 'Tăng trưởng các kênh truyền thông', 'Tăng trưởng lượt view hàng tháng (organic)', 10, 100, 15, '%', 'WEEKLY', 'APPROVED', '20000000-0000-0000-0000-000000000011', NULL, NULL, NULL),
    ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000033', 'e1000000-0000-0000-0000-000000000022', 'Vị trí SEO các từ khóa Google', 'Các từ khóa nằm trong trang 1 khi search', 10, 1, 1, 'Trang', 'WEEKLY', 'APPROVED', '20000000-0000-0000-0000-000000000011', NULL, NULL, NULL),
    ('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000033', 'e1000000-0000-0000-0000-000000000022', 'Sáng kiến cải tiến nâng cao hiệu quả công việc', 'Số lượng sáng kiến được đưa ra và áp dụng', 10, 3, 2, 'SL', 'WEEKLY', 'APPROVED', '20000000-0000-0000-0000-000000000011', NULL, NULL, NULL),
    ('30000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000033', 'e1000000-0000-0000-0000-000000000022', 'Cải thiện bản thân', 'Số lượng khóa học, sự kiện tham gia học hỏi bên ngoài', 10, 4, 2, 'SL', 'WEEKLY', 'APPROVED', '20000000-0000-0000-0000-000000000011', NULL, NULL, NULL),
    ('30000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000033', 'e1000000-0000-0000-0000-000000000022', 'Sự kiện thu hút truyền thông', 'Số sự kiện tổ chức online/offline', 10, 4, 3, 'SL', 'WEEKLY', 'APPROVED', '20000000-0000-0000-0000-000000000011', NULL, NULL, NULL),
    ('30000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000033', 'e1000000-0000-0000-0000-000000000022', 'Ấn phẩm: báo cáo, sách...', 'Số ấn phẩm phát hành trong năm', 10, 5, 4, 'SL', 'WEEKLY', 'APPROVED', '20000000-0000-0000-0000-000000000011', NULL, NULL, NULL),
    ('30000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000033', 'e1000000-0000-0000-0000-000000000022', 'Các hoạt động Marketing khác', 'Hoàn thành các công việc phát sinh khác', 10, 100, 100, '%', 'WEEKLY', 'APPROVED', '20000000-0000-0000-0000-000000000011', NULL, NULL, NULL);

INSERT INTO kpi_criteria_assignees (kpi_criteria_id, user_id) VALUES
    -- IT Assignments
    ('f1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000004'),
    ('f1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000004'),
    -- Marketing Assignments (Consolidated)
    ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000011'),
    ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000012'),
    ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000013'),
    ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000014'),
    ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000015'),
    ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000011'),
    ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000012'),
    ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000013'),
    ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000014'),
    ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000015'),
    ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000011'),
    ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000012'),
    ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000013'),
    ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000014'),
    ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000015'),
    ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000011'),
    ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000012'),
    ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000013'),
    ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000014'),
    ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000015'),
    ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000011'),
    ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000012'),
    ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000013'),
    ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000014'),
    ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000015'),
    ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000011'),
    ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000012'),
    ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000013'),
    ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000014'),
    ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000015'),
    ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000011'),
    ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000012'),
    ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000013'),
    ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000014'),
    ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000015'),
    ('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000011'),
    ('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000012'),
    ('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000013'),
    ('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000014'),
    ('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000015');
