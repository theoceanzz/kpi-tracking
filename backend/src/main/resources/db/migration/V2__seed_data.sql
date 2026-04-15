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
-- Sample Company
-- ====================================================
INSERT INTO organizations (id, name, code) VALUES 
    ('11111111-1111-1111-1111-111111111111', 'FPT Education', 'FPT');

-- ====================================================
-- Sample Org Units
-- ====================================================
-- Branch A
INSERT INTO org_units (id, name, organization_id, type)
VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Chi nhánh Hà Nội',
    '11111111-1111-1111-1111-111111111111',
    'branch'
);

-- Department IT
INSERT INTO org_units (id, name, parent_id, organization_id, type)
VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Phòng IT',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'department'
);

-- Department HR
INSERT INTO org_units (id, name, parent_id, organization_id, type)
VALUES (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'Phòng Nhân sự',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'department'
);

-- Team Backend
INSERT INTO org_units (id, name, parent_id, organization_id, type)
VALUES (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'Team Backend',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '11111111-1111-1111-1111-111111111111',
    'team'
);

INSERT INTO users (id, email, password, full_name, phone, status) VALUES
    ('d1000000-0000-0000-0000-000000000001',
     'director@demo.com', '$2a$12$Ab.ay.J8o0ExWqdKKXcpmuhU0Itfrn9eUa05wMQGmLh.nfPf5yD92',
     'Nguyễn Văn Director', '0901000001', 'ACTIVE'),

    ('d1000000-0000-0000-0000-000000000002',
     'head@demo.com', '$2a$12$Mzmf4O7Yqg3NZlHlBA8dt.WZKJRPp4KLU5Hd1YhyQWPYxzHpitZza',
     'Trần Thị Head', '0901000002', 'ACTIVE'),

    ('d1000000-0000-0000-0000-000000000003',
     'deputy@demo.com', '$2a$12$FLg.uqn4LZK9ooFgc12a5.iaH6sfH212mNiPc0Hjt8HaMA5Qh7nMy',
     'Lê Văn Deputy', '0901000003', 'ACTIVE'),

    ('d1000000-0000-0000-0000-000000000004',
     'staff@demo.com', '$2a$12$qI4LsOS.rbo/YoyRAJHUduh1PHiYw25CYssLvdV3hyhiN07EFV45G',
     'Phạm Thị Staff', '0901000004', 'ACTIVE');

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

-- ====================================================
-- Sample Permission
-- ====================================================
INSERT INTO permissions (id, code, resource, action) VALUES
('aa1aaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'KPI:VIEW', 'KPI', 'VIEW'),
('bb2bbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'KPI:CREATE', 'KPI', 'CREATE'),
('cc3ccccc-cccc-cccc-cccc-cccccccccccc', 'KPI:EDIT', 'KPI', 'EDIT'),
('dd4ddddd-dddd-dddd-dddd-dddddddddddd', 'KPI:APPROVE', 'KPI', 'APPROVE'),
('ee5eeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'USER:MANAGE', 'USER', 'MANAGE');

-- ====================================================
-- Sample Role Permissions
-- ====================================================
-- DIRECTOR: full quyền
INSERT INTO role_permissions VALUES
('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aa1aaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bb2bbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cc3ccccc-cccc-cccc-cccc-cccccccccccc'),
('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dd4ddddd-dddd-dddd-dddd-dddddddddddd'),
('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ee5eeeee-eeee-eeee-eeee-eeeeeeeeeeee');

-- HEAD
INSERT INTO role_permissions VALUES
('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aa1aaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bb2bbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'dd4ddddd-dddd-dddd-dddd-dddddddddddd');

-- DEPUTY
INSERT INTO role_permissions VALUES
('c3cccccc-cccc-cccc-cccc-cccccccccccc', 'aa1aaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
('c3cccccc-cccc-cccc-cccc-cccccccccccc', 'bb2bbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- STAFF
INSERT INTO role_permissions VALUES
('d4dddddd-dddd-dddd-dddd-dddddddddddd', 'aa1aaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- ====================================================
-- Sample Policy
-- ====================================================
-- Policy: Head chỉ approve trong phòng IT
INSERT INTO policies (id, org_unit_id, name, effect, resource, action)
VALUES (
'aaa1aaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
'Head approve KPI IT',
'ALLOW',
'KPI',
'APPROVE'
);

-- Policy: Staff không được approve
INSERT INTO policies (id, org_unit_id, name, effect, resource, action)
VALUES (
'bbb2bbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
'Deny staff approve',
'DENY',
'KPI',
'APPROVE'
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
('aaaaa1aa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'SELF'),
('bbbbb2bb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'NODE'),
('ccccc3cc-cccc-cccc-cccc-cccccccccccc', 'SUBTREE'),
('ddddd4dd-dddd-dddd-dddd-dddddddddddd', 'CUSTOM');

-- ====================================================
-- Sample Role Scopes
-- ====================================================
-- Director: toàn cây
INSERT INTO role_scopes VALUES
('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ccccc3cc-cccc-cccc-cccc-cccccccccccc');

-- Head: subtree
INSERT INTO role_scopes VALUES
('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ccccc3cc-cccc-cccc-cccc-cccccccccccc');

-- Deputy: node
INSERT INTO role_scopes VALUES
('c3cccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbb2bb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- Staff: self
INSERT INTO role_scopes VALUES
('d4dddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaa1aa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- ====================================================
-- Sample KPI Criteria
-- ====================================================
INSERT INTO kpi_criteria (id, org_unit_id, assigned_to, name, description, weight, target_value, unit,
                          frequency, status, created_by, approved_by, submitted_at, approved_at) VALUES
    ('f1000000-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'd1000000-0000-0000-0000-000000000004',
     'Doanh thu tháng', 'Đạt doanh thu tối thiểu hàng tháng', 30, 100000000, 'VND',
     'MONTHLY', 'APPROVED', 'd1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001',
     NOW(), NOW()),

    ('f1000000-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'd1000000-0000-0000-0000-000000000004',
     'Khách hàng mới', 'Số lượng khách hàng mới tiếp cận được', 20, 10, 'khách hàng',
     'MONTHLY', 'APPROVED', 'd1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001',
     NOW(), NOW()),

    ('f1000000-0000-0000-0000-000000000003','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL,
     'Tỷ lệ chốt đơn', 'Tỷ lệ chuyển đổi từ khách tiềm năng sang khách hàng', 25, 50, '%',
     'QUARTERLY', 'DRAFT', 'd1000000-0000-0000-0000-000000000002', NULL,
     NULL, NULL);
