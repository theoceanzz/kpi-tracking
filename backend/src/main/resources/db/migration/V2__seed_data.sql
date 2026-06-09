-- ============================================================================
-- V2: SEED DATA - COMPREHENSIVE INITIAL DATA
-- ============================================================================

-- 1. GEOGRAPHICAL DATA
-- ============================================================================
INSERT INTO provinces (id, name, code) VALUES
    ('a1000000-0000-0000-0000-000000000001', 'Hà Nội', 'HN'),
    ('a1000000-0000-0000-0000-000000000002', 'Hồ Chí Minh', 'HCM');

INSERT INTO districts (id, name, code, province_id) VALUES
    ('b1000000-0000-0000-0000-000000000001', 'Ba Đình',  'HN-BD',  'a1000000-0000-0000-0000-000000000001'),
    ('b1000000-0000-0000-0000-000000000006', 'Quận 1',   'HCM-Q1', 'a1000000-0000-0000-0000-000000000002');


-- 2. ORGANIZATIONAL STRUCTURE
-- ============================================================================

-- Organization
INSERT INTO organizations (id, name, code, evaluation_max_score, kpi_reminder_percentage, enable_okr) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Demo Company', 'DEMO1', 100.0, 50, TRUE);
-- Evaluation Levels
INSERT INTO evaluation_levels (organization_id, name, threshold, color) VALUES
    ('11111111-1111-1111-1111-111111111111', 'XUẤT SẮC',   90.0, '#10b981'),
    ('11111111-1111-1111-1111-111111111111', 'TỐT',        80.0, '#3b82f6'),
    ('11111111-1111-1111-1111-111111111111', 'KHÁ',        70.0, '#f59e0b'),
    ('11111111-1111-1111-1111-111111111111', 'TRUNG BÌNH', 50.0, '#6366f1'),
    ('11111111-1111-1111-1111-111111111111', 'YẾU',         0.0, '#ef4444');

-- Org Hierarchy Levels (3-tier: Chi nhánh → Phòng ban → Tổ/Nhóm)
-- level_order 0 = top (Công ty / Chi nhánh), role_level matches role.level
INSERT INTO org_hierarchy_levels (id, organization_id, level_order, unit_type_name, manager_role_label, role_level) VALUES
    ('21111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 0, 'Công ty', 'Giám đốc',2),
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 1, 'Phòng ban',  'Trưởng phòng',3),
    ('23333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 2, 'Nhóm',         'Trưởng nhóm',4);

-- Org Units
-- Note: path is set automatically by the trg_set_org_path trigger on INSERT
INSERT INTO org_units (id, name, code, parent_id, org_hierarchy_id, district_id, status) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Chi nhánh Hà Nội',   'HN-BRANCH',  NULL,                                     '21111111-1111-1111-1111-111111111111', 'b1000000-0000-0000-0000-000000000001', 'ACTIVE'),
    -- Phòng IT
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Phòng IT',           'IT-DEPT',    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'b1000000-0000-0000-0000-000000000001', 'ACTIVE'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Team Backend',       'BE-TEAM',    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '23333333-3333-3333-3333-333333333333', 'b1000000-0000-0000-0000-000000000001', 'ACTIVE'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Team Frontend',      'FE-TEAM',    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '23333333-3333-3333-3333-333333333333', 'b1000000-0000-0000-0000-000000000001', 'ACTIVE'),
    -- Phòng Truyền Thông
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Phòng Truyền Thông', 'COMM-DEPT',  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'b1000000-0000-0000-0000-000000000001', 'ACTIVE'),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Team Content',       'CONT-TEAM',  'cccccccc-cccc-cccc-cccc-cccccccccccc', '23333333-3333-3333-3333-333333333333', 'b1000000-0000-0000-0000-000000000001', 'ACTIVE'),
    ('abcdefab-cdef-cdef-cdef-abcdefabcdef', 'Team Design',        'DES-TEAM',   'cccccccc-cccc-cccc-cccc-cccccccccccc', '23333333-3333-3333-3333-333333333333', 'b1000000-0000-0000-0000-000000000001', 'ACTIVE');


-- 3. ROLES
-- ============================================================================
-- level 2 = Chi nhánh (top-level of this org), level 3 = Phòng ban, level 4 = Tổ/Nhóm
-- rank: 0=primary, 1=deputy, 2=staff
INSERT INTO roles (id, organization_id, name, level, rank, is_system) VALUES
    -- Level 2: Chi nhánh
    ('a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Giám đốc',     2, 0, false),
    ('a2aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', '11111111-1111-1111-1111-111111111111', 'Phó Giám đốc', 2, 1, false),

    -- Level 3: Phòng ban
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Trưởng phòng', 3, 0, false),
    ('c3cccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Phó phòng',    3, 1, false),

    -- Level 4: Tổ/Nhóm
    ('e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'Trưởng nhóm',  4, 0, false),
    ('e6eeeeee-eeee-eeee-eeee-eeeeeeeeeeef', '11111111-1111-1111-1111-111111111111', 'Phó nhóm',     4, 1, false),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'Nhân viên',    4, 2, false);


-- 4. PERMISSIONS
-- ============================================================================
INSERT INTO permissions (id, code, resource, action, description) VALUES
    -- Dashboard
    ('00000000-0000-0000-0000-000000000101', 'DASHBOARD:VIEW',           'DASHBOARD',    'VIEW',             'Xem biểu đồ thống kê'),
    -- Company
    ('00000000-0000-0000-0000-000000000102', 'COMPANY:VIEW',             'COMPANY',      'VIEW',             'Xem hồ sơ công ty'),
    ('00000000-0000-0000-0000-000000000205', 'COMPANY:UPDATE',           'COMPANY',      'UPDATE',           'Cập nhật thông tin tổ chức'),
    ('00000000-0000-0000-0000-000000000206', 'COMPANY:DELETE',           'COMPANY',      'DELETE',           'Xoá/Lưu trữ tổ chức'),
    -- Org
    ('00000000-0000-0000-0000-000000000103', 'ORG:VIEW',                 'ORG',          'VIEW',             'Xem sơ đồ tổ chức'),
    ('00000000-0000-0000-0000-000000000104', 'ORG:CREATE',               'ORG',          'CREATE',           'Tạo mới phòng ban'),
    ('00000000-0000-0000-0000-000000000105', 'ORG:UPDATE',               'ORG',          'UPDATE',           'Cập nhật phòng ban'),
    ('00000000-0000-0000-0000-000000000106', 'ORG:DELETE',               'ORG',          'DELETE',           'Xóa phòng ban'),
    ('00000000-0000-0000-0000-000000000238', 'ORG:VIEW_TREE',            'ORG',          'VIEW_TREE',        'Xem cây sơ đồ tổ chức (rút gọn)'),
    -- User
    ('00000000-0000-0000-0000-000000000107', 'USER:VIEW',                'USER',         'VIEW',             'Xem danh mục nhân sự'),
    ('00000000-0000-0000-0000-000000000108', 'USER:CREATE',              'USER',         'CREATE',           'Thêm mới nhân sự'),
    ('00000000-0000-0000-0000-000000000109', 'USER:UPDATE',              'USER',         'UPDATE',           'Sửa thông tin nhân sự'),
    ('00000000-0000-0000-0000-000000000110', 'USER:DELETE',              'USER',         'DELETE',           'Xóa nhân sự'),
    ('00000000-0000-0000-0000-000000000111', 'USER:IMPORT',              'USER',         'IMPORT',           'Nhập nhân sự hàng loạt'),
    ('00000000-0000-0000-0000-000000000236', 'USER:VIEW_LIST',           'USER',         'VIEW_LIST',        'Xem danh sách nhân sự rút gọn (cho Dashboard)'),
    -- Role
    ('00000000-0000-0000-0000-000000000112', 'ROLE:VIEW',                'ROLE',         'VIEW',             'Xem danh sách vai trò'),
    ('00000000-0000-0000-0000-000000000113', 'ROLE:ASSIGN',              'ROLE',         'ASSIGN',           'Gán quyền cho người dùng'),
    ('00000000-0000-0000-0000-000000000201', 'ROLE:CREATE',              'ROLE',         'CREATE',           'Tạo mới vai trò'),
    ('00000000-0000-0000-0000-000000000202', 'ROLE:UPDATE',              'ROLE',         'UPDATE',           'Chỉnh sửa vai trò'),
    ('00000000-0000-0000-0000-000000000203', 'ROLE:DELETE',              'ROLE',         'DELETE',           'Xoá vai trò'),
    -- Permission
    ('00000000-0000-0000-0000-000000000114', 'PERMISSION:EDIT',          'PERMISSION',   'EDIT',             'Thiết lập chi tiết quyền'),
    ('00000000-0000-0000-0000-000000000204', 'PERMISSION:VIEW',          'PERMISSION',   'VIEW',             'Xem danh sách quyền'),
    -- KPI
    ('00000000-0000-0000-0000-000000000115', 'KPI:VIEW',                 'KPI',          'VIEW',             'Xem danh mục KPI'),
    ('00000000-0000-0000-0000-000000000116', 'KPI:CREATE',               'KPI',          'CREATE',           'Thiết lập KPI'),
    ('00000000-0000-0000-0000-000000000117', 'KPI:UPDATE',               'KPI',          'UPDATE',           'Sửa chỉ tiêu KPI'),
    ('00000000-0000-0000-0000-000000000118', 'KPI:DELETE',               'KPI',          'DELETE',           'Xóa chỉ tiêu KPI'),
    ('00000000-0000-0000-0000-000000000119', 'KPI:APPROVE_CRITERIA',     'KPI',          'APPROVE_CRITERIA', 'Phê duyệt chỉ tiêu KPI'),
    ('00000000-0000-0000-0000-000000000132', 'KPI:APPROVE_ADJUSTMENT',   'KPI',          'APPROVE_ADJUSTMENT','Phê duyệt điều chỉnh KPI'),
    ('00000000-0000-0000-0000-000000000120', 'KPI:VIEW_MY',              'KPI',          'VIEW_MY',          'Xem KPI cá nhân'),
    ('00000000-0000-0000-0000-000000000211', 'KPI:IMPORT',               'KPI',          'IMPORT',           'Nhập KPI hàng loạt từ file'),
    ('00000000-0000-0000-0000-000000000212', 'KPI:SUBMIT',               'KPI',          'SUBMIT',           'Gửi KPI để phê duyệt'),
    ('00000000-0000-0000-0000-000000000213', 'KPI:REJECT',               'KPI',          'REJECT',           'Từ chối chỉ tiêu KPI'),
    -- KPI Period
    ('00000000-0000-0000-0000-000000000207', 'KPI_PERIOD:VIEW',          'KPI_PERIOD',   'VIEW',             'Xem danh sách kỳ đánh giá'),
    ('00000000-0000-0000-0000-000000000208', 'KPI_PERIOD:CREATE',        'KPI_PERIOD',   'CREATE',           'Tạo kỳ đánh giá'),
    ('00000000-0000-0000-0000-000000000209', 'KPI_PERIOD:UPDATE',        'KPI_PERIOD',   'UPDATE',           'Cập nhật kỳ đánh giá'),
    ('00000000-0000-0000-0000-000000000210', 'KPI_PERIOD:DELETE',        'KPI_PERIOD',   'DELETE',           'Xoá kỳ đánh giá'),
    -- Submission
    ('00000000-0000-0000-0000-000000000121', 'SUBMISSION:REVIEW',        'SUBMISSION',   'REVIEW',           'Duyệt bài nộp KPI'),
    ('00000000-0000-0000-0000-000000000127', 'SUBMISSION:REVIEW_KPI',    'SUBMISSION',   'REVIEW_KPI',       'Xem bài nộp KPI'),
    ('00000000-0000-0000-0000-000000000122', 'SUBMISSION:CREATE',        'SUBMISSION',   'CREATE',           'Nộp báo cáo KPI'),
    ('00000000-0000-0000-0000-000000000123', 'SUBMISSION:VIEW_MY',       'SUBMISSION',   'VIEW_MY',          'Xem lịch sử nộp báo cáo'),
    ('00000000-0000-0000-0000-000000000214', 'SUBMISSION:VIEW',          'SUBMISSION',   'VIEW',             'Xem tất cả bản nộp KPI'),
    ('00000000-0000-0000-0000-000000000215', 'SUBMISSION:DELETE',        'SUBMISSION',   'DELETE',           'Xoá bản nộp KPI'),
    ('00000000-0000-0000-0000-000000000216', 'SUBMISSION:UPDATE',        'SUBMISSION',   'UPDATE',           'Chỉnh sửa bản nộp KPI'),
    -- Evaluation
    ('00000000-0000-0000-0000-000000000124', 'EVALUATION:VIEW',          'EVALUATION',   'VIEW',             'Xem kết quả đánh giá'),
    ('00000000-0000-0000-0000-000000000125', 'EVALUATION:CREATE',        'EVALUATION',   'CREATE',           'Thực hiện đánh giá xếp loại'),
    ('00000000-0000-0000-0000-000000000217', 'EVALUATION:UPDATE',        'EVALUATION',   'UPDATE',           'Chỉnh sửa đánh giá'),
    ('00000000-0000-0000-0000-000000000218', 'EVALUATION:DELETE',        'EVALUATION',   'DELETE',           'Xoá đánh giá'),
    ('00000000-0000-0000-0000-000000000219', 'EVALUATION:VIEW_MY',       'EVALUATION',   'VIEW_MY',          'Xem đánh giá cá nhân'),
    -- Notification
    ('00000000-0000-0000-0000-000000000126', 'NOTIF:VIEW',               'NOTIFICATION', 'VIEW',             'Xem thông báo'),
    ('00000000-0000-0000-0000-000000000220', 'NOTIF:MANAGE',             'NOTIFICATION', 'MANAGE',           'Quản lý thông báo hệ thống'),
    -- AI
    ('00000000-0000-0000-0000-000000000221', 'AI:SUGGEST_KPI',           'AI',           'SUGGEST_KPI',      'Sử dụng AI gợi ý KPI'),
    -- Policy
    ('00000000-0000-0000-0000-000000000222', 'POLICY:VIEW',              'POLICY',       'VIEW',             'Xem chính sách bảo mật'),
    ('00000000-0000-0000-0000-000000000223', 'POLICY:CREATE',            'POLICY',       'CREATE',           'Tạo chính sách'),
    ('00000000-0000-0000-0000-000000000224', 'POLICY:UPDATE',            'POLICY',       'UPDATE',           'Cập nhật chính sách'),
    ('00000000-0000-0000-0000-000000000225', 'POLICY:DELETE',            'POLICY',       'DELETE',           'Xoá chính sách'),
    ('00000000-0000-0000-0000-000000000226', 'POLICY:ASSIGN',            'POLICY',       'ASSIGN',           'Gán chính sách cho vai trò'),
    -- Stats
    ('00000000-0000-0000-0000-000000000227', 'STATS:VIEW_ORG',           'STATS',        'VIEW_ORG',         'Xem thống kê theo phòng ban'),
    ('00000000-0000-0000-0000-000000000228', 'STATS:VIEW_EMPLOYEE',      'STATS',        'VIEW_EMPLOYEE',    'Xem thống kê nhân viên'),
    ('00000000-0000-0000-0000-000000000229', 'STATS:VIEW_MY',            'STATS',        'VIEW_MY',          'Xem tiến độ cá nhân'),
    -- System
    ('00000000-0000-0000-0000-000000000230', 'SYSTEM:ADMIN',             'SYSTEM',       'ADMIN',            'Quyền quản trị toàn hệ thống (bypass phạm vi đơn vị)'),
    -- User Role
    ('00000000-0000-0000-0000-000000000231', 'USER_ROLE:VIEW',           'USER_ROLE',    'VIEW',             'Xem gán vai trò người dùng'),
    ('00000000-0000-0000-0000-000000000232', 'USER_ROLE:ASSIGN',         'USER_ROLE',    'ASSIGN',           'Gán vai trò cho người dùng'),
    ('00000000-0000-0000-0000-000000000233', 'USER_ROLE:REVOKE',         'USER_ROLE',    'REVOKE',           'Thu hồi vai trò người dùng'),
    -- Attachment
    ('00000000-0000-0000-0000-000000000234', 'ATTACHMENT:UPLOAD',        'ATTACHMENT',   'UPLOAD',           'Upload tệp đính kèm'),
    ('00000000-0000-0000-0000-000000000235', 'ATTACHMENT:DELETE',        'ATTACHMENT',   'DELETE',           'Xoá tệp đính kèm'),
    -- Reminder
    ('00000000-0000-0000-0000-000000000237', 'REMINDER:SEND',            'REMINDER',     'SEND',             'Gửi thông báo nhắc nhở nhân viên'),
    -- Adjustment (used in PERSONAL_PERMS / UNIT_HEAD_PERSONAL_PERMS)
    ('00000000-0000-0000-0000-000000000239', 'ADJUSTMENT:VIEW_MY',       'ADJUSTMENT',   'VIEW_MY',          'Xem yêu cầu điều chỉnh cá nhân')
ON CONFLICT (code) DO NOTHING;


-- 5. ROLE PERMISSIONS
-- ============================================================================
-- Mapping follows RolePermissionConstants.java
--
-- tierLevel=1 (top of this 3-tier org = Chi nhánh = level 2)
--   director        → DIRECTOR_PERMS + SYSTEM_ONLY
--   deputy_director → DEPUTY_DIRECTOR_PERMS + SYSTEM_ONLY except SYSTEM:ADMIN
--
-- tierLevel=2 (Phòng ban = level 3)
--   manager  → MANAGER_PERMS  + UNIT_HEAD_PERSONAL_PERMS
--   deputy   → DEPUTY_PERMS   + PERSONAL_PERMS
--
-- tierLevel=3 (Tổ/Nhóm = level 4)
--   manager  → MANAGER_PERMS  + UNIT_HEAD_PERSONAL_PERMS  (Trưởng nhóm)
--   deputy   → DEPUTY_PERMS   + PERSONAL_PERMS             (Phó nhóm)
--   staff    → STAFF_PERMS    + PERSONAL_PERMS             (Nhân viên)

-- ----------------------------------------------------------------
-- Role: Giám đốc (director, tierLevel=1)
-- DIRECTOR_PERMS + SYSTEM_ONLY (SYSTEM:ADMIN, COMPANY:DELETE, ROLE:DELETE, POLICY:DELETE, PERMISSION:EDIT)
-- ----------------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id FROM permissions
WHERE code IN (
    -- DIRECTOR_PERMS
    'DASHBOARD:VIEW', 'COMPANY:VIEW', 'COMPANY:UPDATE',
    'ORG:VIEW', 'ORG:CREATE', 'ORG:UPDATE', 'ORG:DELETE',
    'USER:VIEW', 'USER:CREATE', 'USER:UPDATE', 'USER:DELETE', 'USER:IMPORT',
    'ROLE:VIEW', 'ROLE:ASSIGN', 'ROLE:CREATE', 'ROLE:UPDATE',
    'PERMISSION:VIEW',
    'KPI:VIEW', 'KPI:CREATE', 'KPI:UPDATE', 'KPI:DELETE', 'KPI:APPROVE_CRITERIA', 'KPI:APPROVE_ADJUSTMENT',
    'KPI:IMPORT', 'KPI:SUBMIT', 'KPI:REJECT',
    'SUBMISSION:REVIEW', 'SUBMISSION:VIEW', 'SUBMISSION:DELETE', 'SUBMISSION:UPDATE',
    'EVALUATION:VIEW', 'EVALUATION:CREATE', 'EVALUATION:UPDATE', 'EVALUATION:DELETE',
    'NOTIF:VIEW', 'NOTIF:MANAGE',
    'KPI_PERIOD:VIEW', 'KPI_PERIOD:CREATE', 'KPI_PERIOD:UPDATE', 'KPI_PERIOD:DELETE',
    'AI:SUGGEST_KPI',
    'POLICY:VIEW', 'POLICY:CREATE', 'POLICY:UPDATE', 'POLICY:ASSIGN',
    'STATS:VIEW_ORG', 'STATS:VIEW_EMPLOYEE',
    'USER_ROLE:VIEW', 'USER_ROLE:ASSIGN', 'USER_ROLE:REVOKE',
    'ATTACHMENT:UPLOAD', 'ATTACHMENT:DELETE',
    'REMINDER:SEND',
    -- SYSTEM_ONLY (isTopLevel=true, archetype=director → full SYSTEM_ONLY)
    'SYSTEM:ADMIN', 'COMPANY:DELETE', 'ROLE:DELETE', 'POLICY:DELETE', 'PERMISSION:EDIT'
)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------
-- Role: Phó Giám đốc (deputy_director, tierLevel=1)
-- DEPUTY_DIRECTOR_PERMS + SYSTEM_ONLY except SYSTEM:ADMIN
-- ----------------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'a2aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', id FROM permissions
WHERE code IN (
    -- DEPUTY_DIRECTOR_PERMS
    'DASHBOARD:VIEW', 'COMPANY:VIEW',
    'ORG:VIEW', 'ORG:CREATE', 'ORG:UPDATE',
    'USER:VIEW', 'USER:CREATE', 'USER:UPDATE', 'USER:IMPORT',
    'ROLE:VIEW', 'ROLE:ASSIGN', 'ROLE:CREATE', 'ROLE:UPDATE',
    'PERMISSION:VIEW',
    'KPI:VIEW', 'KPI:CREATE', 'KPI:UPDATE', 'KPI:APPROVE_CRITERIA', 'KPI:APPROVE_ADJUSTMENT',
    'KPI:IMPORT', 'KPI:SUBMIT', 'KPI:REJECT',
    'SUBMISSION:REVIEW', 'SUBMISSION:VIEW', 'SUBMISSION:UPDATE',
    'EVALUATION:VIEW', 'EVALUATION:CREATE', 'EVALUATION:UPDATE',
    'NOTIF:VIEW', 'NOTIF:MANAGE',
    'KPI_PERIOD:VIEW', 'KPI_PERIOD:CREATE', 'KPI_PERIOD:UPDATE',
    'AI:SUGGEST_KPI',
    'POLICY:VIEW', 'POLICY:CREATE', 'POLICY:UPDATE', 'POLICY:ASSIGN',
    'STATS:VIEW_ORG', 'STATS:VIEW_EMPLOYEE',
    'USER_ROLE:VIEW', 'USER_ROLE:ASSIGN',
    'ATTACHMENT:UPLOAD',
    'REMINDER:SEND',
    -- SYSTEM_ONLY without SYSTEM:ADMIN (isTopLevel=true, archetype=deputy_director)
    'COMPANY:DELETE', 'ROLE:DELETE', 'POLICY:DELETE', 'PERMISSION:EDIT'
)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------
-- Role: Trưởng phòng (manager, tierLevel=2)
-- MANAGER_PERMS + UNIT_HEAD_PERSONAL_PERMS
-- UNIT_HEAD_PERSONAL_PERMS = KPI:VIEW_MY, SUBMISSION:VIEW_MY, STATS:VIEW_MY, ADJUSTMENT:VIEW_MY
-- ----------------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', id FROM permissions
WHERE code IN (
    -- MANAGER_PERMS
    'DASHBOARD:VIEW',
    'ORG:VIEW_TREE',
    'USER:VIEW_LIST',
    'KPI:VIEW', 'KPI:CREATE', 'KPI:UPDATE', 'KPI:DELETE', 'KPI:APPROVE_CRITERIA', 'KPI:APPROVE_ADJUSTMENT',
    'KPI:IMPORT', 'KPI:SUBMIT', 'KPI:REJECT',
    'SUBMISSION:VIEW', 'SUBMISSION:REVIEW', 'SUBMISSION:REVIEW_KPI',
    'EVALUATION:VIEW', 'EVALUATION:CREATE',
    'NOTIF:VIEW', 'KPI_PERIOD:VIEW',
    'AI:SUGGEST_KPI',
    'STATS:VIEW_EMPLOYEE',
    'ATTACHMENT:UPLOAD',
    'REMINDER:SEND',
    -- UNIT_HEAD_PERSONAL_PERMS
    'KPI:VIEW_MY', 'SUBMISSION:VIEW_MY', 'STATS:VIEW_MY', 'ADJUSTMENT:VIEW_MY'
)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------
-- Role: Phó phòng (deputy, tierLevel=2)
-- DEPUTY_PERMS + PERSONAL_PERMS
-- PERSONAL_PERMS = KPI:VIEW_MY, SUBMISSION:VIEW_MY, EVALUATION:VIEW_MY, STATS:VIEW_MY, ADJUSTMENT:VIEW_MY
-- ----------------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'c3cccccc-cccc-cccc-cccc-cccccccccccc', id FROM permissions
WHERE code IN (
    -- DEPUTY_PERMS
    'DASHBOARD:VIEW',
    'ORG:VIEW_TREE',
    'USER:VIEW_LIST',
    'KPI:VIEW', 'KPI:CREATE','KPI:UPDATE', 'KPI:DELETE', 'KPI:IMPORT', 'KPI:SUBMIT', 'KPI:REJECT',
    'SUBMISSION:VIEW', 'SUBMISSION:REVIEW_KPI',
    'EVALUATION:VIEW', 'EVALUATION:CREATE',
    'NOTIF:VIEW', 'KPI_PERIOD:VIEW',
    'AI:SUGGEST_KPI',
    'STATS:VIEW_EMPLOYEE',
    'ATTACHMENT:UPLOAD',
    'REMINDER:SEND',
    -- PERSONAL_PERMS
    'KPI:VIEW_MY', 'SUBMISSION:VIEW_MY', 'EVALUATION:VIEW_MY', 'STATS:VIEW_MY', 'ADJUSTMENT:VIEW_MY'
)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------
-- Role: Trưởng nhóm (manager, tierLevel=3)
-- MANAGER_PERMS + UNIT_HEAD_PERSONAL_PERMS
-- ----------------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', id FROM permissions
WHERE code IN (
    -- MANAGER_PERMS
    'DASHBOARD:VIEW',
    'ORG:VIEW_TREE',
    'USER:VIEW_LIST',
    'KPI:VIEW', 'KPI:CREATE', 'KPI:UPDATE', 'KPI:DELETE', 'KPI:APPROVE_CRITERIA', 'KPI:APPROVE_ADJUSTMENT',
    'KPI:IMPORT', 'KPI:SUBMIT', 'KPI:REJECT',
    'SUBMISSION:VIEW', 'SUBMISSION:REVIEW', 'SUBMISSION:REVIEW_KPI',
    'EVALUATION:VIEW', 'EVALUATION:CREATE',
    'NOTIF:VIEW', 'KPI_PERIOD:VIEW',
    'AI:SUGGEST_KPI',
    'STATS:VIEW_EMPLOYEE',
    'ATTACHMENT:UPLOAD',
    'REMINDER:SEND',
    -- UNIT_HEAD_PERSONAL_PERMS
    'KPI:VIEW_MY', 'SUBMISSION:VIEW_MY', 'STATS:VIEW_MY', 'ADJUSTMENT:VIEW_MY'
)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------
-- Role: Phó nhóm (deputy, tierLevel=3)
-- DEPUTY_PERMS + PERSONAL_PERMS
-- ----------------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e6eeeeee-eeee-eeee-eeee-eeeeeeeeeeef', id FROM permissions
WHERE code IN (
    -- DEPUTY_PERMS
    'DASHBOARD:VIEW',
    'ORG:VIEW_TREE',
    'USER:VIEW_LIST',
    'KPI:VIEW', 'KPI:CREATE','KPI:UPDATE', 'KPI:DELETE', 'KPI:IMPORT', 'KPI:SUBMIT', 'KPI:REJECT',
    'SUBMISSION:VIEW', 'SUBMISSION:REVIEW_KPI',
    'EVALUATION:VIEW', 'EVALUATION:CREATE',
    'NOTIF:VIEW', 'KPI_PERIOD:VIEW',
    'AI:SUGGEST_KPI',
    'STATS:VIEW_EMPLOYEE',
    'ATTACHMENT:UPLOAD',
    'REMINDER:SEND',
    -- PERSONAL_PERMS
    'KPI:VIEW_MY', 'SUBMISSION:VIEW_MY', 'EVALUATION:VIEW_MY', 'STATS:VIEW_MY', 'ADJUSTMENT:VIEW_MY'
)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------
-- Role: Nhân viên (staff, tierLevel=3)
-- STAFF_PERMS + PERSONAL_PERMS
-- ----------------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'd4dddddd-dddd-dddd-dddd-dddddddddddd', id FROM permissions
WHERE code IN (
    -- STAFF_PERMS
    'DASHBOARD:VIEW',
    'KPI:VIEW', 'KPI:CREATE','KPI:UPDATE', 'KPI:DELETE', 'KPI:IMPORT', 'KPI:SUBMIT',
    'SUBMISSION:CREATE',
    'EVALUATION:VIEW', 'EVALUATION:CREATE',
    'NOTIF:VIEW', 'KPI_PERIOD:VIEW',
    'ATTACHMENT:UPLOAD',
    -- PERSONAL_PERMS
    'KPI:VIEW_MY', 'SUBMISSION:VIEW_MY', 'EVALUATION:VIEW_MY', 'STATS:VIEW_MY', 'ADJUSTMENT:VIEW_MY'
)
ON CONFLICT DO NOTHING;


-- 6. SECURITY POLICIES (ABAC)
-- ============================================================================
INSERT INTO scopes (id, code) VALUES
    ('00000000-0000-0000-0000-000000000001', 'NODE'),
    ('00000000-0000-0000-0000-000000000002', 'SUBTREE'),
    ('00000000-0000-0000-0000-000000000003', 'CUSTOM');

INSERT INTO policies (id, org_unit_id, name, effect) VALUES
    ('11111111-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'IT Department Management Policy', 'ALLOW'),
    ('11111111-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Deny staff approval actions',     'DENY');

INSERT INTO policy_conditions (policy_id, type, condition_json) VALUES
    ('11111111-0000-0000-0000-000000000001', 'ORG_UNIT',  '{"scope": "SUBTREE"}'),
    ('11111111-0000-0000-0000-000000000002', 'ATTRIBUTE', '{"role": "STAFF"}');

INSERT INTO role_policies (role_id, policy_id) VALUES
    ('b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-0000-0000-0000-000000000001'),
    ('d4dddddd-dddd-dddd-dddd-dddddddddddd', '11111111-0000-0000-0000-000000000002');


-- 7. USERS
-- ============================================================================
-- Passwords Demo123@
INSERT INTO users (id, email, password, full_name, employee_code, phone, status, is_email_verified, has_seen_onboarding) VALUES
    -- Chi nhánh (level 2)
    ('22222222-0000-0000-0000-000000000100', 'director@demo.com',      '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q', 'Nguyễn Văn Director',   'EM001', '0901000001', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000000200', 'deputy.dir@demo.com',    '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q', 'Trần Thị Deputy Dir',   'EM002', '0901000002', 'ACTIVE', true, false),
    -- Phòng IT (level 3)
    ('22222222-0000-0000-0000-000000000101', 'head@demo.com',          '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q', 'Lê Văn Head',           'EM003', '0901000003', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000000102', 'deputy@demo.com',        '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q', 'Phạm Thị Deputy',       'EM004', '0901000004', 'ACTIVE', true, false),
    -- Team Backend (level 4)
    ('22222222-0000-0000-0000-000000000300', 'teamlead@demo.com',      '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q', 'Hoàng Văn TeamLead',    'EM005', '0901000005', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000000301', 'deputy.lead@demo.com',   '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q', 'Vũ Thị Deputy Lead',    'EM006', '0901000006', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000000103', 'staff@demo.com',         '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q', 'Phạm Thị Staff',        'EM007', '0901000007', 'ACTIVE', true, false),
    -- Team Frontend (level 4)
    ('22222222-0000-0000-0000-000000000400', 'fe.teamlead@demo.com',   '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q', 'Đinh Văn FE Lead',      'EM008', '0901000008', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000000401', 'fe.deputy@demo.com',     '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q', 'Ngô Thị FE Deputy',     'EM009', '0901000009', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000000402', 'fe.staff@demo.com',      '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q', 'Bùi Văn FE Staff',      'EM010', '0901000010', 'ACTIVE', true, false),
    -- Phòng Truyền Thông (level 3)
    ('22222222-0000-0000-0000-000000000500', 'comm.head@demo.com',     '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q', 'Trịnh Văn Comm Head',   'EM011', '0901000011', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000000501', 'comm.deputy@demo.com',   '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q', 'Lý Thị Comm Deputy',    'EM012', '0901000012', 'ACTIVE', true, false),
    -- Team Content (level 4)
    ('22222222-0000-0000-0000-000000000600', 'cont.teamlead@demo.com', '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q', 'Mai Văn Cont Lead',     'EM013', '0901000013', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000000601', 'cont.deputy@demo.com',   '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q', 'Đỗ Thị Cont Deputy',    'EM014', '0901000014', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000000602', 'cont.staff@demo.com',    '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q', 'Phan Văn Cont Staff',   'EM015', '0901000015', 'ACTIVE', true, false),
    -- Team Design (level 4)
    ('22222222-0000-0000-0000-000000000700', 'des.teamlead@demo.com',  '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q', 'Cao Văn Des Lead',      'EM016', '0901000016', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000000701', 'des.deputy@demo.com',    '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q', 'Tô Thị Des Deputy',     'EM017', '0901000017', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000000702', 'des.staff@demo.com',     '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q', 'Dương Văn Des Staff',   'EM018', '0901000018', 'ACTIVE', true, false);


-- 8. USER → ROLE → ORG UNIT ASSIGNMENTS
-- ============================================================================
INSERT INTO user_role_org_units (user_id, role_id, org_unit_id) VALUES
    -- Chi nhánh Hà Nội
    ('22222222-0000-0000-0000-000000000100', 'a1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),  -- Giám đốc    @ Chi nhánh HN
    ('22222222-0000-0000-0000-000000000200', 'a2aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),  -- Phó GĐ      @ Chi nhánh HN
    -- Phòng IT
    ('22222222-0000-0000-0000-000000000101', 'b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),  -- Trưởng phòng @ Phòng IT
    ('22222222-0000-0000-0000-000000000102', 'c3cccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),  -- Phó phòng    @ Phòng IT
    -- Team Backend
    ('22222222-0000-0000-0000-000000000300', 'e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'dddddddd-dddd-dddd-dddd-dddddddddddd'),  -- Trưởng nhóm @ Team Backend
    ('22222222-0000-0000-0000-000000000301', 'e6eeeeee-eeee-eeee-eeee-eeeeeeeeeeef', 'dddddddd-dddd-dddd-dddd-dddddddddddd'),  -- Phó nhóm    @ Team Backend
    ('22222222-0000-0000-0000-000000000103', 'd4dddddd-dddd-dddd-dddd-dddddddddddd', 'dddddddd-dddd-dddd-dddd-dddddddddddd'),  -- Nhân viên   @ Team Backend
    -- Team Frontend
    ('22222222-0000-0000-0000-000000000400', 'e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),  -- Trưởng nhóm @ Team Frontend
    ('22222222-0000-0000-0000-000000000401', 'e6eeeeee-eeee-eeee-eeee-eeeeeeeeeeef', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),  -- Phó nhóm    @ Team Frontend
    ('22222222-0000-0000-0000-000000000402', 'd4dddddd-dddd-dddd-dddd-dddddddddddd', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),  -- Nhân viên   @ Team Frontend
    -- Phòng Truyền Thông
    ('22222222-0000-0000-0000-000000000500', 'b2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc'),  -- Trưởng phòng @ Phòng Truyền Thông
    ('22222222-0000-0000-0000-000000000501', 'c3cccccc-cccc-cccc-cccc-cccccccccccc', 'cccccccc-cccc-cccc-cccc-cccccccccccc'),  -- Phó phòng    @ Phòng Truyền Thông
    -- Team Content
    ('22222222-0000-0000-0000-000000000600', 'e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'ffffffff-ffff-ffff-ffff-ffffffffffff'),  -- Trưởng nhóm @ Team Content
    ('22222222-0000-0000-0000-000000000601', 'e6eeeeee-eeee-eeee-eeee-eeeeeeeeeeef', 'ffffffff-ffff-ffff-ffff-ffffffffffff'),  -- Phó nhóm    @ Team Content
    ('22222222-0000-0000-0000-000000000602', 'd4dddddd-dddd-dddd-dddd-dddddddddddd', 'ffffffff-ffff-ffff-ffff-ffffffffffff'),  -- Nhân viên   @ Team Content
    -- Team Design
    ('22222222-0000-0000-0000-000000000700', 'e5eeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'abcdefab-cdef-cdef-cdef-abcdefabcdef'),  -- Trưởng nhóm @ Team Design
    ('22222222-0000-0000-0000-000000000701', 'e6eeeeee-eeee-eeee-eeee-eeeeeeeeeeef', 'abcdefab-cdef-cdef-cdef-abcdefabcdef'),  -- Phó nhóm    @ Team Design
    ('22222222-0000-0000-0000-000000000702', 'd4dddddd-dddd-dddd-dddd-dddddddddddd', 'abcdefab-cdef-cdef-cdef-abcdefabcdef'); -- Nhân viên   @ Team Design


-- ============================================================
-- V2 SEED: SECTIONS 9 & 10  (generated)
-- Periods: T4/T5/T6 2026 | 6 units × 2 KPI | 18 evaluations×3
-- ============================================================

INSERT INTO objectives
    (id, organization_id, org_unit_id, code, name, description, start_date, end_date, status)
VALUES
    -- Phòng IT
    ('0b000001-0000-0000-0000-000000000001',
     '11111111-1111-1111-1111-111111111111',
     'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     'OBJ-IT-Q2-2026',
     'Nâng cao chất lượng sản phẩm IT trong Q2/2026',
     'Đảm bảo team IT hoàn thành sprint đúng tiến độ, kiểm soát tỉ lệ bug ở mức thấp nhất',
     '2026-04-01', '2026-06-30', 'ACTIVE'),
 
    -- Phòng Truyền Thông
    ('0b000002-0000-0000-0000-000000000002',
     '11111111-1111-1111-1111-111111111111',
     'cccccccc-cccc-cccc-cccc-cccccccccccc',
     'OBJ-COMM-Q2-2026',
     'Tăng trưởng độ phủ và tương tác truyền thông Q2/2026',
     'Mở rộng nội dung đa kênh, tối ưu tương tác người dùng trên các nền tảng',
     '2026-04-01', '2026-06-30', 'ACTIVE'),
 
    -- Team Backend
    ('0b000003-0000-0000-0000-000000000003',
     '11111111-1111-1111-1111-111111111111',
     'dddddddd-dddd-dddd-dddd-dddddddddddd',
     'OBJ-BE-Q2-2026',
     'Hoàn thiện hệ thống API và nâng cao chất lượng code Q2/2026',
     'Đảm bảo API ổn định, review code đúng SLA và giảm thiểu technical debt',
     '2026-04-01', '2026-06-30', 'ACTIVE'),
 
    -- Team Frontend
    ('0b000004-0000-0000-0000-000000000004',
     '11111111-1111-1111-1111-111111111111',
     'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
     'OBJ-FE-Q2-2026',
     'Cải thiện UX và hiệu năng giao diện Q2/2026',
     'Hoàn thành các màn hình đúng tiến độ, duy trì điểm Lighthouse Performance ở mức cao',
     '2026-04-01', '2026-06-30', 'ACTIVE'),
 
    -- Team Content
    ('0b000005-0000-0000-0000-000000000005',
     '11111111-1111-1111-1111-111111111111',
     'ffffffff-ffff-ffff-ffff-ffffffffffff',
     'OBJ-CONT-Q2-2026',
     'Sản xuất nội dung chất lượng cao và đúng hạn Q2/2026',
     'Tăng sản lượng bài viết, nâng tỉ lệ bài đúng deadline biên tập',
     '2026-04-01', '2026-06-30', 'ACTIVE'),
 
    -- Team Design
    ('0b000006-0000-0000-0000-000000000006',
     '11111111-1111-1111-1111-111111111111',
     'abcdefab-cdef-cdef-cdef-abcdefabcdef',
     'OBJ-DES-Q2-2026',
     'Nâng cao năng suất và chất lượng thiết kế Q2/2026',
     'Tối ưu quy trình thiết kế, giảm số lần revise và tăng sản lượng asset',
     '2026-04-01', '2026-06-30', 'ACTIVE');
 
INSERT INTO key_results
    (id, objective_id, code, name, description, target_value, current_value, unit)
VALUES
    -- Phòng IT
    ('0c000001-0000-0000-0000-000000000001',
     '0b000001-0000-0000-0000-000000000001',
     'KR-IT-01', 'Hoàn thành ≥ 50 task/tháng trong cả Q2',
     'Trung bình số task hoàn thành sprint ≥ 50 task/tháng trong Q2',
     150, 0, 'task'),
 
    ('0c000002-0000-0000-0000-000000000002',
     '0b000001-0000-0000-0000-000000000001',
     'KR-IT-02', 'Duy trì tỉ lệ bug ≤ 5% trong Q2',
     'Tỉ lệ bug/feature trung bình không vượt 5% trong toàn Q2',
     5, 0, '%'),
 
    -- Phòng Truyền Thông
    ('0c000003-0000-0000-0000-000000000003',
     '0b000002-0000-0000-0000-000000000002',
     'KR-COMM-01', 'Đăng ≥ 30 bài/tháng trên các kênh',
     'Duy trì tần suất đăng bài ≥ 30 bài/tháng xuyên suốt Q2',
     90, 0, 'bài'),
 
    ('0c000004-0000-0000-0000-000000000004',
     '0b000002-0000-0000-0000-000000000002',
     'KR-COMM-02', 'Đạt ≥ 5.000 lượt tương tác/tháng',
     'Tổng lượt like/share/comment ≥ 5.000 mỗi tháng trong Q2',
     15000, 0, 'lượt'),
 
    -- Team Backend
    ('0c000005-0000-0000-0000-000000000005',
     '0b000003-0000-0000-0000-000000000003',
     'KR-BE-01', 'Hoàn thành ≥ 20 API endpoint/tháng pass test',
     'Số API endpoint hoàn thành và pass automated test ≥ 20/tháng',
     60, 0, 'endpoint'),
 
    ('0c000006-0000-0000-0000-000000000006',
     '0b000003-0000-0000-0000-000000000003',
     'KR-BE-02', 'Review ≥ 30 PR đúng SLA mỗi tháng',
     'Số pull request được review và merge trong SLA ≥ 30/tháng',
     90, 0, 'PR'),
 
    -- Team Frontend
    ('0c000007-0000-0000-0000-000000000007',
     '0b000004-0000-0000-0000-000000000004',
     'KR-FE-01', 'Hoàn thành ≥ 15 màn hình pass QA/tháng',
     'Số UI screen hoàn thành và pass QA ≥ 15/tháng trong Q2',
     45, 0, 'màn hình'),
 
    ('0c000008-0000-0000-0000-000000000008',
     '0b000004-0000-0000-0000-000000000004',
     'KR-FE-02', 'Điểm Lighthouse Performance trung bình ≥ 85',
     'Trung bình điểm Lighthouse Performance của toàn bộ page ≥ 85 điểm',
     85, 0, 'điểm'),
 
    -- Team Content
    ('0c000009-0000-0000-0000-000000000009',
     '0b000005-0000-0000-0000-000000000005',
     'KR-CONT-01', 'Sản xuất ≥ 20 bài viết/tháng',
     'Số bài viết content hoàn thành và đăng ≥ 20 bài/tháng',
     60, 0, 'bài'),
 
    ('0c000010-0000-0000-0000-000000000010',
     '0b000005-0000-0000-0000-000000000005',
     'KR-CONT-02', 'Tỉ lệ bài đúng hạn ≥ 90%',
     'Tỉ lệ bài nộp đúng deadline biên tập đạt ≥ 90% mỗi tháng',
     90, 0, '%'),
 
    -- Team Design
    ('0c000011-0000-0000-0000-000000000011',
     '0b000006-0000-0000-0000-000000000006',
     'KR-DES-01', 'Hoàn thành ≥ 25 asset thiết kế/tháng',
     'Số banner/infographic hoàn thành và được duyệt ≥ 25/tháng',
     75, 0, 'asset'),
 
    ('0c000012-0000-0000-0000-000000000012',
     '0b000006-0000-0000-0000-000000000006',
     'KR-DES-02', 'Tỉ lệ asset duyệt trong ≤ 2 lần revise ≥ 80%',
     'Tỉ lệ asset được duyệt trong tối đa 2 lần sửa ≥ 80%',
     80, 0, '%');
 

-- ============================================================
-- 9A. KPI PERIODS
-- ============================================================
INSERT INTO kpi_periods (id, organization_id, name, period_type, start_date, end_date, notification_date) VALUES
    ('33333333-0000-0000-0000-000000000104', '11111111-1111-1111-1111-111111111111',
     'Tháng 4/2026', 'MONTHLY',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07', '2026-04-15 00:00:00+07'),
    ('33333333-0000-0000-0000-000000000105', '11111111-1111-1111-1111-111111111111',
     'Tháng 5/2026', 'MONTHLY',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07', '2026-05-15 00:00:00+07'),
    ('33333333-0000-0000-0000-000000000106', '11111111-1111-1111-1111-111111111111',
     'Tháng 6/2026', 'MONTHLY',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07', '2026-06-15 00:00:00+07');
 
-- ============================================================
-- 9B. KPI CRITERIA  (6 units × 2 KPI × 3 periods = 36 rows)
-- ============================================================
INSERT INTO kpi_criteria
    (id, org_unit_id, kpi_period_id, name, description, weight,
     target_value, minimum_value, unit, frequency, status,
     key_result_id,
     created_by, approved_by, submitted_at, approved_at)
VALUES
    -- ── Phòng IT ────────────────────────────────────────────
    ('9f4187ab-d4bd-4a73-a21a-eff99273dd27', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-0000-0000-0000-000000000104',
     'Số task hoàn thành', 'Hoàn thành task trong sprint', 50,
     50, 35, 'task', 'MONTHLY', 'APPROVED',
     '0c000001-0000-0000-0000-000000000001',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-04-02 08:00:00+07', '2026-04-03 08:00:00+07'),
 
    ('7924184d-c084-44a1-ae37-3c6b61d518fc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-0000-0000-0000-000000000104',
     'Tỉ lệ bug', 'Tỉ lệ bug/feature không vượt ngưỡng', 50,
     5, 10, '%', 'MONTHLY', 'APPROVED',
     '0c000002-0000-0000-0000-000000000002',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-04-02 08:00:00+07', '2026-04-03 08:00:00+07'),
 
    ('1af7d756-973d-4680-bca0-de8e20b5c6f7', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-0000-0000-0000-000000000105',
     'Số task hoàn thành', 'Hoàn thành task trong sprint', 50,
     50, 35, 'task', 'MONTHLY', 'APPROVED',
     '0c000001-0000-0000-0000-000000000001',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-05-02 08:00:00+07', '2026-05-03 08:00:00+07'),
 
    ('a536373a-4a01-4b25-b8f9-15c7cd479c94', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-0000-0000-0000-000000000105',
     'Tỉ lệ bug', 'Tỉ lệ bug/feature không vượt ngưỡng', 50,
     5, 10, '%', 'MONTHLY', 'APPROVED',
     '0c000002-0000-0000-0000-000000000002',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-05-02 08:00:00+07', '2026-05-03 08:00:00+07'),
 
    ('0888dfd5-b2c6-41ea-b925-b1b73e45dc85', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-0000-0000-0000-000000000106',
     'Số task hoàn thành', 'Hoàn thành task trong sprint', 50,
     50, 35, 'task', 'MONTHLY', 'APPROVED',
     '0c000001-0000-0000-0000-000000000001',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-06-02 08:00:00+07', '2026-06-03 08:00:00+07'),
 
    ('9e2395d5-e706-4643-bb5c-1fa5d4d829db', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-0000-0000-0000-000000000106',
     'Tỉ lệ bug', 'Tỉ lệ bug/feature không vượt ngưỡng', 50,
     5, 10, '%', 'MONTHLY', 'APPROVED',
     '0c000002-0000-0000-0000-000000000002',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-06-02 08:00:00+07', '2026-06-03 08:00:00+07'),
 
    -- ── Phòng Truyền Thông ──────────────────────────────────
    ('ce79b3ee-d13c-443c-a838-019784af9c82', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-0000-0000-0000-000000000104',
     'Số bài đăng', 'Số bài đăng trên các kênh truyền thông', 50,
     30, 20, 'bài', 'MONTHLY', 'APPROVED',
     '0c000003-0000-0000-0000-000000000003',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-04-02 08:00:00+07', '2026-04-03 08:00:00+07'),
 
    ('577305f2-af2b-4e4b-b695-babda1ee0695', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-0000-0000-0000-000000000104',
     'Lượt tương tác', 'Tổng lượt like/share/comment', 50,
     5000, 3000, 'lượt', 'MONTHLY', 'APPROVED',
     '0c000004-0000-0000-0000-000000000004',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-04-02 08:00:00+07', '2026-04-03 08:00:00+07'),
 
    ('843fc0ed-4784-414d-a09e-0ad177c651e9', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-0000-0000-0000-000000000105',
     'Số bài đăng', 'Số bài đăng trên các kênh truyền thông', 50,
     30, 20, 'bài', 'MONTHLY', 'APPROVED',
     '0c000003-0000-0000-0000-000000000003',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-05-02 08:00:00+07', '2026-05-03 08:00:00+07'),
 
    ('d04e377f-7c67-42d7-9986-620c6ea83f09', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-0000-0000-0000-000000000105',
     'Lượt tương tác', 'Tổng lượt like/share/comment', 50,
     5000, 3000, 'lượt', 'MONTHLY', 'APPROVED',
     '0c000004-0000-0000-0000-000000000004',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-05-02 08:00:00+07', '2026-05-03 08:00:00+07'),
 
    ('b98cd2b1-2f7a-4b74-8f43-7510f06fad00', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-0000-0000-0000-000000000106',
     'Số bài đăng', 'Số bài đăng trên các kênh truyền thông', 50,
     30, 20, 'bài', 'MONTHLY', 'APPROVED',
     '0c000003-0000-0000-0000-000000000003',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-06-02 08:00:00+07', '2026-06-03 08:00:00+07'),
 
    ('a357baae-1005-4f1b-8eba-0670a20a0055', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-0000-0000-0000-000000000106',
     'Lượt tương tác', 'Tổng lượt like/share/comment', 50,
     5000, 3000, 'lượt', 'MONTHLY', 'APPROVED',
     '0c000004-0000-0000-0000-000000000004',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-06-02 08:00:00+07', '2026-06-03 08:00:00+07'),
 
    -- ── Team Backend ────────────────────────────────────────
    ('21f3bb63-11a3-40c3-9395-176c0bd74583', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '33333333-0000-0000-0000-000000000104',
     'API hoàn thành', 'Số API endpoint hoàn thành và pass test', 50,
     20, 12, 'endpoint', 'MONTHLY', 'APPROVED',
     '0c000005-0000-0000-0000-000000000005',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-04-02 08:00:00+07', '2026-04-03 08:00:00+07'),
 
    ('57de5627-31cb-4299-87c3-d370f0a00a10', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '33333333-0000-0000-0000-000000000104',
     'Code review', 'Số PR được review đúng SLA', 50,
     30, 20, 'PR', 'MONTHLY', 'APPROVED',
     '0c000006-0000-0000-0000-000000000006',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-04-02 08:00:00+07', '2026-04-03 08:00:00+07'),
 
    ('0bbdca82-a6d6-46dd-a4ad-48062d9353b0', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '33333333-0000-0000-0000-000000000105',
     'API hoàn thành', 'Số API endpoint hoàn thành và pass test', 50,
     20, 12, 'endpoint', 'MONTHLY', 'APPROVED',
     '0c000005-0000-0000-0000-000000000005',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-05-02 08:00:00+07', '2026-05-03 08:00:00+07'),
 
    ('f15a537e-4f63-4947-a750-ec62ab53c51e', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '33333333-0000-0000-0000-000000000105',
     'Code review', 'Số PR được review đúng SLA', 50,
     30, 20, 'PR', 'MONTHLY', 'APPROVED',
     '0c000006-0000-0000-0000-000000000006',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-05-02 08:00:00+07', '2026-05-03 08:00:00+07'),
 
    ('3daf855a-72f5-4941-aa42-37d13a1440f1', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '33333333-0000-0000-0000-000000000106',
     'API hoàn thành', 'Số API endpoint hoàn thành và pass test', 50,
     20, 12, 'endpoint', 'MONTHLY', 'APPROVED',
     '0c000005-0000-0000-0000-000000000005',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-06-02 08:00:00+07', '2026-06-03 08:00:00+07'),
 
    ('ba7db630-5356-45fd-a201-c60efdd1c252', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '33333333-0000-0000-0000-000000000106',
     'Code review', 'Số PR được review đúng SLA', 50,
     30, 20, 'PR', 'MONTHLY', 'APPROVED',
     '0c000006-0000-0000-0000-000000000006',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-06-02 08:00:00+07', '2026-06-03 08:00:00+07'),
 
    -- ── Team Frontend ───────────────────────────────────────
    ('98501d33-c8f4-4fae-a5fe-804dc17f48d5', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '33333333-0000-0000-0000-000000000104',
     'Số màn hình hoàn thành', 'Số UI screen hoàn thành và pass QA', 50,
     15, 10, 'màn hình', 'MONTHLY', 'APPROVED',
     '0c000007-0000-0000-0000-000000000007',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-04-02 08:00:00+07', '2026-04-03 08:00:00+07'),
 
    ('3271fa4b-0d70-4d21-895a-1e3435973010', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '33333333-0000-0000-0000-000000000104',
     'Điểm Lighthouse', 'Điểm trung bình Lighthouse Performance', 50,
     85, 70, 'điểm', 'MONTHLY', 'APPROVED',
     '0c000008-0000-0000-0000-000000000008',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-04-02 08:00:00+07', '2026-04-03 08:00:00+07'),
 
    ('6a6b79a4-dc6f-48c3-91df-730aaa25242c', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '33333333-0000-0000-0000-000000000105',
     'Số màn hình hoàn thành', 'Số UI screen hoàn thành và pass QA', 50,
     15, 10, 'màn hình', 'MONTHLY', 'APPROVED',
     '0c000007-0000-0000-0000-000000000007',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-05-02 08:00:00+07', '2026-05-03 08:00:00+07'),
 
    ('f2b49ab6-4214-4309-921e-7f039e9109a4', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '33333333-0000-0000-0000-000000000105',
     'Điểm Lighthouse', 'Điểm trung bình Lighthouse Performance', 50,
     85, 70, 'điểm', 'MONTHLY', 'APPROVED',
     '0c000008-0000-0000-0000-000000000008',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-05-02 08:00:00+07', '2026-05-03 08:00:00+07'),
 
    ('14bed331-c027-4e62-ab68-ace512f04c58', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '33333333-0000-0000-0000-000000000106',
     'Số màn hình hoàn thành', 'Số UI screen hoàn thành và pass QA', 50,
     15, 10, 'màn hình', 'MONTHLY', 'APPROVED',
     '0c000007-0000-0000-0000-000000000007',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-06-02 08:00:00+07', '2026-06-03 08:00:00+07'),
 
    ('05589489-95ec-4cca-a3a0-de9698b4b06e', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '33333333-0000-0000-0000-000000000106',
     'Điểm Lighthouse', 'Điểm trung bình Lighthouse Performance', 50,
     85, 70, 'điểm', 'MONTHLY', 'APPROVED',
     '0c000008-0000-0000-0000-000000000008',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-06-02 08:00:00+07', '2026-06-03 08:00:00+07'),
 
    -- ── Team Content ────────────────────────────────────────
    ('d56e6f48-e0f5-44e9-a032-0c9423a55973', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '33333333-0000-0000-0000-000000000104',
     'Số bài viết', 'Số bài viết content hoàn thành và đăng', 50,
     20, 12, 'bài', 'MONTHLY', 'APPROVED',
     '0c000009-0000-0000-0000-000000000009',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-04-02 08:00:00+07', '2026-04-03 08:00:00+07'),
 
    ('b494ce35-58ac-42e4-8efb-001c5a07393e', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '33333333-0000-0000-0000-000000000104',
     'Tỉ lệ bài đúng hạn', 'Tỉ lệ bài nộp đúng deadline biên tập', 50,
     90, 70, '%', 'MONTHLY', 'APPROVED',
     '0c000010-0000-0000-0000-000000000010',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-04-02 08:00:00+07', '2026-04-03 08:00:00+07'),
 
    ('2eca1dfe-36ac-4359-9a65-ffcbe6c956ad', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '33333333-0000-0000-0000-000000000105',
     'Số bài viết', 'Số bài viết content hoàn thành và đăng', 50,
     20, 12, 'bài', 'MONTHLY', 'APPROVED',
     '0c000009-0000-0000-0000-000000000009',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-05-02 08:00:00+07', '2026-05-03 08:00:00+07'),
 
    ('97634f31-0aba-46d5-b920-b095ec513b27', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '33333333-0000-0000-0000-000000000105',
     'Tỉ lệ bài đúng hạn', 'Tỉ lệ bài nộp đúng deadline biên tập', 50,
     90, 70, '%', 'MONTHLY', 'APPROVED',
     '0c000010-0000-0000-0000-000000000010',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-05-02 08:00:00+07', '2026-05-03 08:00:00+07'),
 
    ('3d32416c-1169-4384-a3c9-6d890cfd5a59', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '33333333-0000-0000-0000-000000000106',
     'Số bài viết', 'Số bài viết content hoàn thành và đăng', 50,
     20, 12, 'bài', 'MONTHLY', 'APPROVED',
     '0c000009-0000-0000-0000-000000000009',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-06-02 08:00:00+07', '2026-06-03 08:00:00+07'),
 
    ('e8a1a3a1-bd0a-42ce-a15c-977587238e20', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '33333333-0000-0000-0000-000000000106',
     'Tỉ lệ bài đúng hạn', 'Tỉ lệ bài nộp đúng deadline biên tập', 50,
     90, 70, '%', 'MONTHLY', 'APPROVED',
     '0c000010-0000-0000-0000-000000000010',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-06-02 08:00:00+07', '2026-06-03 08:00:00+07'),
 
    -- ── Team Design ─────────────────────────────────────────
    ('ff24864e-6616-4c4c-947b-cea8defcb7a6', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '33333333-0000-0000-0000-000000000104',
     'Số asset thiết kế', 'Số asset (banner/infographic) hoàn thành', 50,
     25, 15, 'asset', 'MONTHLY', 'APPROVED',
     '0c000011-0000-0000-0000-000000000011',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-04-02 08:00:00+07', '2026-04-03 08:00:00+07'),
 
    ('ba76ff1a-2331-4262-98ba-a2c1f480caa8', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '33333333-0000-0000-0000-000000000104',
     'Tỉ lệ revise ≤ 2 lần', 'Tỉ lệ asset được duyệt trong 2 lần sửa', 50,
     80, 60, '%', 'MONTHLY', 'APPROVED',
     '0c000012-0000-0000-0000-000000000012',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-04-02 08:00:00+07', '2026-04-03 08:00:00+07'),
 
    ('c97782ca-253d-4e9b-b25d-fe527a76245b', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '33333333-0000-0000-0000-000000000105',
     'Số asset thiết kế', 'Số asset (banner/infographic) hoàn thành', 50,
     25, 15, 'asset', 'MONTHLY', 'APPROVED',
     '0c000011-0000-0000-0000-000000000011',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-05-02 08:00:00+07', '2026-05-03 08:00:00+07'),
 
    ('19dcb07f-0539-4ad7-86b8-7deea6ea3ae4', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '33333333-0000-0000-0000-000000000105',
     'Tỉ lệ revise ≤ 2 lần', 'Tỉ lệ asset được duyệt trong 2 lần sửa', 50,
     80, 60, '%', 'MONTHLY', 'APPROVED',
     '0c000012-0000-0000-0000-000000000012',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-05-02 08:00:00+07', '2026-05-03 08:00:00+07'),
 
    ('132952bd-3e85-46e1-84a0-93db48abf11f', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '33333333-0000-0000-0000-000000000106',
     'Số asset thiết kế', 'Số asset (banner/infographic) hoàn thành', 50,
     25, 15, 'asset', 'MONTHLY', 'APPROVED',
     '0c000011-0000-0000-0000-000000000011',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-06-02 08:00:00+07', '2026-06-03 08:00:00+07'),
 
    ('5911285c-12ec-49c5-bf8a-170e8532b9a1', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '33333333-0000-0000-0000-000000000106',
     'Tỉ lệ revise ≤ 2 lần', 'Tỉ lệ asset được duyệt trong 2 lần sửa', 50,
     80, 60, '%', 'MONTHLY', 'APPROVED',
     '0c000012-0000-0000-0000-000000000012',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100', '2026-06-02 08:00:00+07', '2026-06-03 08:00:00+07');
         
-- ============================================================
-- 9C. KPI CRITERIA ASSIGNEES
-- ============================================================
INSERT INTO kpi_criteria_assignees (kpi_criteria_id, user_id) VALUES
    ('9f4187ab-d4bd-4a73-a21a-eff99273dd27', '22222222-0000-0000-0000-000000000101'),
    ('9f4187ab-d4bd-4a73-a21a-eff99273dd27', '22222222-0000-0000-0000-000000000102'),
    ('7924184d-c084-44a1-ae37-3c6b61d518fc', '22222222-0000-0000-0000-000000000101'),
    ('7924184d-c084-44a1-ae37-3c6b61d518fc', '22222222-0000-0000-0000-000000000102'),
    ('1af7d756-973d-4680-bca0-de8e20b5c6f7', '22222222-0000-0000-0000-000000000101'),
    ('1af7d756-973d-4680-bca0-de8e20b5c6f7', '22222222-0000-0000-0000-000000000102'),
    ('a536373a-4a01-4b25-b8f9-15c7cd479c94', '22222222-0000-0000-0000-000000000101'),
    ('a536373a-4a01-4b25-b8f9-15c7cd479c94', '22222222-0000-0000-0000-000000000102'),
    ('0888dfd5-b2c6-41ea-b925-b1b73e45dc85', '22222222-0000-0000-0000-000000000101'),
    ('0888dfd5-b2c6-41ea-b925-b1b73e45dc85', '22222222-0000-0000-0000-000000000102'),
    ('9e2395d5-e706-4643-bb5c-1fa5d4d829db', '22222222-0000-0000-0000-000000000101'),
    ('9e2395d5-e706-4643-bb5c-1fa5d4d829db', '22222222-0000-0000-0000-000000000102'),
    ('ce79b3ee-d13c-443c-a838-019784af9c82', '22222222-0000-0000-0000-000000000500'),
    ('ce79b3ee-d13c-443c-a838-019784af9c82', '22222222-0000-0000-0000-000000000501'),
    ('577305f2-af2b-4e4b-b695-babda1ee0695', '22222222-0000-0000-0000-000000000500'),
    ('577305f2-af2b-4e4b-b695-babda1ee0695', '22222222-0000-0000-0000-000000000501'),
    ('843fc0ed-4784-414d-a09e-0ad177c651e9', '22222222-0000-0000-0000-000000000500'),
    ('843fc0ed-4784-414d-a09e-0ad177c651e9', '22222222-0000-0000-0000-000000000501'),
    ('d04e377f-7c67-42d7-9986-620c6ea83f09', '22222222-0000-0000-0000-000000000500'),
    ('d04e377f-7c67-42d7-9986-620c6ea83f09', '22222222-0000-0000-0000-000000000501'),
    ('b98cd2b1-2f7a-4b74-8f43-7510f06fad00', '22222222-0000-0000-0000-000000000500'),
    ('b98cd2b1-2f7a-4b74-8f43-7510f06fad00', '22222222-0000-0000-0000-000000000501'),
    ('a357baae-1005-4f1b-8eba-0670a20a0055', '22222222-0000-0000-0000-000000000500'),
    ('a357baae-1005-4f1b-8eba-0670a20a0055', '22222222-0000-0000-0000-000000000501'),
    ('21f3bb63-11a3-40c3-9395-176c0bd74583', '22222222-0000-0000-0000-000000000300'),
    ('21f3bb63-11a3-40c3-9395-176c0bd74583', '22222222-0000-0000-0000-000000000301'),
    ('21f3bb63-11a3-40c3-9395-176c0bd74583', '22222222-0000-0000-0000-000000000103'),
    ('57de5627-31cb-4299-87c3-d370f0a00a10', '22222222-0000-0000-0000-000000000300'),
    ('57de5627-31cb-4299-87c3-d370f0a00a10', '22222222-0000-0000-0000-000000000301'),
    ('57de5627-31cb-4299-87c3-d370f0a00a10', '22222222-0000-0000-0000-000000000103'),
    ('0bbdca82-a6d6-46dd-a4ad-48062d9353b0', '22222222-0000-0000-0000-000000000300'),
    ('0bbdca82-a6d6-46dd-a4ad-48062d9353b0', '22222222-0000-0000-0000-000000000301'),
    ('0bbdca82-a6d6-46dd-a4ad-48062d9353b0', '22222222-0000-0000-0000-000000000103'),
    ('f15a537e-4f63-4947-a750-ec62ab53c51e', '22222222-0000-0000-0000-000000000300'),
    ('f15a537e-4f63-4947-a750-ec62ab53c51e', '22222222-0000-0000-0000-000000000301'),
    ('f15a537e-4f63-4947-a750-ec62ab53c51e', '22222222-0000-0000-0000-000000000103'),
    ('3daf855a-72f5-4941-aa42-37d13a1440f1', '22222222-0000-0000-0000-000000000300'),
    ('3daf855a-72f5-4941-aa42-37d13a1440f1', '22222222-0000-0000-0000-000000000301'),
    ('3daf855a-72f5-4941-aa42-37d13a1440f1', '22222222-0000-0000-0000-000000000103'),
    ('ba7db630-5356-45fd-a201-c60efdd1c252', '22222222-0000-0000-0000-000000000300'),
    ('ba7db630-5356-45fd-a201-c60efdd1c252', '22222222-0000-0000-0000-000000000301'),
    ('ba7db630-5356-45fd-a201-c60efdd1c252', '22222222-0000-0000-0000-000000000103'),
    ('98501d33-c8f4-4fae-a5fe-804dc17f48d5', '22222222-0000-0000-0000-000000000400'),
    ('98501d33-c8f4-4fae-a5fe-804dc17f48d5', '22222222-0000-0000-0000-000000000401'),
    ('98501d33-c8f4-4fae-a5fe-804dc17f48d5', '22222222-0000-0000-0000-000000000402'),
    ('3271fa4b-0d70-4d21-895a-1e3435973010', '22222222-0000-0000-0000-000000000400'),
    ('3271fa4b-0d70-4d21-895a-1e3435973010', '22222222-0000-0000-0000-000000000401'),
    ('3271fa4b-0d70-4d21-895a-1e3435973010', '22222222-0000-0000-0000-000000000402'),
    ('6a6b79a4-dc6f-48c3-91df-730aaa25242c', '22222222-0000-0000-0000-000000000400'),
    ('6a6b79a4-dc6f-48c3-91df-730aaa25242c', '22222222-0000-0000-0000-000000000401'),
    ('6a6b79a4-dc6f-48c3-91df-730aaa25242c', '22222222-0000-0000-0000-000000000402'),
    ('f2b49ab6-4214-4309-921e-7f039e9109a4', '22222222-0000-0000-0000-000000000400'),
    ('f2b49ab6-4214-4309-921e-7f039e9109a4', '22222222-0000-0000-0000-000000000401'),
    ('f2b49ab6-4214-4309-921e-7f039e9109a4', '22222222-0000-0000-0000-000000000402'),
    ('14bed331-c027-4e62-ab68-ace512f04c58', '22222222-0000-0000-0000-000000000400'),
    ('14bed331-c027-4e62-ab68-ace512f04c58', '22222222-0000-0000-0000-000000000401'),
    ('14bed331-c027-4e62-ab68-ace512f04c58', '22222222-0000-0000-0000-000000000402'),
    ('05589489-95ec-4cca-a3a0-de9698b4b06e', '22222222-0000-0000-0000-000000000400'),
    ('05589489-95ec-4cca-a3a0-de9698b4b06e', '22222222-0000-0000-0000-000000000401'),
    ('05589489-95ec-4cca-a3a0-de9698b4b06e', '22222222-0000-0000-0000-000000000402'),
    ('d56e6f48-e0f5-44e9-a032-0c9423a55973', '22222222-0000-0000-0000-000000000600'),
    ('d56e6f48-e0f5-44e9-a032-0c9423a55973', '22222222-0000-0000-0000-000000000601'),
    ('d56e6f48-e0f5-44e9-a032-0c9423a55973', '22222222-0000-0000-0000-000000000602'),
    ('b494ce35-58ac-42e4-8efb-001c5a07393e', '22222222-0000-0000-0000-000000000600'),
    ('b494ce35-58ac-42e4-8efb-001c5a07393e', '22222222-0000-0000-0000-000000000601'),
    ('b494ce35-58ac-42e4-8efb-001c5a07393e', '22222222-0000-0000-0000-000000000602'),
    ('2eca1dfe-36ac-4359-9a65-ffcbe6c956ad', '22222222-0000-0000-0000-000000000600'),
    ('2eca1dfe-36ac-4359-9a65-ffcbe6c956ad', '22222222-0000-0000-0000-000000000601'),
    ('2eca1dfe-36ac-4359-9a65-ffcbe6c956ad', '22222222-0000-0000-0000-000000000602'),
    ('97634f31-0aba-46d5-b920-b095ec513b27', '22222222-0000-0000-0000-000000000600'),
    ('97634f31-0aba-46d5-b920-b095ec513b27', '22222222-0000-0000-0000-000000000601'),
    ('97634f31-0aba-46d5-b920-b095ec513b27', '22222222-0000-0000-0000-000000000602'),
    ('3d32416c-1169-4384-a3c9-6d890cfd5a59', '22222222-0000-0000-0000-000000000600'),
    ('3d32416c-1169-4384-a3c9-6d890cfd5a59', '22222222-0000-0000-0000-000000000601'),
    ('3d32416c-1169-4384-a3c9-6d890cfd5a59', '22222222-0000-0000-0000-000000000602'),
    ('e8a1a3a1-bd0a-42ce-a15c-977587238e20', '22222222-0000-0000-0000-000000000600'),
    ('e8a1a3a1-bd0a-42ce-a15c-977587238e20', '22222222-0000-0000-0000-000000000601'),
    ('e8a1a3a1-bd0a-42ce-a15c-977587238e20', '22222222-0000-0000-0000-000000000602'),
    ('ff24864e-6616-4c4c-947b-cea8defcb7a6', '22222222-0000-0000-0000-000000000700'),
    ('ff24864e-6616-4c4c-947b-cea8defcb7a6', '22222222-0000-0000-0000-000000000701'),
    ('ff24864e-6616-4c4c-947b-cea8defcb7a6', '22222222-0000-0000-0000-000000000702'),
    ('ba76ff1a-2331-4262-98ba-a2c1f480caa8', '22222222-0000-0000-0000-000000000700'),
    ('ba76ff1a-2331-4262-98ba-a2c1f480caa8', '22222222-0000-0000-0000-000000000701'),
    ('ba76ff1a-2331-4262-98ba-a2c1f480caa8', '22222222-0000-0000-0000-000000000702'),
    ('c97782ca-253d-4e9b-b25d-fe527a76245b', '22222222-0000-0000-0000-000000000700'),
    ('c97782ca-253d-4e9b-b25d-fe527a76245b', '22222222-0000-0000-0000-000000000701'),
    ('c97782ca-253d-4e9b-b25d-fe527a76245b', '22222222-0000-0000-0000-000000000702'),
    ('19dcb07f-0539-4ad7-86b8-7deea6ea3ae4', '22222222-0000-0000-0000-000000000700'),
    ('19dcb07f-0539-4ad7-86b8-7deea6ea3ae4', '22222222-0000-0000-0000-000000000701'),
    ('19dcb07f-0539-4ad7-86b8-7deea6ea3ae4', '22222222-0000-0000-0000-000000000702'),
    ('132952bd-3e85-46e1-84a0-93db48abf11f', '22222222-0000-0000-0000-000000000700'),
    ('132952bd-3e85-46e1-84a0-93db48abf11f', '22222222-0000-0000-0000-000000000701'),
    ('132952bd-3e85-46e1-84a0-93db48abf11f', '22222222-0000-0000-0000-000000000702'),
    ('5911285c-12ec-49c5-bf8a-170e8532b9a1', '22222222-0000-0000-0000-000000000700'),
    ('5911285c-12ec-49c5-bf8a-170e8532b9a1', '22222222-0000-0000-0000-000000000701'),
    ('5911285c-12ec-49c5-bf8a-170e8532b9a1', '22222222-0000-0000-0000-000000000702');
 
-- ============================================================
-- 9D. KPI SUBMISSIONS
-- ============================================================
INSERT INTO kpi_submissions
    (id, org_unit_id, kpi_criteria_id, submitted_by,
     actual_value, auto_score, note, status,
     reviewed_by, review_note, reviewed_at, period_start, period_end)
VALUES
    ('225d6d42-3ad8-43be-bd66-bcf5b216fcd7', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '9f4187ab-d4bd-4a73-a21a-eff99273dd27', '22222222-0000-0000-0000-000000000101',
     45, 45.0, '45 task', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('bbed5370-c36a-4d15-be78-eb0ba1883f39', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7924184d-c084-44a1-ae37-3c6b61d518fc', '22222222-0000-0000-0000-000000000101',
     6, 41.7, '6 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('1816b82c-22ff-4189-a098-096ab3af0258', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '9f4187ab-d4bd-4a73-a21a-eff99273dd27', '22222222-0000-0000-0000-000000000102',
     42, 42.0, '42 task', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('de571ea1-fde6-4b24-81ef-307e5e7429bd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '7924184d-c084-44a1-ae37-3c6b61d518fc', '22222222-0000-0000-0000-000000000102',
     7, 35.7, '7 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Đạt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('ea3dfa7f-b2b8-40c1-8af8-172a94a4953b', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '1af7d756-973d-4680-bca0-de8e20b5c6f7', '22222222-0000-0000-0000-000000000101',
     50, 50.0, '50 task', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Xuất sắc', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('9208032c-9a76-4a39-a8d9-712e53bd7be2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'a536373a-4a01-4b25-b8f9-15c7cd479c94', '22222222-0000-0000-0000-000000000101',
     5, 50.0, '5 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Xuất sắc', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('76acdd0f-85a4-4878-b574-b2891fdaf4fc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '1af7d756-973d-4680-bca0-de8e20b5c6f7', '22222222-0000-0000-0000-000000000102',
     48, 48.0, '48 task', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('afbc0acf-44a8-4399-b296-58a640c7a340', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'a536373a-4a01-4b25-b8f9-15c7cd479c94', '22222222-0000-0000-0000-000000000102',
     6, 41.7, '6 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('fce7a7ee-57af-48d8-ba2f-ff016db4da6a', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '0888dfd5-b2c6-41ea-b925-b1b73e45dc85', '22222222-0000-0000-0000-000000000101',
     55, 50.0, '55 task', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('b3518f43-05d3-4069-aa94-d0f99b86253a', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '9e2395d5-e706-4643-bb5c-1fa5d4d829db', '22222222-0000-0000-0000-000000000101',
     4, 50.0, '4 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('df7003df-a32c-4510-a57e-e13fc0b95e60', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '0888dfd5-b2c6-41ea-b925-b1b73e45dc85', '22222222-0000-0000-0000-000000000102',
     52, 50.0, '52 task', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('ba7c0789-446c-4636-b99f-0d5e7bd9e453', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '9e2395d5-e706-4643-bb5c-1fa5d4d829db', '22222222-0000-0000-0000-000000000102',
     5, 50.0, '5 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('22b4600b-48d1-4333-a274-8025fb6ead0e', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'ce79b3ee-d13c-443c-a838-019784af9c82', '22222222-0000-0000-0000-000000000500',
     24, 40.0, '24 bài', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('443ace58-4a76-4c5c-a2b2-40796516485f', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '577305f2-af2b-4e4b-b695-babda1ee0695', '22222222-0000-0000-0000-000000000500',
     4200, 42.0, '4200 lượt', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('d5efc76f-3bb1-4fca-831b-fedb63eee104', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'ce79b3ee-d13c-443c-a838-019784af9c82', '22222222-0000-0000-0000-000000000501',
     22, 36.7, '22 bài', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Đạt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('57651823-1614-4e73-b2f2-0ff6cb207130', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '577305f2-af2b-4e4b-b695-babda1ee0695', '22222222-0000-0000-0000-000000000501',
     3800, 38.0, '3800 lượt', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Đạt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('856c51ae-2744-474e-becc-1fc7781ea42e', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '843fc0ed-4784-414d-a09e-0ad177c651e9', '22222222-0000-0000-0000-000000000500',
     28, 46.7, '28 bài', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('abe7c0d5-50d5-4b26-8f3d-2da9a4eb0442', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'd04e377f-7c67-42d7-9986-620c6ea83f09', '22222222-0000-0000-0000-000000000500',
     4800, 48.0, '4800 lượt', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('8da2ad2e-9e05-43f9-8f0e-5f96643d2a72', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '843fc0ed-4784-414d-a09e-0ad177c651e9', '22222222-0000-0000-0000-000000000501',
     26, 43.3, '26 bài', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('a99f2013-82c5-4d07-b5f5-38a52a02941b', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'd04e377f-7c67-42d7-9986-620c6ea83f09', '22222222-0000-0000-0000-000000000501',
     4200, 42.0, '4200 lượt', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('6d3291de-ed39-4458-a209-8a175a0b74b2', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'b98cd2b1-2f7a-4b74-8f43-7510f06fad00', '22222222-0000-0000-0000-000000000500',
     34, 50.0, '34 bài', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('a468d3b0-42d2-4f7c-8966-80af886ab1ed', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'a357baae-1005-4f1b-8eba-0670a20a0055', '22222222-0000-0000-0000-000000000500',
     5500, 50.0, '5500 lượt', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('2fb6d13b-b685-44b9-b5fe-86550adb0230', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'b98cd2b1-2f7a-4b74-8f43-7510f06fad00', '22222222-0000-0000-0000-000000000501',
     30, 50.0, '30 bài', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('fc05ceb3-5234-4363-a624-3938d3471656', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'a357baae-1005-4f1b-8eba-0670a20a0055', '22222222-0000-0000-0000-000000000501',
     5000, 50.0, '5000 lượt', 'APPROVED',
     '22222222-0000-0000-0000-000000000100', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('54d0a744-dea7-49cc-b0f9-65df4733b11f', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '21f3bb63-11a3-40c3-9395-176c0bd74583', '22222222-0000-0000-0000-000000000300',
     18, 45.0, '18 endpoint', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('6863237a-4878-4ef6-bdfc-8aa7687f5690', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '57de5627-31cb-4299-87c3-d370f0a00a10', '22222222-0000-0000-0000-000000000300',
     25, 41.7, '25 PR', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('2fc63b8e-1baf-4c7c-a6af-f9dfb9122aeb', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '21f3bb63-11a3-40c3-9395-176c0bd74583', '22222222-0000-0000-0000-000000000301',
     16, 40.0, '16 endpoint', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('02e944f0-4efe-4d42-8fee-93ecd9abee6c', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '57de5627-31cb-4299-87c3-d370f0a00a10', '22222222-0000-0000-0000-000000000301',
     22, 36.7, '22 PR', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Đạt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('b76ec5a0-10dc-4eb5-b477-86c7d5c9ccc2', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '21f3bb63-11a3-40c3-9395-176c0bd74583', '22222222-0000-0000-0000-000000000103',
     14, 35.0, '14 endpoint', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Đạt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('75ef9dc4-f494-4846-b1c6-7b07dfe4a565', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '57de5627-31cb-4299-87c3-d370f0a00a10', '22222222-0000-0000-0000-000000000103',
     20, 33.3, '20 PR', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Đạt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('5e2569b3-0576-43f2-a6e0-dc493e970ab5', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '0bbdca82-a6d6-46dd-a4ad-48062d9353b0', '22222222-0000-0000-0000-000000000300',
     20, 50.0, '20 endpoint', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Xuất sắc', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('c0714326-bd36-4c26-9876-8d5d8e669638', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'f15a537e-4f63-4947-a750-ec62ab53c51e', '22222222-0000-0000-0000-000000000300',
     30, 50.0, '30 PR', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Xuất sắc', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('d3bbef05-75b2-4978-99ad-e070f7c2f26e', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '0bbdca82-a6d6-46dd-a4ad-48062d9353b0', '22222222-0000-0000-0000-000000000301',
     19, 47.5, '19 endpoint', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('d9d8a8a7-9ced-4e1d-9485-b609fc62dfd5', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'f15a537e-4f63-4947-a750-ec62ab53c51e', '22222222-0000-0000-0000-000000000301',
     27, 45.0, '27 PR', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('374055ed-a785-44f9-99a6-e4962ca81e92', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '0bbdca82-a6d6-46dd-a4ad-48062d9353b0', '22222222-0000-0000-0000-000000000103',
     17, 42.5, '17 endpoint', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('ff289c5b-06d8-430d-a1b4-4e03df1fb871', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'f15a537e-4f63-4947-a750-ec62ab53c51e', '22222222-0000-0000-0000-000000000103',
     24, 40.0, '24 PR', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('0f6cc9d9-0728-4f98-a73b-f2e115fef3cf', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '3daf855a-72f5-4941-aa42-37d13a1440f1', '22222222-0000-0000-0000-000000000300',
     23, 50.0, '23 endpoint', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('5a8544dc-dc16-46f1-bb84-6541fb965402', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'ba7db630-5356-45fd-a201-c60efdd1c252', '22222222-0000-0000-0000-000000000300',
     35, 50.0, '35 PR', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('0688c561-3231-4786-bb06-35e9594cd6cd', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '3daf855a-72f5-4941-aa42-37d13a1440f1', '22222222-0000-0000-0000-000000000301',
     21, 50.0, '21 endpoint', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('9aa4b53b-3f58-48f4-ad7f-f6282dd92df8', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'ba7db630-5356-45fd-a201-c60efdd1c252', '22222222-0000-0000-0000-000000000301',
     32, 50.0, '32 PR', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('d395f2f9-e006-4b84-b015-1643e8b22102', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '3daf855a-72f5-4941-aa42-37d13a1440f1', '22222222-0000-0000-0000-000000000103',
     20, 50.0, '20 endpoint', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('589b7526-3e1b-478f-a8f7-4fb934a3ce45', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'ba7db630-5356-45fd-a201-c60efdd1c252', '22222222-0000-0000-0000-000000000103',
     28, 46.7, '28 PR', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Tốt', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('f31fa9b9-e477-496e-872f-3ee2662934e8', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '98501d33-c8f4-4fae-a5fe-804dc17f48d5', '22222222-0000-0000-0000-000000000400',
     13, 43.3, '13 màn hình', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('df04a059-d1b1-4263-a3e6-9a0ef81a5219', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '3271fa4b-0d70-4d21-895a-1e3435973010', '22222222-0000-0000-0000-000000000400',
     80, 47.1, '80 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('cb429fb5-1aea-4d0f-8420-3e38e94638aa', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '98501d33-c8f4-4fae-a5fe-804dc17f48d5', '22222222-0000-0000-0000-000000000401',
     12, 40.0, '12 màn hình', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('0e3445aa-fc5d-495f-a604-167bba6be5ff', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '3271fa4b-0d70-4d21-895a-1e3435973010', '22222222-0000-0000-0000-000000000401',
     75, 44.1, '75 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('4968d3c0-a6e9-4753-8b77-85ed9b67d53b', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '98501d33-c8f4-4fae-a5fe-804dc17f48d5', '22222222-0000-0000-0000-000000000402',
     11, 36.7, '11 màn hình', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Đạt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('699a6cca-13e9-42e0-88a3-ca0721ee523d', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '3271fa4b-0d70-4d21-895a-1e3435973010', '22222222-0000-0000-0000-000000000402',
     72, 42.4, '72 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('7576a1da-1c31-4c6f-a900-ec6985aa93dc', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '6a6b79a4-dc6f-48c3-91df-730aaa25242c', '22222222-0000-0000-0000-000000000400',
     15, 50.0, '15 màn hình', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Xuất sắc', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('23637d52-9307-4155-95e8-5bd600057838', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'f2b49ab6-4214-4309-921e-7f039e9109a4', '22222222-0000-0000-0000-000000000400',
     85, 50.0, '85 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Xuất sắc', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('d5d90310-3c83-4fa4-b4ce-e3091c3d0425', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '6a6b79a4-dc6f-48c3-91df-730aaa25242c', '22222222-0000-0000-0000-000000000401',
     14, 46.7, '14 màn hình', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('06e6348c-e3a4-4b9c-ae0d-f81626470274', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'f2b49ab6-4214-4309-921e-7f039e9109a4', '22222222-0000-0000-0000-000000000401',
     82, 48.2, '82 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('75923d25-1c30-4d2f-ba54-e36952a77310', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '6a6b79a4-dc6f-48c3-91df-730aaa25242c', '22222222-0000-0000-0000-000000000402',
     13, 43.3, '13 màn hình', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('b2752c0f-8a1b-47cd-b8ba-94600fb78ccd', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'f2b49ab6-4214-4309-921e-7f039e9109a4', '22222222-0000-0000-0000-000000000402',
     78, 45.9, '78 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('00b010e5-042e-4dd1-95ef-3b9e785912e0', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '14bed331-c027-4e62-ab68-ace512f04c58', '22222222-0000-0000-0000-000000000400',
     17, 50.0, '17 màn hình', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('b8a44af6-c5fe-4853-864d-d3653b7915b0', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '05589489-95ec-4cca-a3a0-de9698b4b06e', '22222222-0000-0000-0000-000000000400',
     90, 50.0, '90 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('524ef413-1d12-45ae-8fcf-2534b6a0ceee', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '14bed331-c027-4e62-ab68-ace512f04c58', '22222222-0000-0000-0000-000000000401',
     16, 50.0, '16 màn hình', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('5e93daac-8d43-43ff-8e6c-022d9f80117c', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '05589489-95ec-4cca-a3a0-de9698b4b06e', '22222222-0000-0000-0000-000000000401',
     88, 50.0, '88 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('e8977133-ddf3-427f-8136-5d3116b32cdb', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '14bed331-c027-4e62-ab68-ace512f04c58', '22222222-0000-0000-0000-000000000402',
     15, 50.0, '15 màn hình', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('7c3d1a6e-1ffe-4140-9bd0-7de5e04633ab', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '05589489-95ec-4cca-a3a0-de9698b4b06e', '22222222-0000-0000-0000-000000000402',
     85, 50.0, '85 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000000101', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('49a239de-2f9e-44ee-a8fd-d7d3a0bce06f', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'd56e6f48-e0f5-44e9-a032-0c9423a55973', '22222222-0000-0000-0000-000000000600',
     17, 42.5, '17 bài', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('5f967293-830b-4e2b-8417-9c87b38f1fef', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'b494ce35-58ac-42e4-8efb-001c5a07393e', '22222222-0000-0000-0000-000000000600',
     82, 45.6, '82 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('0940f623-296c-4663-b825-476685079d72', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'd56e6f48-e0f5-44e9-a032-0c9423a55973', '22222222-0000-0000-0000-000000000601',
     15, 37.5, '15 bài', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Đạt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('922c91ad-5c07-4bcf-8555-cc2d369d128c', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'b494ce35-58ac-42e4-8efb-001c5a07393e', '22222222-0000-0000-0000-000000000601',
     78, 43.3, '78 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('5a37b226-2932-434e-bbd8-1d4444755ed5', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'd56e6f48-e0f5-44e9-a032-0c9423a55973', '22222222-0000-0000-0000-000000000602',
     14, 35.0, '14 bài', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Đạt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('c16b964d-d31f-460e-a7e1-a2ae6f3fe198', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'b494ce35-58ac-42e4-8efb-001c5a07393e', '22222222-0000-0000-0000-000000000602',
     74, 41.1, '74 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('fa20367f-a438-4525-bdfb-145faffa1d01', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '2eca1dfe-36ac-4359-9a65-ffcbe6c956ad', '22222222-0000-0000-0000-000000000600',
     20, 50.0, '20 bài', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Xuất sắc', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('94fcc11c-7c43-42b9-afda-6e15f9a9da27', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '97634f31-0aba-46d5-b920-b095ec513b27', '22222222-0000-0000-0000-000000000600',
     90, 50.0, '90 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Xuất sắc', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('3c11c71b-749a-40e7-90e4-78340624ca51', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '2eca1dfe-36ac-4359-9a65-ffcbe6c956ad', '22222222-0000-0000-0000-000000000601',
     18, 45.0, '18 bài', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('e5f46d56-cf78-4385-8dd1-9f0202529040', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '97634f31-0aba-46d5-b920-b095ec513b27', '22222222-0000-0000-0000-000000000601',
     85, 47.2, '85 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('d321c048-e531-4887-838e-7e9cbab5ccb2', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '2eca1dfe-36ac-4359-9a65-ffcbe6c956ad', '22222222-0000-0000-0000-000000000602',
     17, 42.5, '17 bài', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('d1c6d2fe-ec41-414f-8644-33c26203bb83', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '97634f31-0aba-46d5-b920-b095ec513b27', '22222222-0000-0000-0000-000000000602',
     80, 44.4, '80 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('7ad93c50-713e-40fb-b676-92df18a7412e', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '3d32416c-1169-4384-a3c9-6d890cfd5a59', '22222222-0000-0000-0000-000000000600',
     22, 50.0, '22 bài', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('bd17e3eb-9d33-4836-b29c-e71bbf58e6f3', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'e8a1a3a1-bd0a-42ce-a15c-977587238e20', '22222222-0000-0000-0000-000000000600',
     95, 50.0, '95 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('87163d12-0587-4999-8527-91876abde2fe', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '3d32416c-1169-4384-a3c9-6d890cfd5a59', '22222222-0000-0000-0000-000000000601',
     21, 50.0, '21 bài', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('6be14950-2f58-4b61-a495-f46f46f180e6', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'e8a1a3a1-bd0a-42ce-a15c-977587238e20', '22222222-0000-0000-0000-000000000601',
     92, 50.0, '92 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('0d7b36e0-309f-49f4-9304-678d30cbd208', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '3d32416c-1169-4384-a3c9-6d890cfd5a59', '22222222-0000-0000-0000-000000000602',
     20, 50.0, '20 bài', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('3d445038-4946-4925-9cd0-9f4cbba2da75', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'e8a1a3a1-bd0a-42ce-a15c-977587238e20', '22222222-0000-0000-0000-000000000602',
     88, 48.9, '88 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Tốt', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('7287273b-c7bd-4bcc-8d17-a1462d85cb4a', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', 'ff24864e-6616-4c4c-947b-cea8defcb7a6', '22222222-0000-0000-0000-000000000700',
     22, 44.0, '22 asset', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('0239c600-ded4-4dbd-b7cb-d11c0aaa6d0c', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', 'ba76ff1a-2331-4262-98ba-a2c1f480caa8', '22222222-0000-0000-0000-000000000700',
     75, 46.9, '75 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('a4d7bc94-d9d6-4e6d-9783-679eae7065bd', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', 'ff24864e-6616-4c4c-947b-cea8defcb7a6', '22222222-0000-0000-0000-000000000701',
     19, 38.0, '19 asset', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Đạt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('7dfbd1eb-6461-4eec-9daa-5f8f832dfa29', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', 'ba76ff1a-2331-4262-98ba-a2c1f480caa8', '22222222-0000-0000-0000-000000000701',
     68, 42.5, '68 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('21733e53-0f7c-4c1c-9b4b-bc25599a9673', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', 'ff24864e-6616-4c4c-947b-cea8defcb7a6', '22222222-0000-0000-0000-000000000702',
     17, 34.0, '17 asset', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Đạt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('57f38d10-72a7-4818-8688-e0b1fb478d71', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', 'ba76ff1a-2331-4262-98ba-a2c1f480caa8', '22222222-0000-0000-0000-000000000702',
     63, 39.4, '63 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Đạt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('72084f24-301f-4210-b29a-061f0f94afad', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', 'c97782ca-253d-4e9b-b25d-fe527a76245b', '22222222-0000-0000-0000-000000000700',
     25, 50.0, '25 asset', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Xuất sắc', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('bfa9ee2c-fc56-423b-902a-0e7727ad1953', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '19dcb07f-0539-4ad7-86b8-7deea6ea3ae4', '22222222-0000-0000-0000-000000000700',
     80, 50.0, '80 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Xuất sắc', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('43225e5e-9df8-44e8-a482-2a260c25d64a', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', 'c97782ca-253d-4e9b-b25d-fe527a76245b', '22222222-0000-0000-0000-000000000701',
     22, 44.0, '22 asset', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('7cca00c9-c61f-4f5d-86e8-fb212b4f6e3b', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '19dcb07f-0539-4ad7-86b8-7deea6ea3ae4', '22222222-0000-0000-0000-000000000701',
     75, 46.9, '75 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('033fc9ea-88ff-4c93-b506-f8ccb4b89bdb', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', 'c97782ca-253d-4e9b-b25d-fe527a76245b', '22222222-0000-0000-0000-000000000702',
     20, 40.0, '20 asset', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('52e1045b-4779-413b-a51a-5e2f5a19a51d', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '19dcb07f-0539-4ad7-86b8-7deea6ea3ae4', '22222222-0000-0000-0000-000000000702',
     70, 43.8, '70 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('028dde8d-9683-47e0-92f3-ff2961a19dcb', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '132952bd-3e85-46e1-84a0-93db48abf11f', '22222222-0000-0000-0000-000000000700',
     28, 50.0, '28 asset', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('accbd8f5-00fe-4bb5-a3df-cfb2ad0ca8e3', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '5911285c-12ec-49c5-bf8a-170e8532b9a1', '22222222-0000-0000-0000-000000000700',
     88, 50.0, '88 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('a5b62f10-3b45-4488-9cdb-545af8e9d908', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '132952bd-3e85-46e1-84a0-93db48abf11f', '22222222-0000-0000-0000-000000000701',
     26, 50.0, '26 asset', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('89f854f5-9abe-4ff1-b9cc-d880a2b294e0', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '5911285c-12ec-49c5-bf8a-170e8532b9a1', '22222222-0000-0000-0000-000000000701',
     82, 50.0, '82 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('b2957ace-664e-47b8-b810-94af0d3bcafb', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '132952bd-3e85-46e1-84a0-93db48abf11f', '22222222-0000-0000-0000-000000000702',
     24, 48.0, '24 asset', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Tốt', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('2d56f353-d95b-479f-8b7f-75c8c2de4d76', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '5911285c-12ec-49c5-bf8a-170e8532b9a1', '22222222-0000-0000-0000-000000000702',
     78, 48.8, '78 %', 'APPROVED',
     '22222222-0000-0000-0000-000000000500', 'Tốt', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07');
 
-- ============================================================
-- 9E. KPI REMINDERS  (1 batch × 3 periods × all assignees)
-- ============================================================
INSERT INTO kpi_reminders (id, kpi_criteria_id, user_id, batch_number, sent_at) VALUES
    ('6629935e-0aa8-4b6f-8b1a-221b4825e890', '9f4187ab-d4bd-4a73-a21a-eff99273dd27', '22222222-0000-0000-0000-000000000101', 1, '2026-04-15 00:00:00+07'),
    ('6f6d3cf7-a6ce-4387-ad31-c24d71292629', '9f4187ab-d4bd-4a73-a21a-eff99273dd27', '22222222-0000-0000-0000-000000000102', 1, '2026-04-15 00:00:00+07'),
    ('5c80919c-611f-4d1b-ace4-4def08fd05c2', '7924184d-c084-44a1-ae37-3c6b61d518fc', '22222222-0000-0000-0000-000000000101', 1, '2026-04-15 00:00:00+07'),
    ('39890553-02e0-4337-99fd-538082162eb6', '7924184d-c084-44a1-ae37-3c6b61d518fc', '22222222-0000-0000-0000-000000000102', 1, '2026-04-15 00:00:00+07'),
    ('c3b03d5a-18c8-43ee-b2b7-7b0d09a13d26', '1af7d756-973d-4680-bca0-de8e20b5c6f7', '22222222-0000-0000-0000-000000000101', 1, '2026-05-15 00:00:00+07'),
    ('5785a729-ff75-495d-86c4-a8924f9e8c30', '1af7d756-973d-4680-bca0-de8e20b5c6f7', '22222222-0000-0000-0000-000000000102', 1, '2026-05-15 00:00:00+07'),
    ('766f8b2f-b168-4223-bb14-ebd1b7783c74', 'a536373a-4a01-4b25-b8f9-15c7cd479c94', '22222222-0000-0000-0000-000000000101', 1, '2026-05-15 00:00:00+07'),
    ('5999f640-f1b9-4d44-a5f2-6462b092daa9', 'a536373a-4a01-4b25-b8f9-15c7cd479c94', '22222222-0000-0000-0000-000000000102', 1, '2026-05-15 00:00:00+07'),
    ('37d3bf48-bc48-4438-9c4d-5c673d8673e8', '0888dfd5-b2c6-41ea-b925-b1b73e45dc85', '22222222-0000-0000-0000-000000000101', 1, '2026-06-15 00:00:00+07'),
    ('140087df-fa37-4b34-935a-e96acb2725c0', '0888dfd5-b2c6-41ea-b925-b1b73e45dc85', '22222222-0000-0000-0000-000000000102', 1, '2026-06-15 00:00:00+07'),
    ('871e76db-e608-428b-bd45-4071b89e408b', '9e2395d5-e706-4643-bb5c-1fa5d4d829db', '22222222-0000-0000-0000-000000000101', 1, '2026-06-15 00:00:00+07'),
    ('46e2f93f-513a-4288-8890-0748a4c932b8', '9e2395d5-e706-4643-bb5c-1fa5d4d829db', '22222222-0000-0000-0000-000000000102', 1, '2026-06-15 00:00:00+07'),
    ('7c7b8fcf-5629-4b51-a87a-4c10446b6565', 'ce79b3ee-d13c-443c-a838-019784af9c82', '22222222-0000-0000-0000-000000000500', 1, '2026-04-15 00:00:00+07'),
    ('20ee0f19-7ab0-4ea1-b522-214381c24ace', 'ce79b3ee-d13c-443c-a838-019784af9c82', '22222222-0000-0000-0000-000000000501', 1, '2026-04-15 00:00:00+07'),
    ('d1db3ecf-7dff-4bbf-adf9-efe0dd3c5899', '577305f2-af2b-4e4b-b695-babda1ee0695', '22222222-0000-0000-0000-000000000500', 1, '2026-04-15 00:00:00+07'),
    ('9a161d60-9a34-4f7d-a0c0-94e585bfd1de', '577305f2-af2b-4e4b-b695-babda1ee0695', '22222222-0000-0000-0000-000000000501', 1, '2026-04-15 00:00:00+07'),
    ('e0d5c40b-65f9-4187-98e6-77c89e2fc357', '843fc0ed-4784-414d-a09e-0ad177c651e9', '22222222-0000-0000-0000-000000000500', 1, '2026-05-15 00:00:00+07'),
    ('6fd3c48e-0a17-47b9-bd95-be0475684c77', '843fc0ed-4784-414d-a09e-0ad177c651e9', '22222222-0000-0000-0000-000000000501', 1, '2026-05-15 00:00:00+07'),
    ('31b8afb8-9c73-4792-9859-227b63ab0d05', 'd04e377f-7c67-42d7-9986-620c6ea83f09', '22222222-0000-0000-0000-000000000500', 1, '2026-05-15 00:00:00+07'),
    ('9e4b8373-9e69-4f9c-9938-781f976170fd', 'd04e377f-7c67-42d7-9986-620c6ea83f09', '22222222-0000-0000-0000-000000000501', 1, '2026-05-15 00:00:00+07'),
    ('0fa9cada-8ea5-4c43-bb74-37d50c3aa984', 'b98cd2b1-2f7a-4b74-8f43-7510f06fad00', '22222222-0000-0000-0000-000000000500', 1, '2026-06-15 00:00:00+07'),
    ('4b562e09-d608-461a-99c8-e8d37a2f7b5f', 'b98cd2b1-2f7a-4b74-8f43-7510f06fad00', '22222222-0000-0000-0000-000000000501', 1, '2026-06-15 00:00:00+07'),
    ('8d7047b0-efee-441e-9409-d0b8b7d76f54', 'a357baae-1005-4f1b-8eba-0670a20a0055', '22222222-0000-0000-0000-000000000500', 1, '2026-06-15 00:00:00+07'),
    ('f1217caa-50ac-4c95-8db8-7596ca5f6ae3', 'a357baae-1005-4f1b-8eba-0670a20a0055', '22222222-0000-0000-0000-000000000501', 1, '2026-06-15 00:00:00+07'),
    ('d0bf8e67-a568-4a62-9d81-927da118f3f3', '21f3bb63-11a3-40c3-9395-176c0bd74583', '22222222-0000-0000-0000-000000000300', 1, '2026-04-15 00:00:00+07'),
    ('b0ad9427-ecea-4c6c-8b7f-d4cba861dd23', '21f3bb63-11a3-40c3-9395-176c0bd74583', '22222222-0000-0000-0000-000000000301', 1, '2026-04-15 00:00:00+07'),
    ('c0e5afe2-7f3a-4a5c-ab53-d0f911104ec4', '21f3bb63-11a3-40c3-9395-176c0bd74583', '22222222-0000-0000-0000-000000000103', 1, '2026-04-15 00:00:00+07'),
    ('632f4315-612d-4dee-8873-582d2b3bf367', '57de5627-31cb-4299-87c3-d370f0a00a10', '22222222-0000-0000-0000-000000000300', 1, '2026-04-15 00:00:00+07'),
    ('4f0c7e0f-74f8-4c2d-ae09-56030e49f6ea', '57de5627-31cb-4299-87c3-d370f0a00a10', '22222222-0000-0000-0000-000000000301', 1, '2026-04-15 00:00:00+07'),
    ('8b8c7c17-b9f8-47c8-9cc9-f7d218fb4d53', '57de5627-31cb-4299-87c3-d370f0a00a10', '22222222-0000-0000-0000-000000000103', 1, '2026-04-15 00:00:00+07'),
    ('260b966f-fd88-4f8d-afc8-270a74921988', '0bbdca82-a6d6-46dd-a4ad-48062d9353b0', '22222222-0000-0000-0000-000000000300', 1, '2026-05-15 00:00:00+07'),
    ('48470742-f001-4720-b718-2e69d78a690b', '0bbdca82-a6d6-46dd-a4ad-48062d9353b0', '22222222-0000-0000-0000-000000000301', 1, '2026-05-15 00:00:00+07'),
    ('61327ed2-001e-4301-b630-51b224229d49', '0bbdca82-a6d6-46dd-a4ad-48062d9353b0', '22222222-0000-0000-0000-000000000103', 1, '2026-05-15 00:00:00+07'),
    ('c99544bc-5fd8-479d-b44a-60076c6c09d2', 'f15a537e-4f63-4947-a750-ec62ab53c51e', '22222222-0000-0000-0000-000000000300', 1, '2026-05-15 00:00:00+07'),
    ('6b1e89b8-f03c-460f-b774-617dd218f641', 'f15a537e-4f63-4947-a750-ec62ab53c51e', '22222222-0000-0000-0000-000000000301', 1, '2026-05-15 00:00:00+07'),
    ('bcd2df3d-2de9-4088-9287-ab7a53e0384a', 'f15a537e-4f63-4947-a750-ec62ab53c51e', '22222222-0000-0000-0000-000000000103', 1, '2026-05-15 00:00:00+07'),
    ('71a906c2-d085-47af-8b3a-1815632036cc', '3daf855a-72f5-4941-aa42-37d13a1440f1', '22222222-0000-0000-0000-000000000300', 1, '2026-06-15 00:00:00+07'),
    ('40f2a779-d18e-4b03-b2d5-ff6456cf6bc6', '3daf855a-72f5-4941-aa42-37d13a1440f1', '22222222-0000-0000-0000-000000000301', 1, '2026-06-15 00:00:00+07'),
    ('9ed3a3b0-db6e-4e06-8070-4acfa7b03086', '3daf855a-72f5-4941-aa42-37d13a1440f1', '22222222-0000-0000-0000-000000000103', 1, '2026-06-15 00:00:00+07'),
    ('07e68763-f109-45df-8727-7fca6beb7161', 'ba7db630-5356-45fd-a201-c60efdd1c252', '22222222-0000-0000-0000-000000000300', 1, '2026-06-15 00:00:00+07'),
    ('006649b5-f943-4d66-9e03-30ada8512576', 'ba7db630-5356-45fd-a201-c60efdd1c252', '22222222-0000-0000-0000-000000000301', 1, '2026-06-15 00:00:00+07'),
    ('f4a16026-231a-4024-9c02-73ee221c5693', 'ba7db630-5356-45fd-a201-c60efdd1c252', '22222222-0000-0000-0000-000000000103', 1, '2026-06-15 00:00:00+07'),
    ('07384f40-24c2-4d0c-9108-ba5cefdde3b4', '98501d33-c8f4-4fae-a5fe-804dc17f48d5', '22222222-0000-0000-0000-000000000400', 1, '2026-04-15 00:00:00+07'),
    ('626e188a-4c29-41b7-b0fd-ccab8836eace', '98501d33-c8f4-4fae-a5fe-804dc17f48d5', '22222222-0000-0000-0000-000000000401', 1, '2026-04-15 00:00:00+07'),
    ('b1af56bb-a5da-47a4-b3ba-b274074af49a', '98501d33-c8f4-4fae-a5fe-804dc17f48d5', '22222222-0000-0000-0000-000000000402', 1, '2026-04-15 00:00:00+07'),
    ('2547f8c9-ce41-46d1-8df5-bc7c4596a923', '3271fa4b-0d70-4d21-895a-1e3435973010', '22222222-0000-0000-0000-000000000400', 1, '2026-04-15 00:00:00+07'),
    ('4717ea75-ee72-4c0b-a08f-2ddbb8e95546', '3271fa4b-0d70-4d21-895a-1e3435973010', '22222222-0000-0000-0000-000000000401', 1, '2026-04-15 00:00:00+07'),
    ('f46995b8-0bcb-4afd-b2ff-d132ac54a9f8', '3271fa4b-0d70-4d21-895a-1e3435973010', '22222222-0000-0000-0000-000000000402', 1, '2026-04-15 00:00:00+07'),
    ('fed7c88a-ad5b-494a-84dd-6bf6827a3b0b', '6a6b79a4-dc6f-48c3-91df-730aaa25242c', '22222222-0000-0000-0000-000000000400', 1, '2026-05-15 00:00:00+07'),
    ('e290b714-eb85-4546-8b07-37e563cceac3', '6a6b79a4-dc6f-48c3-91df-730aaa25242c', '22222222-0000-0000-0000-000000000401', 1, '2026-05-15 00:00:00+07'),
    ('4c0c0f8b-d2de-4eb1-a065-0538b9fdccc4', '6a6b79a4-dc6f-48c3-91df-730aaa25242c', '22222222-0000-0000-0000-000000000402', 1, '2026-05-15 00:00:00+07'),
    ('7613076a-3b7f-44fb-bc0b-78c114a74e73', 'f2b49ab6-4214-4309-921e-7f039e9109a4', '22222222-0000-0000-0000-000000000400', 1, '2026-05-15 00:00:00+07'),
    ('1ef568d9-c068-4ce0-921f-5bc6182cc26b', 'f2b49ab6-4214-4309-921e-7f039e9109a4', '22222222-0000-0000-0000-000000000401', 1, '2026-05-15 00:00:00+07'),
    ('3bc9b6b1-635a-4af5-9bd6-463642503d65', 'f2b49ab6-4214-4309-921e-7f039e9109a4', '22222222-0000-0000-0000-000000000402', 1, '2026-05-15 00:00:00+07'),
    ('2cbb27d1-d128-484b-a766-e4d9574478fb', '14bed331-c027-4e62-ab68-ace512f04c58', '22222222-0000-0000-0000-000000000400', 1, '2026-06-15 00:00:00+07'),
    ('6a4cd846-1c50-4691-93e6-672a971f77c8', '14bed331-c027-4e62-ab68-ace512f04c58', '22222222-0000-0000-0000-000000000401', 1, '2026-06-15 00:00:00+07'),
    ('4b2f2029-1788-45f7-b122-cdb8a36e40f9', '14bed331-c027-4e62-ab68-ace512f04c58', '22222222-0000-0000-0000-000000000402', 1, '2026-06-15 00:00:00+07'),
    ('3b309588-919f-465b-92b5-7142294dbc68', '05589489-95ec-4cca-a3a0-de9698b4b06e', '22222222-0000-0000-0000-000000000400', 1, '2026-06-15 00:00:00+07'),
    ('f73d421c-1b21-4c69-bb9f-45b2fa94acee', '05589489-95ec-4cca-a3a0-de9698b4b06e', '22222222-0000-0000-0000-000000000401', 1, '2026-06-15 00:00:00+07'),
    ('460af572-ba72-4e83-9187-001f7218fe40', '05589489-95ec-4cca-a3a0-de9698b4b06e', '22222222-0000-0000-0000-000000000402', 1, '2026-06-15 00:00:00+07'),
    ('9fc7a3aa-0e94-43b4-b54c-2d84e90b4ee8', 'd56e6f48-e0f5-44e9-a032-0c9423a55973', '22222222-0000-0000-0000-000000000600', 1, '2026-04-15 00:00:00+07'),
    ('d16378fa-6505-494e-a45b-6c1bc0dcbf5a', 'd56e6f48-e0f5-44e9-a032-0c9423a55973', '22222222-0000-0000-0000-000000000601', 1, '2026-04-15 00:00:00+07'),
    ('ed5c0a78-35da-4be4-a2ce-62a95b7d6f87', 'd56e6f48-e0f5-44e9-a032-0c9423a55973', '22222222-0000-0000-0000-000000000602', 1, '2026-04-15 00:00:00+07'),
    ('99513066-0f67-4058-b516-20d5f6e64701', 'b494ce35-58ac-42e4-8efb-001c5a07393e', '22222222-0000-0000-0000-000000000600', 1, '2026-04-15 00:00:00+07'),
    ('b163c202-2260-434e-890c-a2821b333ac1', 'b494ce35-58ac-42e4-8efb-001c5a07393e', '22222222-0000-0000-0000-000000000601', 1, '2026-04-15 00:00:00+07'),
    ('369151e1-4cfb-4f5d-ba84-87a85d268326', 'b494ce35-58ac-42e4-8efb-001c5a07393e', '22222222-0000-0000-0000-000000000602', 1, '2026-04-15 00:00:00+07'),
    ('38b5c024-aa5b-4f2c-aa0a-fca83b985f7b', '2eca1dfe-36ac-4359-9a65-ffcbe6c956ad', '22222222-0000-0000-0000-000000000600', 1, '2026-05-15 00:00:00+07'),
    ('10ff9a3c-a7f1-48c6-b9cf-8b3f909e0e8f', '2eca1dfe-36ac-4359-9a65-ffcbe6c956ad', '22222222-0000-0000-0000-000000000601', 1, '2026-05-15 00:00:00+07'),
    ('f9fdc274-4768-4214-846d-a757d1fa650c', '2eca1dfe-36ac-4359-9a65-ffcbe6c956ad', '22222222-0000-0000-0000-000000000602', 1, '2026-05-15 00:00:00+07'),
    ('46c31a21-058c-4490-94a2-9a9b247ea1e3', '97634f31-0aba-46d5-b920-b095ec513b27', '22222222-0000-0000-0000-000000000600', 1, '2026-05-15 00:00:00+07'),
    ('bbb7a395-e2cd-4a4e-a2ea-a8d4fec9cd9d', '97634f31-0aba-46d5-b920-b095ec513b27', '22222222-0000-0000-0000-000000000601', 1, '2026-05-15 00:00:00+07'),
    ('37dc5ba4-2d04-46c0-bd12-f053bf563dab', '97634f31-0aba-46d5-b920-b095ec513b27', '22222222-0000-0000-0000-000000000602', 1, '2026-05-15 00:00:00+07'),
    ('bab2dcc8-dcbc-4f70-a985-efca9195d112', '3d32416c-1169-4384-a3c9-6d890cfd5a59', '22222222-0000-0000-0000-000000000600', 1, '2026-06-15 00:00:00+07'),
    ('a9b88837-dcb7-484a-aa3d-c5e66d0af62d', '3d32416c-1169-4384-a3c9-6d890cfd5a59', '22222222-0000-0000-0000-000000000601', 1, '2026-06-15 00:00:00+07'),
    ('618dc356-95f5-4cea-b730-1e3b68564b46', '3d32416c-1169-4384-a3c9-6d890cfd5a59', '22222222-0000-0000-0000-000000000602', 1, '2026-06-15 00:00:00+07'),
    ('ace0eeff-07b9-48d5-8a85-fd0f87ccab9a', 'e8a1a3a1-bd0a-42ce-a15c-977587238e20', '22222222-0000-0000-0000-000000000600', 1, '2026-06-15 00:00:00+07'),
    ('1d9678bc-5d52-473b-970c-62c1c934f7f7', 'e8a1a3a1-bd0a-42ce-a15c-977587238e20', '22222222-0000-0000-0000-000000000601', 1, '2026-06-15 00:00:00+07'),
    ('1bd184f5-0054-4bde-9b7b-ace7073b4c29', 'e8a1a3a1-bd0a-42ce-a15c-977587238e20', '22222222-0000-0000-0000-000000000602', 1, '2026-06-15 00:00:00+07'),
    ('62f47981-b7a6-4312-986d-66d4049fd663', 'ff24864e-6616-4c4c-947b-cea8defcb7a6', '22222222-0000-0000-0000-000000000700', 1, '2026-04-15 00:00:00+07'),
    ('e15438d5-65fe-447c-89e7-2e1890a9b42c', 'ff24864e-6616-4c4c-947b-cea8defcb7a6', '22222222-0000-0000-0000-000000000701', 1, '2026-04-15 00:00:00+07'),
    ('6f413655-c91e-4f07-8b28-747c38925a74', 'ff24864e-6616-4c4c-947b-cea8defcb7a6', '22222222-0000-0000-0000-000000000702', 1, '2026-04-15 00:00:00+07'),
    ('be089497-2582-4ab5-9b9d-d92909a2c0bf', 'ba76ff1a-2331-4262-98ba-a2c1f480caa8', '22222222-0000-0000-0000-000000000700', 1, '2026-04-15 00:00:00+07'),
    ('9689efab-5fbd-4a65-a949-fec4e30180f5', 'ba76ff1a-2331-4262-98ba-a2c1f480caa8', '22222222-0000-0000-0000-000000000701', 1, '2026-04-15 00:00:00+07'),
    ('8fab83ca-de1e-496a-b886-c620aed59b13', 'ba76ff1a-2331-4262-98ba-a2c1f480caa8', '22222222-0000-0000-0000-000000000702', 1, '2026-04-15 00:00:00+07'),
    ('7c08a5cf-0a4d-4203-b255-2ff22be9b9ab', 'c97782ca-253d-4e9b-b25d-fe527a76245b', '22222222-0000-0000-0000-000000000700', 1, '2026-05-15 00:00:00+07'),
    ('1fd89309-4822-4149-bf43-3488e654ae85', 'c97782ca-253d-4e9b-b25d-fe527a76245b', '22222222-0000-0000-0000-000000000701', 1, '2026-05-15 00:00:00+07'),
    ('89ce5708-c2a4-4123-94e4-32033a7ce4fc', 'c97782ca-253d-4e9b-b25d-fe527a76245b', '22222222-0000-0000-0000-000000000702', 1, '2026-05-15 00:00:00+07'),
    ('4ff55077-7a0e-4084-ad01-8e45a43926ea', '19dcb07f-0539-4ad7-86b8-7deea6ea3ae4', '22222222-0000-0000-0000-000000000700', 1, '2026-05-15 00:00:00+07'),
    ('86d16140-a6e4-4755-9c83-9723089745db', '19dcb07f-0539-4ad7-86b8-7deea6ea3ae4', '22222222-0000-0000-0000-000000000701', 1, '2026-05-15 00:00:00+07'),
    ('7cf33f24-de56-4915-9701-92a1856f07d0', '19dcb07f-0539-4ad7-86b8-7deea6ea3ae4', '22222222-0000-0000-0000-000000000702', 1, '2026-05-15 00:00:00+07'),
    ('65672475-3c65-413a-a516-684137ca129d', '132952bd-3e85-46e1-84a0-93db48abf11f', '22222222-0000-0000-0000-000000000700', 1, '2026-06-15 00:00:00+07'),
    ('89414e7c-e0af-43e8-a2cd-0c85bee2ebfb', '132952bd-3e85-46e1-84a0-93db48abf11f', '22222222-0000-0000-0000-000000000701', 1, '2026-06-15 00:00:00+07'),
    ('73ba44d7-d250-45aa-93dc-17fd1cf1554d', '132952bd-3e85-46e1-84a0-93db48abf11f', '22222222-0000-0000-0000-000000000702', 1, '2026-06-15 00:00:00+07'),
    ('86d8b35a-3a5d-44a4-ac7a-63b3a3ab9a13', '5911285c-12ec-49c5-bf8a-170e8532b9a1', '22222222-0000-0000-0000-000000000700', 1, '2026-06-15 00:00:00+07'),
    ('c5982b65-4504-4126-8468-9c6dcd1d2d5f', '5911285c-12ec-49c5-bf8a-170e8532b9a1', '22222222-0000-0000-0000-000000000701', 1, '2026-06-15 00:00:00+07'),
    ('5fbfac5b-614e-4f89-baa8-bf536bb01390', '5911285c-12ec-49c5-bf8a-170e8532b9a1', '22222222-0000-0000-0000-000000000702', 1, '2026-06-15 00:00:00+07');
 
-- ============================================================
-- 9F. EVALUATIONS  (18 users × 3 periods = 54 rows)
-- ============================================================
INSERT INTO evaluations
    (id, org_unit_id, user_id, kpi_period_id,
     evaluator_id, score, comment, system_score,
     period_start, period_end)
VALUES
    ('99265163-8518-4a27-a47e-8c2c93223116', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-0000-0000-0000-000000000100', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000000200', 94.5, 'Xuất sắc', 95.0,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('60fadbfb-df78-4eea-9adf-3f8ceb4af371', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-0000-0000-0000-000000000100', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000000200', 96.5, 'Xuất sắc', 97.0,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('fce3095e-fa44-492a-813f-8d83e0aceec3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-0000-0000-0000-000000000100', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000000200', 97.5, 'Xuất sắc', 98.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('637d7f7d-ae93-49b1-b3ef-059cbd439f0d', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-0000-0000-0000-000000000200', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000000100', 87.5, 'Tốt', 88.0,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('c46f3191-987d-469e-adfa-03ca15a81038', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-0000-0000-0000-000000000200', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000000100', 89.5, 'Tốt', 90.0,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('8ee6077c-93d8-4332-8797-75ed3b8fbe17', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-0000-0000-0000-000000000200', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000000100', 91.5, 'Tốt', 92.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('f5e0ce62-1dbd-4f05-8c52-5a2fcb3ec1df', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-0000-0000-0000-000000000101', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000000100', 86.2, 'Tốt', 86.7,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('2da6ce33-1271-43ea-9518-019876abb119', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-0000-0000-0000-000000000101', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000000100', 99.5, 'Xuất sắc', 100.0,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('cde15d6e-a251-475d-aae6-d6dc63f1e4ce', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-0000-0000-0000-000000000101', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000000100', 99.5, 'Xuất sắc', 100.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('79dee90a-4fd2-4e0c-9c85-0660e1bfb95f', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-0000-0000-0000-000000000102', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000000100', 77.2, 'Đạt yêu cầu', 77.7,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('eff3345a-6a4a-4992-abd6-c18419a78644', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-0000-0000-0000-000000000102', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000000100', 89.2, 'Tốt', 89.7,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('6daef81d-aa56-4006-945b-ec4be4ca45ea', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-0000-0000-0000-000000000102', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000000100', 99.5, 'Xuất sắc', 100.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('724db3ca-d2a9-4393-a8bd-018dfc01bbc2', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-0000-0000-0000-000000000500', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000000100', 81.5, 'Tốt', 82.0,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('74ac77f5-ba30-4ea6-9aa9-e7c957e02280', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-0000-0000-0000-000000000500', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000000100', 94.2, 'Tốt', 94.7,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('56c91e0d-d607-4158-910b-f77c18576e46', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-0000-0000-0000-000000000500', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000000100', 99.5, 'Xuất sắc', 100.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('8b684b94-a6c3-40ec-ac30-8020409bb019', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-0000-0000-0000-000000000501', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000000100', 74.2, 'Đạt yêu cầu', 74.7,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('f8bfc87b-08f0-422a-b255-a3cea1146593', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-0000-0000-0000-000000000501', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000000100', 84.8, 'Tốt', 85.3,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('ec61f396-6aa6-492d-a547-16a3136ef740', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-0000-0000-0000-000000000501', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000000100', 99.5, 'Xuất sắc', 100.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('04c45c11-698c-4235-9402-445bf609f381', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-0000-0000-0000-000000000300', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000000101', 86.2, 'Tốt', 86.7,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('c098e139-ee79-40b9-9d36-167b82d2bc0d', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-0000-0000-0000-000000000300', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000000101', 99.5, 'Xuất sắc', 100.0,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('336d8f84-8bf9-4249-8bae-b6cca128ebe3', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-0000-0000-0000-000000000300', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000000101', 99.5, 'Xuất sắc', 100.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('0b4dc8ef-af3e-4791-8b7e-3f3c7e9f29a5', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-0000-0000-0000-000000000301', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000000101', 76.2, 'Đạt yêu cầu', 76.7,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('76979e98-9338-40da-a3b8-c69491bf3332', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-0000-0000-0000-000000000301', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000000101', 92.0, 'Tốt', 92.5,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('d9a9b3d4-f8ce-4bb0-bc40-fa281712f45e', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-0000-0000-0000-000000000301', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000000101', 99.5, 'Xuất sắc', 100.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('9b89a6c4-e570-459d-9269-01ce039be190', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-0000-0000-0000-000000000103', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000000101', 67.8, 'Đạt yêu cầu', 68.3,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('dd606799-ae66-4a9f-97cc-bee7f80b67f1', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-0000-0000-0000-000000000103', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000000101', 82.0, 'Tốt', 82.5,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('4c31832a-3c44-46b6-a7de-e7b3416d49a7', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-0000-0000-0000-000000000103', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000000101', 96.2, 'Xuất sắc', 96.7,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('3b21d585-4493-4164-b175-d22febb05273', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-0000-0000-0000-000000000400', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000000101', 89.9, 'Tốt', 90.4,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('09f8890a-a48c-46ce-bff4-b5f20c715d4d', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-0000-0000-0000-000000000400', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000000101', 99.5, 'Xuất sắc', 100.0,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('46de90e8-f82c-4b99-a8e2-56991cc7274a', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-0000-0000-0000-000000000400', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000000101', 99.5, 'Xuất sắc', 100.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('5ed00139-83e8-49dc-aaf7-9bbfabaed1a0', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-0000-0000-0000-000000000401', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000000101', 83.6, 'Tốt', 84.1,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('4f70b0f6-5070-496e-83d1-cf8a7baf44bf', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-0000-0000-0000-000000000401', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000000101', 94.4, 'Tốt', 94.9,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('859d9032-f167-4bb8-b884-67c4ea318150', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-0000-0000-0000-000000000401', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000000101', 99.5, 'Xuất sắc', 100.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('f2451381-f4ba-447a-bc68-b414b6d7b231', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-0000-0000-0000-000000000402', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000000101', 78.6, 'Đạt yêu cầu', 79.1,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('194bdeb5-8fb4-4b26-8060-9d67f7439bce', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-0000-0000-0000-000000000402', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000000101', 88.7, 'Tốt', 89.2,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('2df21ea2-2a42-4e69-93b8-92108a5917c5', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-0000-0000-0000-000000000402', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000000101', 99.5, 'Xuất sắc', 100.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('89e24f7b-1bb8-48a4-b23b-0178e9cd6075', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-0000-0000-0000-000000000600', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000000500', 87.6, 'Tốt', 88.1,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('f57535cb-87bc-4125-9821-6baa1e82fd21', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-0000-0000-0000-000000000600', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000000500', 99.5, 'Xuất sắc', 100.0,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('32e088a8-fbec-4297-a20a-ed54b7fd045f', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-0000-0000-0000-000000000600', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000000500', 99.5, 'Xuất sắc', 100.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('0d83cfae-79eb-4339-8e4b-7007268e326f', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-0000-0000-0000-000000000601', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000000500', 80.3, 'Tốt', 80.8,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('fc58e31d-fd72-4b54-beef-669173e8f6be', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-0000-0000-0000-000000000601', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000000500', 91.7, 'Tốt', 92.2,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('f7889aed-3658-48d4-b408-7cea38d4939b', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-0000-0000-0000-000000000601', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000000500', 99.5, 'Xuất sắc', 100.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('3f9d58e4-9ee5-46c5-9011-e5cfcf7954d3', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-0000-0000-0000-000000000602', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000000500', 75.6, 'Đạt yêu cầu', 76.1,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('5d8ac939-43f8-48f2-b0b7-b74119c2884e', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-0000-0000-0000-000000000602', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000000500', 86.4, 'Tốt', 86.9,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('99ff88ac-6e0f-4f36-accf-aa1e67e6ffb6', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-0000-0000-0000-000000000602', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000000500', 98.4, 'Xuất sắc', 98.9,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('adfea39c-ecc4-4bc8-ac87-d43602dc1c30', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '22222222-0000-0000-0000-000000000700', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000000500', 90.4, 'Tốt', 90.9,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('ae3d00a9-848d-4623-ad21-aae650dc08ee', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '22222222-0000-0000-0000-000000000700', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000000500', 99.5, 'Xuất sắc', 100.0,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('d30ce56d-0885-4193-a195-0ddffff09cb9', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '22222222-0000-0000-0000-000000000700', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000000500', 99.5, 'Xuất sắc', 100.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('7218bca0-e97e-4f7b-8591-dc5c731a8494', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '22222222-0000-0000-0000-000000000701', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000000500', 80.0, 'Tốt', 80.5,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('db0f07f2-c8d1-42b2-a081-3d9211281d95', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '22222222-0000-0000-0000-000000000701', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000000500', 90.4, 'Tốt', 90.9,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('8bb79e43-ded5-490f-824a-eb18df84a176', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '22222222-0000-0000-0000-000000000701', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000000500', 99.5, 'Xuất sắc', 100.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('3eda25b5-b10e-4852-ae01-4b20ea9b642c', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '22222222-0000-0000-0000-000000000702', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000000500', 72.9, 'Đạt yêu cầu', 73.4,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('67dd1906-945f-41c6-98fe-5500f23144a0', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '22222222-0000-0000-0000-000000000702', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000000500', 83.3, 'Tốt', 83.8,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('3e1a7532-0ad4-48e5-98e0-ca5c8868f455', 'abcdefab-cdef-cdef-cdef-abcdefabcdef', '22222222-0000-0000-0000-000000000702', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000000500', 96.3, 'Xuất sắc', 96.8,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07');

-- ============================================================
-- 10. SIDEBAR CUSTOM LABELS
-- ============================================================
INSERT INTO sidebar_settings (id, organization_id, menu_key, custom_label) VALUES
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/dashboard', 'Tổng quan'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/dashboard?view=staff', 'Dashboard cá nhân'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Thiết lập công ty', 'Thiết lập công ty'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/company', 'Thông tin công ty'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Tổ chức', 'Tổ chức'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/roles', 'Phân quyền vai trò'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/org-structure', 'Cấu trúc tổ chức'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/users', 'Quản lý nhân sự'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/settings', 'Cấu hình hệ thống'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Quản lý KPI', 'Quản trị KPI'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/kpi-periods', 'Danh mục đợt KPI'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/kpi-criteria', 'Thiết lập chỉ tiêu'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/kpi-criteria/pending', 'Phê duyệt chỉ tiêu'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/kpi-adjustments/pending', 'Duyệt điều chỉnh'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/submissions/org-unit', 'Kiểm soát bài nộp'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/evaluations', 'Đánh giá xếp loại'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/my-kpi', 'KPI của tôi'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/my-adjustments', 'Yêu cầu điều chỉnh'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/submissions', 'Lịch sử báo cáo'),
    (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '/analytics', 'Phân tích & Thống kê');



-- ===========================================================
-- Demo Education
-- 1 Khoa (CNTT) → 2 Bộ môn (KTPM, MANG)
-- KPI chỉ giao cho Bộ môn. Khoa không có KPI.
-- Users: 12 | KPI periods: T4/T5/T6 2026
-- Sections: Geography · Org · Hierarchy · Units · Roles ·
--           Permissions · Role-Perms · Users · UserRoleOrg ·
--           Periods · Criteria · Assignees · Submissions ·
--           Reminders · Evaluations · Policies · Sidebar
-- ===========================================================

-- 2. ORGANIZATION
INSERT INTO organizations
    (id, name, code, evaluation_max_score, kpi_reminder_percentage)
VALUES
    ('22222222-2222-2222-2222-222222222222',
     'Demo Education', 'DEMO', 100.0, 50)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, code=EXCLUDED.code;

INSERT INTO evaluation_levels (organization_id, name, threshold, color) VALUES
    ('22222222-2222-2222-2222-222222222222', 'XUẤT SẮC',   90.0, '#10b981'),
    ('22222222-2222-2222-2222-222222222222', 'TỐT',        80.0, '#3b82f6'),
    ('22222222-2222-2222-2222-222222222222', 'KHÁ',        70.0, '#f59e0b'),
    ('22222222-2222-2222-2222-222222222222', 'TRUNG BÌNH', 50.0, '#6366f1'),
    ('22222222-2222-2222-2222-222222222222', 'YẾU',         0.0, '#ef4444')
ON CONFLICT DO NOTHING;

-- 3. ORG HIERARCHY LEVELS
INSERT INTO org_hierarchy_levels
    (id, organization_id, level_order, unit_type_name, manager_role_label, role_level)
VALUES
    ('31111111-1111-1111-1111-111111111111',
     '22222222-2222-2222-2222-222222222222', 0, 'Khoa',   'Trưởng khoa',   3),
    ('32222222-2222-2222-2222-222222222222',
     '22222222-2222-2222-2222-222222222222', 1, 'Bộ môn', 'Trưởng bộ môn', 4)
ON CONFLICT (id) DO NOTHING;

-- 4. ORG UNITS
INSERT INTO org_units
    (id, name, code, parent_id, org_hierarchy_id, district_id, status)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Khoa Công nghệ thông tin', 'CNTT',
     NULL, '31111111-1111-1111-1111-111111111111',
     'b1000000-0000-0000-0000-000000000001', 'ACTIVE'),
    ('b0000000-0000-0000-0000-000000000001', 'Bộ môn Kỹ thuật phần mềm', 'KTPM',
     'a0000000-0000-0000-0000-000000000001', '32222222-2222-2222-2222-222222222222',
     'b1000000-0000-0000-0000-000000000001', 'ACTIVE'),
    ('b0000000-0000-0000-0000-000000000002', 'Bộ môn Mạng & An toàn thông tin', 'MANG',
     'a0000000-0000-0000-0000-000000000001', '32222222-2222-2222-2222-222222222222',
     'b1000000-0000-0000-0000-000000000001', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 5. ROLES
INSERT INTO roles (id, organization_id, name, level, rank, is_system) VALUES
    ('c3000000-0000-0000-0000-000000000001',
     '22222222-2222-2222-2222-222222222222', 'Trưởng khoa',   3, 0, false),
    ('c3000000-0000-0000-0000-000000000002',
     '22222222-2222-2222-2222-222222222222', 'Phó khoa',      3, 1, false),
    ('c4000000-0000-0000-0000-000000000001',
     '22222222-2222-2222-2222-222222222222', 'Trưởng bộ môn', 4, 0, false),
    ('c4000000-0000-0000-0000-000000000002',
     '22222222-2222-2222-2222-222222222222', 'Phó bộ môn',    4, 1, false),
    ('c4000000-0000-0000-0000-000000000003',
     '22222222-2222-2222-2222-222222222222', 'Sinh viên',     4, 2, false)
ON CONFLICT (id) DO NOTHING;

-- 7. ROLE PERMISSIONS
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'c3000000-0000-0000-0000-000000000001', id FROM permissions WHERE code IN ('DASHBOARD:VIEW', 'COMPANY:VIEW', 'COMPANY:UPDATE', 'ORG:VIEW', 'ORG:CREATE', 'ORG:UPDATE', 'ORG:DELETE', 'USER:VIEW', 'USER:CREATE', 'USER:UPDATE', 'USER:DELETE', 'USER:IMPORT', 'ROLE:VIEW', 'ROLE:ASSIGN', 'ROLE:CREATE', 'ROLE:UPDATE', 'PERMISSION:VIEW', 'KPI:VIEW', 'KPI:CREATE', 'KPI:UPDATE', 'KPI:DELETE', 'KPI:APPROVE_CRITERIA', 'KPI:APPROVE_ADJUSTMENT', 'KPI:IMPORT', 'KPI:SUBMIT', 'KPI:REJECT', 'KPI_PERIOD:VIEW', 'KPI_PERIOD:CREATE', 'KPI_PERIOD:UPDATE', 'KPI_PERIOD:DELETE', 'SUBMISSION:REVIEW', 'SUBMISSION:VIEW', 'SUBMISSION:DELETE', 'SUBMISSION:UPDATE', 'EVALUATION:VIEW', 'EVALUATION:CREATE', 'EVALUATION:UPDATE', 'EVALUATION:DELETE', 'NOTIF:VIEW', 'NOTIF:MANAGE', 'AI:SUGGEST_KPI', 'POLICY:VIEW', 'POLICY:CREATE', 'POLICY:UPDATE', 'POLICY:ASSIGN', 'STATS:VIEW_ORG', 'STATS:VIEW_EMPLOYEE', 'USER_ROLE:VIEW', 'USER_ROLE:ASSIGN', 'USER_ROLE:REVOKE', 'ATTACHMENT:UPLOAD', 'ATTACHMENT:DELETE', 'REMINDER:SEND', 'SYSTEM:ADMIN', 'COMPANY:DELETE', 'ROLE:DELETE', 'POLICY:DELETE', 'PERMISSION:EDIT')
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'c3000000-0000-0000-0000-000000000002', id FROM permissions WHERE code IN ('DASHBOARD:VIEW', 'COMPANY:VIEW', 'ORG:VIEW', 'ORG:CREATE', 'ORG:UPDATE', 'USER:VIEW', 'USER:CREATE', 'USER:UPDATE', 'USER:IMPORT', 'ROLE:VIEW', 'ROLE:ASSIGN', 'ROLE:CREATE', 'ROLE:UPDATE', 'PERMISSION:VIEW', 'KPI:VIEW', 'KPI:CREATE', 'KPI:UPDATE', 'KPI:APPROVE_CRITERIA', 'KPI:APPROVE_ADJUSTMENT', 'KPI:IMPORT', 'KPI:SUBMIT', 'KPI:REJECT', 'KPI_PERIOD:VIEW', 'KPI_PERIOD:CREATE', 'KPI_PERIOD:UPDATE', 'SUBMISSION:REVIEW', 'SUBMISSION:VIEW', 'SUBMISSION:UPDATE', 'EVALUATION:VIEW', 'EVALUATION:CREATE', 'EVALUATION:UPDATE', 'NOTIF:VIEW', 'NOTIF:MANAGE', 'AI:SUGGEST_KPI', 'POLICY:VIEW', 'POLICY:CREATE', 'POLICY:UPDATE', 'POLICY:ASSIGN', 'STATS:VIEW_ORG', 'STATS:VIEW_EMPLOYEE', 'USER_ROLE:VIEW', 'USER_ROLE:ASSIGN', 'ATTACHMENT:UPLOAD', 'REMINDER:SEND', 'COMPANY:DELETE', 'ROLE:DELETE', 'POLICY:DELETE', 'PERMISSION:EDIT')
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'c4000000-0000-0000-0000-000000000001', id FROM permissions WHERE code IN ('DASHBOARD:VIEW', 'ORG:VIEW_TREE', 'USER:VIEW_LIST', 'KPI:VIEW', 'KPI:CREATE', 'KPI:UPDATE', 'KPI:DELETE', 'KPI:APPROVE_CRITERIA', 'KPI:APPROVE_ADJUSTMENT', 'KPI:IMPORT', 'KPI:SUBMIT', 'KPI:REJECT', 'KPI_PERIOD:VIEW', 'SUBMISSION:VIEW', 'SUBMISSION:REVIEW', 'SUBMISSION:REVIEW_KPI', 'EVALUATION:VIEW', 'EVALUATION:CREATE', 'NOTIF:VIEW', 'AI:SUGGEST_KPI', 'STATS:VIEW_EMPLOYEE', 'ATTACHMENT:UPLOAD', 'REMINDER:SEND', 'KPI:VIEW_MY', 'SUBMISSION:VIEW_MY', 'STATS:VIEW_MY', 'ADJUSTMENT:VIEW_MY')
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'c4000000-0000-0000-0000-000000000002', id FROM permissions WHERE code IN ('DASHBOARD:VIEW', 'ORG:VIEW_TREE', 'USER:VIEW_LIST', 'KPI:VIEW', 'KPI:CREATE','KPI:UPDATE', 'KPI:DELETE', 'KPI:IMPORT', 'KPI:SUBMIT', 'KPI:REJECT', 'KPI_PERIOD:VIEW', 'SUBMISSION:VIEW', 'SUBMISSION:REVIEW_KPI', 'EVALUATION:VIEW', 'EVALUATION:CREATE', 'NOTIF:VIEW', 'AI:SUGGEST_KPI', 'STATS:VIEW_EMPLOYEE', 'ATTACHMENT:UPLOAD', 'REMINDER:SEND', 'KPI:VIEW_MY', 'SUBMISSION:VIEW_MY', 'EVALUATION:VIEW_MY', 'STATS:VIEW_MY', 'ADJUSTMENT:VIEW_MY')
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'c4000000-0000-0000-0000-000000000003', id FROM permissions WHERE code IN ('DASHBOARD:VIEW', 'KPI:VIEW', 'KPI:CREATE','KPI:UPDATE', 'KPI:DELETE', 'KPI:IMPORT', 'KPI:SUBMIT', 'KPI_PERIOD:VIEW', 'SUBMISSION:CREATE', 'EVALUATION:VIEW', 'EVALUATION:CREATE', 'NOTIF:VIEW', 'ATTACHMENT:UPLOAD', 'KPI:VIEW_MY', 'SUBMISSION:VIEW_MY', 'EVALUATION:VIEW_MY', 'STATS:VIEW_MY', 'ADJUSTMENT:VIEW_MY')
ON CONFLICT DO NOTHING;

-- 8. USERS  (12 users, password = Demo123@)
INSERT INTO users
    (id, email, password, full_name, employee_code, phone,
     status, is_email_verified, has_seen_onboarding)
VALUES
    ('22222222-0000-0000-0000-000000001001', 'truong.khoa.cntt@demo.edu.vn', '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q',
     'Nguyễn Văn An', 'GV001', '0900001001', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000001002', 'pho.khoa.cntt@demo.edu.vn', '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q',
     'Trần Thị Bình', 'GV002', '0900001002', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000001101', 'truong.bm.ktpm@demo.edu.vn', '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q',
     'Lê Văn Cường', 'GV003', '0900001101', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000001102', 'pho.bm.ktpm@demo.edu.vn', '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q',
     'Phạm Thị Dung', 'GV004', '0900001102', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000001103', 'sv.ktpm.001@demo.edu.vn', '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q',
     'Hoàng Văn Em', 'SV001', '0900001103', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000001104', 'sv.ktpm.002@demo.edu.vn', '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q',
     'Vũ Thị Phương', 'SV002', '0900001104', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000001105', 'sv.ktpm.003@demo.edu.vn', '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q',
     'Đặng Văn Giang', 'SV003', '0900001105', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000001201', 'truong.bm.mang@demo.edu.vn', '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q',
     'Bùi Thị Hoa', 'GV005', '0900001201', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000001202', 'pho.bm.mang@demo.edu.vn', '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q',
     'Đỗ Văn Hải', 'GV006', '0900001202', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000001203', 'sv.mang.001@demo.edu.vn', '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q',
     'Hồ Thị Lan', 'SV004', '0900001203', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000001204', 'sv.mang.002@demo.edu.vn', '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q',
     'Phan Văn Minh', 'SV005', '0900001204', 'ACTIVE', true, false),
    ('22222222-0000-0000-0000-000000001205', 'sv.mang.003@demo.edu.vn', '$2a$12$w0uxjEGJpZyIwOHvTw6XQeS5HMbLLELeH5qdzr610d.RGEW9P.x8q',
     'Võ Thị Nam', 'SV006', '0900001205', 'ACTIVE', true, false)
ON CONFLICT (id) DO NOTHING;

-- 9. USER ROLE ORG UNITS
INSERT INTO user_role_org_units (user_id, role_id, org_unit_id) VALUES
    ('22222222-0000-0000-0000-000000001001',   'c3000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),
    ('22222222-0000-0000-0000-000000001002', 'c3000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001'),
    ('22222222-0000-0000-0000-000000001101',   'c4000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001'),
    ('22222222-0000-0000-0000-000000001102', 'c4000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001'),
    ('22222222-0000-0000-0000-000000001103', 'c4000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001'),
    ('22222222-0000-0000-0000-000000001104', 'c4000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001'),
    ('22222222-0000-0000-0000-000000001105', 'c4000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001'),
    ('22222222-0000-0000-0000-000000001201',   'c4000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002'),
    ('22222222-0000-0000-0000-000000001202', 'c4000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002'),
    ('22222222-0000-0000-0000-000000001203', 'c4000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002'),
    ('22222222-0000-0000-0000-000000001204', 'c4000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002'),
    ('22222222-0000-0000-0000-000000001205', 'c4000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

-- 10. KPI PERIODS
INSERT INTO kpi_periods
    (id, organization_id, name, period_type, start_date, end_date, notification_date)
VALUES
    ('33333333-0000-0000-0000-000000000101', '22222222-2222-2222-2222-222222222222',
     'Tháng 4-2026', 'MONTHLY',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07', '2026-04-15 00:00:00+07'),
    ('33333333-0000-0000-0000-000000000102', '22222222-2222-2222-2222-222222222222',
     'Tháng 5-2026', 'MONTHLY',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07', '2026-05-15 00:00:00+07'),
    ('33333333-0000-0000-0000-000000000103', '22222222-2222-2222-2222-222222222222',
     'Tháng 6-2026', 'MONTHLY',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07', '2026-06-15 00:00:00+07')
ON CONFLICT (id) DO NOTHING;

-- 11. KPI CRITERIA  (2 BM × 2 KPI × 3 periods = 12 rows)
INSERT INTO kpi_criteria
    (id, org_unit_id, kpi_period_id, name, description, weight,
     target_value, minimum_value, unit, frequency, status,
     created_by, approved_by, submitted_at, approved_at)
VALUES
    ('d65c5ad1-8dad-4284-b070-3340d575b671', 'b0000000-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000101',
     'Điểm trung bình môn học', 'Điểm TB các môn học trong tháng (thang 10)', 50,
     7.5, 5.0, 'điểm',
     'MONTHLY', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', '22222222-0000-0000-0000-000000001001',
     '2026-04-02 08:00:00+07', '2026-04-03 08:00:00+07'),
    ('dd10e330-fe48-42d3-96f2-4167272bfc56', 'b0000000-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000101',
     'Điểm rèn luyện', 'Điểm rèn luyện tháng (thang 100)', 50,
     80, 50, 'điểm',
     'MONTHLY', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', '22222222-0000-0000-0000-000000001001',
     '2026-04-02 08:00:00+07', '2026-04-03 08:00:00+07'),
    ('4a6cb8fe-1a78-4740-860d-a89fa5dea766', 'b0000000-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000102',
     'Điểm trung bình môn học', 'Điểm TB các môn học trong tháng (thang 10)', 50,
     7.5, 5.0, 'điểm',
     'MONTHLY', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', '22222222-0000-0000-0000-000000001001',
     '2026-05-02 08:00:00+07', '2026-05-03 08:00:00+07'),
    ('69303880-b11a-4005-9125-14fec645f4eb', 'b0000000-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000102',
     'Điểm rèn luyện', 'Điểm rèn luyện tháng (thang 100)', 50,
     80, 50, 'điểm',
     'MONTHLY', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', '22222222-0000-0000-0000-000000001001',
     '2026-05-02 08:00:00+07', '2026-05-03 08:00:00+07'),
    ('36ab170d-0741-4f0b-8ff5-6e183deabd19', 'b0000000-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000103',
     'Điểm trung bình môn học', 'Điểm TB các môn học trong tháng (thang 10)', 50,
     7.5, 5.0, 'điểm',
     'MONTHLY', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', '22222222-0000-0000-0000-000000001001',
     '2026-06-02 08:00:00+07', '2026-06-03 08:00:00+07'),
    ('a9a66314-7a25-4afe-b288-6336cfcca472', 'b0000000-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000103',
     'Điểm rèn luyện', 'Điểm rèn luyện tháng (thang 100)', 50,
     80, 50, 'điểm',
     'MONTHLY', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', '22222222-0000-0000-0000-000000001001',
     '2026-06-02 08:00:00+07', '2026-06-03 08:00:00+07'),
    ('2f4bb251-bea1-4dfd-91be-6457c7c520fc', 'b0000000-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000101',
     'Điểm trung bình môn học', 'Điểm TB các môn học trong tháng (thang 10)', 50,
     7.5, 5.0, 'điểm',
     'MONTHLY', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', '22222222-0000-0000-0000-000000001001',
     '2026-04-02 08:00:00+07', '2026-04-03 08:00:00+07'),
    ('4dc534e7-1b2d-4afc-a6db-dfb956187321', 'b0000000-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000101',
     'Điểm rèn luyện', 'Điểm rèn luyện tháng (thang 100)', 50,
     80, 50, 'điểm',
     'MONTHLY', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', '22222222-0000-0000-0000-000000001001',
     '2026-04-02 08:00:00+07', '2026-04-03 08:00:00+07'),
    ('8d905099-ca54-43c1-906f-c9cb94ce1f85', 'b0000000-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000102',
     'Điểm trung bình môn học', 'Điểm TB các môn học trong tháng (thang 10)', 50,
     7.5, 5.0, 'điểm',
     'MONTHLY', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', '22222222-0000-0000-0000-000000001001',
     '2026-05-02 08:00:00+07', '2026-05-03 08:00:00+07'),
    ('afe5133c-b8a7-4cb2-adee-65f0ad08637d', 'b0000000-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000102',
     'Điểm rèn luyện', 'Điểm rèn luyện tháng (thang 100)', 50,
     80, 50, 'điểm',
     'MONTHLY', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', '22222222-0000-0000-0000-000000001001',
     '2026-05-02 08:00:00+07', '2026-05-03 08:00:00+07'),
    ('62426faa-587f-4192-ad04-009960aff719', 'b0000000-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000103',
     'Điểm trung bình môn học', 'Điểm TB các môn học trong tháng (thang 10)', 50,
     7.5, 5.0, 'điểm',
     'MONTHLY', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', '22222222-0000-0000-0000-000000001001',
     '2026-06-02 08:00:00+07', '2026-06-03 08:00:00+07'),
    ('6c345520-98c2-4cbd-8b14-8304da50333a', 'b0000000-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000103',
     'Điểm rèn luyện', 'Điểm rèn luyện tháng (thang 100)', 50,
     80, 50, 'điểm',
     'MONTHLY', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', '22222222-0000-0000-0000-000000001001',
     '2026-06-02 08:00:00+07', '2026-06-03 08:00:00+07');

-- 12. KPI CRITERIA ASSIGNEES  (2 BM × 2 KPI × 5 members × 3 periods = 60 rows)
INSERT INTO kpi_criteria_assignees (kpi_criteria_id, user_id) VALUES
    ('d65c5ad1-8dad-4284-b070-3340d575b671', '22222222-0000-0000-0000-000000001101'),
    ('d65c5ad1-8dad-4284-b070-3340d575b671', '22222222-0000-0000-0000-000000001102'),
    ('d65c5ad1-8dad-4284-b070-3340d575b671', '22222222-0000-0000-0000-000000001103'),
    ('d65c5ad1-8dad-4284-b070-3340d575b671', '22222222-0000-0000-0000-000000001104'),
    ('d65c5ad1-8dad-4284-b070-3340d575b671', '22222222-0000-0000-0000-000000001105'),
    ('dd10e330-fe48-42d3-96f2-4167272bfc56', '22222222-0000-0000-0000-000000001101'),
    ('dd10e330-fe48-42d3-96f2-4167272bfc56', '22222222-0000-0000-0000-000000001102'),
    ('dd10e330-fe48-42d3-96f2-4167272bfc56', '22222222-0000-0000-0000-000000001103'),
    ('dd10e330-fe48-42d3-96f2-4167272bfc56', '22222222-0000-0000-0000-000000001104'),
    ('dd10e330-fe48-42d3-96f2-4167272bfc56', '22222222-0000-0000-0000-000000001105'),
    ('4a6cb8fe-1a78-4740-860d-a89fa5dea766', '22222222-0000-0000-0000-000000001101'),
    ('4a6cb8fe-1a78-4740-860d-a89fa5dea766', '22222222-0000-0000-0000-000000001102'),
    ('4a6cb8fe-1a78-4740-860d-a89fa5dea766', '22222222-0000-0000-0000-000000001103'),
    ('4a6cb8fe-1a78-4740-860d-a89fa5dea766', '22222222-0000-0000-0000-000000001104'),
    ('4a6cb8fe-1a78-4740-860d-a89fa5dea766', '22222222-0000-0000-0000-000000001105'),
    ('69303880-b11a-4005-9125-14fec645f4eb', '22222222-0000-0000-0000-000000001101'),
    ('69303880-b11a-4005-9125-14fec645f4eb', '22222222-0000-0000-0000-000000001102'),
    ('69303880-b11a-4005-9125-14fec645f4eb', '22222222-0000-0000-0000-000000001103'),
    ('69303880-b11a-4005-9125-14fec645f4eb', '22222222-0000-0000-0000-000000001104'),
    ('69303880-b11a-4005-9125-14fec645f4eb', '22222222-0000-0000-0000-000000001105'),
    ('36ab170d-0741-4f0b-8ff5-6e183deabd19', '22222222-0000-0000-0000-000000001101'),
    ('36ab170d-0741-4f0b-8ff5-6e183deabd19', '22222222-0000-0000-0000-000000001102'),
    ('36ab170d-0741-4f0b-8ff5-6e183deabd19', '22222222-0000-0000-0000-000000001103'),
    ('36ab170d-0741-4f0b-8ff5-6e183deabd19', '22222222-0000-0000-0000-000000001104'),
    ('36ab170d-0741-4f0b-8ff5-6e183deabd19', '22222222-0000-0000-0000-000000001105'),
    ('a9a66314-7a25-4afe-b288-6336cfcca472', '22222222-0000-0000-0000-000000001101'),
    ('a9a66314-7a25-4afe-b288-6336cfcca472', '22222222-0000-0000-0000-000000001102'),
    ('a9a66314-7a25-4afe-b288-6336cfcca472', '22222222-0000-0000-0000-000000001103'),
    ('a9a66314-7a25-4afe-b288-6336cfcca472', '22222222-0000-0000-0000-000000001104'),
    ('a9a66314-7a25-4afe-b288-6336cfcca472', '22222222-0000-0000-0000-000000001105'),
    ('2f4bb251-bea1-4dfd-91be-6457c7c520fc', '22222222-0000-0000-0000-000000001201'),
    ('2f4bb251-bea1-4dfd-91be-6457c7c520fc', '22222222-0000-0000-0000-000000001202'),
    ('2f4bb251-bea1-4dfd-91be-6457c7c520fc', '22222222-0000-0000-0000-000000001203'),
    ('2f4bb251-bea1-4dfd-91be-6457c7c520fc', '22222222-0000-0000-0000-000000001204'),
    ('2f4bb251-bea1-4dfd-91be-6457c7c520fc', '22222222-0000-0000-0000-000000001205'),
    ('4dc534e7-1b2d-4afc-a6db-dfb956187321', '22222222-0000-0000-0000-000000001201'),
    ('4dc534e7-1b2d-4afc-a6db-dfb956187321', '22222222-0000-0000-0000-000000001202'),
    ('4dc534e7-1b2d-4afc-a6db-dfb956187321', '22222222-0000-0000-0000-000000001203'),
    ('4dc534e7-1b2d-4afc-a6db-dfb956187321', '22222222-0000-0000-0000-000000001204'),
    ('4dc534e7-1b2d-4afc-a6db-dfb956187321', '22222222-0000-0000-0000-000000001205'),
    ('8d905099-ca54-43c1-906f-c9cb94ce1f85', '22222222-0000-0000-0000-000000001201'),
    ('8d905099-ca54-43c1-906f-c9cb94ce1f85', '22222222-0000-0000-0000-000000001202'),
    ('8d905099-ca54-43c1-906f-c9cb94ce1f85', '22222222-0000-0000-0000-000000001203'),
    ('8d905099-ca54-43c1-906f-c9cb94ce1f85', '22222222-0000-0000-0000-000000001204'),
    ('8d905099-ca54-43c1-906f-c9cb94ce1f85', '22222222-0000-0000-0000-000000001205'),
    ('afe5133c-b8a7-4cb2-adee-65f0ad08637d', '22222222-0000-0000-0000-000000001201'),
    ('afe5133c-b8a7-4cb2-adee-65f0ad08637d', '22222222-0000-0000-0000-000000001202'),
    ('afe5133c-b8a7-4cb2-adee-65f0ad08637d', '22222222-0000-0000-0000-000000001203'),
    ('afe5133c-b8a7-4cb2-adee-65f0ad08637d', '22222222-0000-0000-0000-000000001204'),
    ('afe5133c-b8a7-4cb2-adee-65f0ad08637d', '22222222-0000-0000-0000-000000001205'),
    ('62426faa-587f-4192-ad04-009960aff719', '22222222-0000-0000-0000-000000001201'),
    ('62426faa-587f-4192-ad04-009960aff719', '22222222-0000-0000-0000-000000001202'),
    ('62426faa-587f-4192-ad04-009960aff719', '22222222-0000-0000-0000-000000001203'),
    ('62426faa-587f-4192-ad04-009960aff719', '22222222-0000-0000-0000-000000001204'),
    ('62426faa-587f-4192-ad04-009960aff719', '22222222-0000-0000-0000-000000001205'),
    ('6c345520-98c2-4cbd-8b14-8304da50333a', '22222222-0000-0000-0000-000000001201'),
    ('6c345520-98c2-4cbd-8b14-8304da50333a', '22222222-0000-0000-0000-000000001202'),
    ('6c345520-98c2-4cbd-8b14-8304da50333a', '22222222-0000-0000-0000-000000001203'),
    ('6c345520-98c2-4cbd-8b14-8304da50333a', '22222222-0000-0000-0000-000000001204'),
    ('6c345520-98c2-4cbd-8b14-8304da50333a', '22222222-0000-0000-0000-000000001205');

-- 13. KPI SUBMISSIONS  (2 BM × 5 members × 2 KPI × 3 periods = 60 rows)
INSERT INTO kpi_submissions
    (id, org_unit_id, kpi_criteria_id, submitted_by,
     actual_value, auto_score, note, status,
     reviewed_by, review_note, reviewed_at, period_start, period_end)
VALUES
    ('37d9e08e-4779-454b-8833-c967b3e80ec0', 'b0000000-0000-0000-0000-000000000001', 'd65c5ad1-8dad-4284-b070-3340d575b671', '22222222-0000-0000-0000-000000001101',
     7.2, 48.0, '7.2 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('fb4ac0f6-d6e2-4137-bdd6-2b408170863d', 'b0000000-0000-0000-0000-000000000001', 'dd10e330-fe48-42d3-96f2-4167272bfc56', '22222222-0000-0000-0000-000000001101',
     78, 48.8, '78 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('3755f8e4-603f-44c5-bcad-260d51faca13', 'b0000000-0000-0000-0000-000000000001', 'd65c5ad1-8dad-4284-b070-3340d575b671', '22222222-0000-0000-0000-000000001102',
     6.8, 45.3, '6.8 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('355941d1-f2f0-4c8b-96dd-b1ddc47bc1b9', 'b0000000-0000-0000-0000-000000000001', 'dd10e330-fe48-42d3-96f2-4167272bfc56', '22222222-0000-0000-0000-000000001102',
     72, 45.0, '72 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('334cecf6-0a8e-4c0e-aaf4-5c37cebc7833', 'b0000000-0000-0000-0000-000000000001', 'd65c5ad1-8dad-4284-b070-3340d575b671', '22222222-0000-0000-0000-000000001103',
     6.5, 43.3, '6.5 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('1d5761c6-992a-4e9f-8a48-d69f6c9e50d1', 'b0000000-0000-0000-0000-000000000001', 'dd10e330-fe48-42d3-96f2-4167272bfc56', '22222222-0000-0000-0000-000000001103',
     68, 42.5, '68 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('ae3b71c2-8f50-455b-ba2a-7204c28f5561', 'b0000000-0000-0000-0000-000000000001', 'd65c5ad1-8dad-4284-b070-3340d575b671', '22222222-0000-0000-0000-000000001104',
     7.0, 46.7, '7.0 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('38f3c9f4-d011-4cef-9465-a57e43ce828e', 'b0000000-0000-0000-0000-000000000001', 'dd10e330-fe48-42d3-96f2-4167272bfc56', '22222222-0000-0000-0000-000000001104',
     75, 46.9, '75 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('f1e3d19a-8a0e-44ac-b768-385c3e16de67', 'b0000000-0000-0000-0000-000000000001', 'd65c5ad1-8dad-4284-b070-3340d575b671', '22222222-0000-0000-0000-000000001105',
     5.8, 38.7, '5.8 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Đạt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('7ec9ea10-03a8-4f80-91f2-dcc8a9103c83', 'b0000000-0000-0000-0000-000000000001', 'dd10e330-fe48-42d3-96f2-4167272bfc56', '22222222-0000-0000-0000-000000001105',
     60, 37.5, '60 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Đạt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('06d71f24-0499-4bb7-8381-775dc8b4b2ef', 'b0000000-0000-0000-0000-000000000001', '4a6cb8fe-1a78-4740-860d-a89fa5dea766', '22222222-0000-0000-0000-000000001101',
     7.8, 50.0, '7.8 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('e94aef40-8961-476a-b472-0f15b5b81021', 'b0000000-0000-0000-0000-000000000001', '69303880-b11a-4005-9125-14fec645f4eb', '22222222-0000-0000-0000-000000001101',
     82, 50.0, '82 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('8b2f0948-f60b-4cde-bd17-066adca38b06', 'b0000000-0000-0000-0000-000000000001', '4a6cb8fe-1a78-4740-860d-a89fa5dea766', '22222222-0000-0000-0000-000000001102',
     7.2, 48.0, '7.2 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('7badf02d-3591-49d7-aefe-5385ad8c229d', 'b0000000-0000-0000-0000-000000000001', '69303880-b11a-4005-9125-14fec645f4eb', '22222222-0000-0000-0000-000000001102',
     76, 47.5, '76 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('a57cc109-a316-4ec6-b256-99def012dadd', 'b0000000-0000-0000-0000-000000000001', '4a6cb8fe-1a78-4740-860d-a89fa5dea766', '22222222-0000-0000-0000-000000001103',
     7.0, 46.7, '7.0 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('39644b32-e1ea-470f-8eba-e32234487c7c', 'b0000000-0000-0000-0000-000000000001', '69303880-b11a-4005-9125-14fec645f4eb', '22222222-0000-0000-0000-000000001103',
     74, 46.2, '74 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('6fdf0b7c-ef1b-4369-8aca-5c352ba52672', 'b0000000-0000-0000-0000-000000000001', '4a6cb8fe-1a78-4740-860d-a89fa5dea766', '22222222-0000-0000-0000-000000001104',
     7.5, 50.0, '7.5 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('12981aa8-2e20-4ed7-b5df-6a2012bf2b20', 'b0000000-0000-0000-0000-000000000001', '69303880-b11a-4005-9125-14fec645f4eb', '22222222-0000-0000-0000-000000001104',
     80, 50.0, '80 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('0350f3de-deb9-4cea-9248-8ec292914bbd', 'b0000000-0000-0000-0000-000000000001', '4a6cb8fe-1a78-4740-860d-a89fa5dea766', '22222222-0000-0000-0000-000000001105',
     6.5, 43.3, '6.5 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('22239b81-eecc-4cf8-9e9f-ed4fc55cfe37', 'b0000000-0000-0000-0000-000000000001', '69303880-b11a-4005-9125-14fec645f4eb', '22222222-0000-0000-0000-000000001105',
     68, 42.5, '68 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('75403e92-88b9-4f11-897e-6ed26acf5bf6', 'b0000000-0000-0000-0000-000000000001', '36ab170d-0741-4f0b-8ff5-6e183deabd19', '22222222-0000-0000-0000-000000001101',
     8.1, 50.0, '8.1 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('283c2c68-dc0e-47c9-9ba3-5ae9ceed1136', 'b0000000-0000-0000-0000-000000000001', 'a9a66314-7a25-4afe-b288-6336cfcca472', '22222222-0000-0000-0000-000000001101',
     88, 50.0, '88 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('7296307c-e248-43c1-adff-ad6462f28983', 'b0000000-0000-0000-0000-000000000001', '36ab170d-0741-4f0b-8ff5-6e183deabd19', '22222222-0000-0000-0000-000000001102',
     7.5, 50.0, '7.5 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('106bfb6b-46f2-45c5-aba7-a747aa6833e1', 'b0000000-0000-0000-0000-000000000001', 'a9a66314-7a25-4afe-b288-6336cfcca472', '22222222-0000-0000-0000-000000001102',
     82, 50.0, '82 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('0994069c-2267-4366-b6e4-f16e86532b48', 'b0000000-0000-0000-0000-000000000001', '36ab170d-0741-4f0b-8ff5-6e183deabd19', '22222222-0000-0000-0000-000000001103',
     7.8, 50.0, '7.8 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('80fcc66e-3bf3-402c-ae6c-bbd10cc8c4a5', 'b0000000-0000-0000-0000-000000000001', 'a9a66314-7a25-4afe-b288-6336cfcca472', '22222222-0000-0000-0000-000000001103',
     80, 50.0, '80 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('6f5e3e00-5050-45f8-85f0-cbc63756b78f', 'b0000000-0000-0000-0000-000000000001', '36ab170d-0741-4f0b-8ff5-6e183deabd19', '22222222-0000-0000-0000-000000001104',
     8.0, 50.0, '8.0 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('3e9c815f-7201-40ef-84ce-db4584ad4b43', 'b0000000-0000-0000-0000-000000000001', 'a9a66314-7a25-4afe-b288-6336cfcca472', '22222222-0000-0000-0000-000000001104',
     85, 50.0, '85 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('715da0bc-4a4b-4a6e-9dd4-03072d9eef51', 'b0000000-0000-0000-0000-000000000001', '36ab170d-0741-4f0b-8ff5-6e183deabd19', '22222222-0000-0000-0000-000000001105',
     7.2, 48.0, '7.2 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('010a5586-dfc7-441f-af72-8967ba53a454', 'b0000000-0000-0000-0000-000000000001', 'a9a66314-7a25-4afe-b288-6336cfcca472', '22222222-0000-0000-0000-000000001105',
     75, 46.9, '75 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('5dbcdaec-4abd-4d32-b362-83e678b9ab18', 'b0000000-0000-0000-0000-000000000002', '2f4bb251-bea1-4dfd-91be-6457c7c520fc', '22222222-0000-0000-0000-000000001201',
     7.5, 50.0, '7.5 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('05f1b4ee-163f-4b7b-85ca-7225f80f708d', 'b0000000-0000-0000-0000-000000000002', '4dc534e7-1b2d-4afc-a6db-dfb956187321', '22222222-0000-0000-0000-000000001201',
     80, 50.0, '80 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('43ae3953-f8ac-4711-9e85-a28375578a24', 'b0000000-0000-0000-0000-000000000002', '2f4bb251-bea1-4dfd-91be-6457c7c520fc', '22222222-0000-0000-0000-000000001202',
     7.0, 46.7, '7.0 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('828ddbc2-e7f3-4583-8854-fec4fad30a7a', 'b0000000-0000-0000-0000-000000000002', '4dc534e7-1b2d-4afc-a6db-dfb956187321', '22222222-0000-0000-0000-000000001202',
     74, 46.2, '74 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('dc520222-c3c4-4758-82c4-802c51a82f08', 'b0000000-0000-0000-0000-000000000002', '2f4bb251-bea1-4dfd-91be-6457c7c520fc', '22222222-0000-0000-0000-000000001203',
     6.2, 41.3, '6.2 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('baa3dd2b-8aa7-4e61-9d81-98265e9d6497', 'b0000000-0000-0000-0000-000000000002', '4dc534e7-1b2d-4afc-a6db-dfb956187321', '22222222-0000-0000-0000-000000001203',
     65, 40.6, '65 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('52ee8c05-a93a-49cb-ad9f-d2c4c4c7d35c', 'b0000000-0000-0000-0000-000000000002', '2f4bb251-bea1-4dfd-91be-6457c7c520fc', '22222222-0000-0000-0000-000000001204',
     7.3, 48.7, '7.3 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('b53ae77c-0a3f-4151-aa7a-01cb54747b5b', 'b0000000-0000-0000-0000-000000000002', '4dc534e7-1b2d-4afc-a6db-dfb956187321', '22222222-0000-0000-0000-000000001204',
     77, 48.1, '77 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('18653129-0246-4704-a3ec-f1c97dc2020c', 'b0000000-0000-0000-0000-000000000002', '2f4bb251-bea1-4dfd-91be-6457c7c520fc', '22222222-0000-0000-0000-000000001205',
     5.5, 36.7, '5.5 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Đạt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('4eb70a15-8877-4aea-b6e4-8e27914fd4b8', 'b0000000-0000-0000-0000-000000000002', '4dc534e7-1b2d-4afc-a6db-dfb956187321', '22222222-0000-0000-0000-000000001205',
     58, 36.2, '58 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Đạt', '2026-05-03 08:00:00+07',
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('05b8719f-5ed6-4e16-a2ee-378b88e44e27', 'b0000000-0000-0000-0000-000000000002', '8d905099-ca54-43c1-906f-c9cb94ce1f85', '22222222-0000-0000-0000-000000001201',
     7.9, 50.0, '7.9 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('dba67e1c-3f11-40c5-8032-58e75eb29146', 'b0000000-0000-0000-0000-000000000002', 'afe5133c-b8a7-4cb2-adee-65f0ad08637d', '22222222-0000-0000-0000-000000001201',
     85, 50.0, '85 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('1c2e911b-79ec-4df6-a774-a609ca43b04c', 'b0000000-0000-0000-0000-000000000002', '8d905099-ca54-43c1-906f-c9cb94ce1f85', '22222222-0000-0000-0000-000000001202',
     7.4, 49.3, '7.4 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('58f717e0-7e6a-47f5-98b9-7d2274d4e957', 'b0000000-0000-0000-0000-000000000002', 'afe5133c-b8a7-4cb2-adee-65f0ad08637d', '22222222-0000-0000-0000-000000001202',
     79, 49.4, '79 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('7aca92e0-93dc-4f12-9fb6-5e9aa7dae7d7', 'b0000000-0000-0000-0000-000000000002', '8d905099-ca54-43c1-906f-c9cb94ce1f85', '22222222-0000-0000-0000-000000001203',
     6.8, 45.3, '6.8 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('9af4fa09-39ae-4b66-96f5-2e5610678128', 'b0000000-0000-0000-0000-000000000002', 'afe5133c-b8a7-4cb2-adee-65f0ad08637d', '22222222-0000-0000-0000-000000001203',
     71, 44.4, '71 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('007d27f6-7781-4538-ad04-a25170766189', 'b0000000-0000-0000-0000-000000000002', '8d905099-ca54-43c1-906f-c9cb94ce1f85', '22222222-0000-0000-0000-000000001204',
     7.7, 50.0, '7.7 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('b7b746db-62d6-4930-8ad8-1e5a8bf29eec', 'b0000000-0000-0000-0000-000000000002', 'afe5133c-b8a7-4cb2-adee-65f0ad08637d', '22222222-0000-0000-0000-000000001204',
     82, 50.0, '82 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('3466fd4d-8ee1-4e4d-9790-725eac178828', 'b0000000-0000-0000-0000-000000000002', '8d905099-ca54-43c1-906f-c9cb94ce1f85', '22222222-0000-0000-0000-000000001205',
     6.2, 41.3, '6.2 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('113e05c5-1d0a-4a1b-8798-b5d325229069', 'b0000000-0000-0000-0000-000000000002', 'afe5133c-b8a7-4cb2-adee-65f0ad08637d', '22222222-0000-0000-0000-000000001205',
     65, 40.6, '65 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-06-03 08:00:00+07',
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('8b4e23e2-e1e4-4df5-aad3-4b4d70d345e6', 'b0000000-0000-0000-0000-000000000002', '62426faa-587f-4192-ad04-009960aff719', '22222222-0000-0000-0000-000000001201',
     8.3, 50.0, '8.3 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('d2a8f586-81c7-4a7b-9ab8-51b730aa6824', 'b0000000-0000-0000-0000-000000000002', '6c345520-98c2-4cbd-8b14-8304da50333a', '22222222-0000-0000-0000-000000001201',
     90, 50.0, '90 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('4cc73eba-244f-4129-823a-0bcad8500946', 'b0000000-0000-0000-0000-000000000002', '62426faa-587f-4192-ad04-009960aff719', '22222222-0000-0000-0000-000000001202',
     7.8, 50.0, '7.8 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('ec1b462d-4bd0-4e91-b84b-2a8faf86b60f', 'b0000000-0000-0000-0000-000000000002', '6c345520-98c2-4cbd-8b14-8304da50333a', '22222222-0000-0000-0000-000000001202',
     84, 50.0, '84 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('2c98c264-9bd7-4581-a2e1-483cdfb4f84f', 'b0000000-0000-0000-0000-000000000002', '62426faa-587f-4192-ad04-009960aff719', '22222222-0000-0000-0000-000000001203',
     7.3, 48.7, '7.3 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('461b58cf-ced8-48e6-9aab-c581eff6fc5b', 'b0000000-0000-0000-0000-000000000002', '6c345520-98c2-4cbd-8b14-8304da50333a', '22222222-0000-0000-0000-000000001203',
     78, 48.8, '78 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('6129a9ed-b943-4b3c-8ad4-708a8dae7d52', 'b0000000-0000-0000-0000-000000000002', '62426faa-587f-4192-ad04-009960aff719', '22222222-0000-0000-0000-000000001204',
     8.0, 50.0, '8.0 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('45c30989-a4bd-4510-b5f3-cd5fd47ed0d7', 'b0000000-0000-0000-0000-000000000002', '6c345520-98c2-4cbd-8b14-8304da50333a', '22222222-0000-0000-0000-000000001204',
     87, 50.0, '87 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Xuất sắc', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('f58bbeb4-6396-40fe-9a95-21719e03eb64', 'b0000000-0000-0000-0000-000000000002', '62426faa-587f-4192-ad04-009960aff719', '22222222-0000-0000-0000-000000001205',
     7.0, 46.7, '7.0 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('571785cd-cc0a-40df-b2b8-33093ffe48f3', 'b0000000-0000-0000-0000-000000000002', '6c345520-98c2-4cbd-8b14-8304da50333a', '22222222-0000-0000-0000-000000001205',
     73, 45.6, '73 điểm', 'APPROVED',
     '22222222-0000-0000-0000-000000001001', 'Tốt', '2026-07-03 08:00:00+07',
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07');

-- 14. KPI REMINDERS  (2 BM × 2 KPI × 5 members × 3 periods = 60 rows)
INSERT INTO kpi_reminders (id, kpi_criteria_id, user_id, batch_number, sent_at) VALUES
    ('a9bce7d8-4607-4c72-8912-dcba8d7438f4', 'd65c5ad1-8dad-4284-b070-3340d575b671', '22222222-0000-0000-0000-000000001101', 1, '2026-04-15 00:00:00+07'),
    ('617e1883-4adb-4402-a777-b4ad799b886c', 'd65c5ad1-8dad-4284-b070-3340d575b671', '22222222-0000-0000-0000-000000001102', 1, '2026-04-15 00:00:00+07'),
    ('ff369ce6-69a8-4bdb-871e-4f07fbe02b44', 'd65c5ad1-8dad-4284-b070-3340d575b671', '22222222-0000-0000-0000-000000001103', 1, '2026-04-15 00:00:00+07'),
    ('7cf47253-0259-4dfb-888f-511f6cf5feb4', 'd65c5ad1-8dad-4284-b070-3340d575b671', '22222222-0000-0000-0000-000000001104', 1, '2026-04-15 00:00:00+07'),
    ('518adb85-6d1e-4cb6-9b43-0c767bcdec0f', 'd65c5ad1-8dad-4284-b070-3340d575b671', '22222222-0000-0000-0000-000000001105', 1, '2026-04-15 00:00:00+07'),
    ('697ee63d-9dbf-4c3e-97e0-c48877839c71', 'dd10e330-fe48-42d3-96f2-4167272bfc56', '22222222-0000-0000-0000-000000001101', 1, '2026-04-15 00:00:00+07'),
    ('d9400144-b6cf-426f-8037-c0a264674812', 'dd10e330-fe48-42d3-96f2-4167272bfc56', '22222222-0000-0000-0000-000000001102', 1, '2026-04-15 00:00:00+07'),
    ('e8856cba-1a66-4f92-b0bf-68a6bb138b4e', 'dd10e330-fe48-42d3-96f2-4167272bfc56', '22222222-0000-0000-0000-000000001103', 1, '2026-04-15 00:00:00+07'),
    ('949943ff-0ef7-46d3-9df7-a1a2d956ca86', 'dd10e330-fe48-42d3-96f2-4167272bfc56', '22222222-0000-0000-0000-000000001104', 1, '2026-04-15 00:00:00+07'),
    ('9b56c8a5-0f5d-4a56-add8-c43e212456db', 'dd10e330-fe48-42d3-96f2-4167272bfc56', '22222222-0000-0000-0000-000000001105', 1, '2026-04-15 00:00:00+07'),
    ('f84f91e8-3027-41ff-b235-cb7a37ab4f7f', '4a6cb8fe-1a78-4740-860d-a89fa5dea766', '22222222-0000-0000-0000-000000001101', 1, '2026-05-15 00:00:00+07'),
    ('8069020f-802a-4e09-a9d5-a00b91ca95a2', '4a6cb8fe-1a78-4740-860d-a89fa5dea766', '22222222-0000-0000-0000-000000001102', 1, '2026-05-15 00:00:00+07'),
    ('2ab229a8-9e8e-4a51-9b18-5bf02cc495f3', '4a6cb8fe-1a78-4740-860d-a89fa5dea766', '22222222-0000-0000-0000-000000001103', 1, '2026-05-15 00:00:00+07'),
    ('1b477142-d2d6-4032-a871-7e9d1ebeda22', '4a6cb8fe-1a78-4740-860d-a89fa5dea766', '22222222-0000-0000-0000-000000001104', 1, '2026-05-15 00:00:00+07'),
    ('41e61996-50a8-4ed8-9480-eb309f86d9ca', '4a6cb8fe-1a78-4740-860d-a89fa5dea766', '22222222-0000-0000-0000-000000001105', 1, '2026-05-15 00:00:00+07'),
    ('b55cf457-5067-4939-bacf-5d7642cf2d58', '69303880-b11a-4005-9125-14fec645f4eb', '22222222-0000-0000-0000-000000001101', 1, '2026-05-15 00:00:00+07'),
    ('1af26980-0db1-435d-a124-902c43d9e53b', '69303880-b11a-4005-9125-14fec645f4eb', '22222222-0000-0000-0000-000000001102', 1, '2026-05-15 00:00:00+07'),
    ('b1feaa82-260e-4fcd-b0d0-da75cae2d21c', '69303880-b11a-4005-9125-14fec645f4eb', '22222222-0000-0000-0000-000000001103', 1, '2026-05-15 00:00:00+07'),
    ('e3453f5f-f97d-484b-ab96-c8341683e52f', '69303880-b11a-4005-9125-14fec645f4eb', '22222222-0000-0000-0000-000000001104', 1, '2026-05-15 00:00:00+07'),
    ('080816f2-bdaa-4ad2-b89b-47c8de0afea5', '69303880-b11a-4005-9125-14fec645f4eb', '22222222-0000-0000-0000-000000001105', 1, '2026-05-15 00:00:00+07'),
    ('27bd6460-3d93-4ed7-adf2-a51868b065d6', '36ab170d-0741-4f0b-8ff5-6e183deabd19', '22222222-0000-0000-0000-000000001101', 1, '2026-06-15 00:00:00+07'),
    ('a7f2d220-71de-42e8-8353-4911db0402ae', '36ab170d-0741-4f0b-8ff5-6e183deabd19', '22222222-0000-0000-0000-000000001102', 1, '2026-06-15 00:00:00+07'),
    ('95d0aa11-a4b8-47d6-a8e6-2cc0499edd01', '36ab170d-0741-4f0b-8ff5-6e183deabd19', '22222222-0000-0000-0000-000000001103', 1, '2026-06-15 00:00:00+07'),
    ('c8aa79cb-a2b7-4fb6-9602-a45816b80f39', '36ab170d-0741-4f0b-8ff5-6e183deabd19', '22222222-0000-0000-0000-000000001104', 1, '2026-06-15 00:00:00+07'),
    ('96ef260f-570c-47b3-9e05-6bda3979eb85', '36ab170d-0741-4f0b-8ff5-6e183deabd19', '22222222-0000-0000-0000-000000001105', 1, '2026-06-15 00:00:00+07'),
    ('1ba2a733-85a0-46f9-b4d3-0bc19b4730c8', 'a9a66314-7a25-4afe-b288-6336cfcca472', '22222222-0000-0000-0000-000000001101', 1, '2026-06-15 00:00:00+07'),
    ('9dfa9df5-0efd-45ef-a304-42f36d070119', 'a9a66314-7a25-4afe-b288-6336cfcca472', '22222222-0000-0000-0000-000000001102', 1, '2026-06-15 00:00:00+07'),
    ('e55c6537-109a-4ceb-b41b-63f8cca59661', 'a9a66314-7a25-4afe-b288-6336cfcca472', '22222222-0000-0000-0000-000000001103', 1, '2026-06-15 00:00:00+07'),
    ('6bce39dc-4cb4-49fa-afd3-5c95adb6033c', 'a9a66314-7a25-4afe-b288-6336cfcca472', '22222222-0000-0000-0000-000000001104', 1, '2026-06-15 00:00:00+07'),
    ('60ebbd44-f5c2-4b24-ad04-96af424a0d58', 'a9a66314-7a25-4afe-b288-6336cfcca472', '22222222-0000-0000-0000-000000001105', 1, '2026-06-15 00:00:00+07'),
    ('9220ab1c-95e4-49e5-af05-f29dbeb4cfac', '2f4bb251-bea1-4dfd-91be-6457c7c520fc', '22222222-0000-0000-0000-000000001201', 1, '2026-04-15 00:00:00+07'),
    ('8b1c3309-458c-4ece-925d-cc59283eb3fd', '2f4bb251-bea1-4dfd-91be-6457c7c520fc', '22222222-0000-0000-0000-000000001202', 1, '2026-04-15 00:00:00+07'),
    ('1743e78b-ac05-48fc-a609-195fd74bab99', '2f4bb251-bea1-4dfd-91be-6457c7c520fc', '22222222-0000-0000-0000-000000001203', 1, '2026-04-15 00:00:00+07'),
    ('49612a46-716b-46fc-aee2-567b8ad9ed29', '2f4bb251-bea1-4dfd-91be-6457c7c520fc', '22222222-0000-0000-0000-000000001204', 1, '2026-04-15 00:00:00+07'),
    ('724cce98-f9c3-4f3d-8bd1-abe0e1681d24', '2f4bb251-bea1-4dfd-91be-6457c7c520fc', '22222222-0000-0000-0000-000000001205', 1, '2026-04-15 00:00:00+07'),
    ('e7cf49e4-13e0-4947-93d9-1a62a3ad1b60', '4dc534e7-1b2d-4afc-a6db-dfb956187321', '22222222-0000-0000-0000-000000001201', 1, '2026-04-15 00:00:00+07'),
    ('569e668d-4ff2-456c-86d4-cf3f799d1ee0', '4dc534e7-1b2d-4afc-a6db-dfb956187321', '22222222-0000-0000-0000-000000001202', 1, '2026-04-15 00:00:00+07'),
    ('f6021023-30b7-460e-a1d2-50d8c53ee40a', '4dc534e7-1b2d-4afc-a6db-dfb956187321', '22222222-0000-0000-0000-000000001203', 1, '2026-04-15 00:00:00+07'),
    ('5b7f2eb5-936d-4530-af4e-40ef51ad71b6', '4dc534e7-1b2d-4afc-a6db-dfb956187321', '22222222-0000-0000-0000-000000001204', 1, '2026-04-15 00:00:00+07'),
    ('f1d24988-3650-451e-99e4-838d495d5a91', '4dc534e7-1b2d-4afc-a6db-dfb956187321', '22222222-0000-0000-0000-000000001205', 1, '2026-04-15 00:00:00+07'),
    ('a2324329-0354-4e98-9687-328ef5a4b7c4', '8d905099-ca54-43c1-906f-c9cb94ce1f85', '22222222-0000-0000-0000-000000001201', 1, '2026-05-15 00:00:00+07'),
    ('f8c16c5c-f7f2-4293-b4d2-1c6a0196c524', '8d905099-ca54-43c1-906f-c9cb94ce1f85', '22222222-0000-0000-0000-000000001202', 1, '2026-05-15 00:00:00+07'),
    ('a331a8b0-a5de-44cf-b724-a1820adc8b5a', '8d905099-ca54-43c1-906f-c9cb94ce1f85', '22222222-0000-0000-0000-000000001203', 1, '2026-05-15 00:00:00+07'),
    ('33e353c7-a428-423f-9bda-bc9c8c8f4341', '8d905099-ca54-43c1-906f-c9cb94ce1f85', '22222222-0000-0000-0000-000000001204', 1, '2026-05-15 00:00:00+07'),
    ('6bbc6e49-0931-44e4-bb6d-6dc2c71697fe', '8d905099-ca54-43c1-906f-c9cb94ce1f85', '22222222-0000-0000-0000-000000001205', 1, '2026-05-15 00:00:00+07'),
    ('5df8b2dd-01f9-4013-9f42-07bd24ec2ffa', 'afe5133c-b8a7-4cb2-adee-65f0ad08637d', '22222222-0000-0000-0000-000000001201', 1, '2026-05-15 00:00:00+07'),
    ('00d1407e-48d2-4268-9081-e801e3c0cf4e', 'afe5133c-b8a7-4cb2-adee-65f0ad08637d', '22222222-0000-0000-0000-000000001202', 1, '2026-05-15 00:00:00+07'),
    ('22f81d8c-8537-4b90-bfd3-dd641ee6b2e6', 'afe5133c-b8a7-4cb2-adee-65f0ad08637d', '22222222-0000-0000-0000-000000001203', 1, '2026-05-15 00:00:00+07'),
    ('a220b274-541d-45c7-ab0e-1aafe7b3597d', 'afe5133c-b8a7-4cb2-adee-65f0ad08637d', '22222222-0000-0000-0000-000000001204', 1, '2026-05-15 00:00:00+07'),
    ('e1d6722e-9d1a-41ec-b9e8-56b3bbb3291a', 'afe5133c-b8a7-4cb2-adee-65f0ad08637d', '22222222-0000-0000-0000-000000001205', 1, '2026-05-15 00:00:00+07'),
    ('24347fc4-2d9f-4c76-854f-1677e62a2ef3', '62426faa-587f-4192-ad04-009960aff719', '22222222-0000-0000-0000-000000001201', 1, '2026-06-15 00:00:00+07'),
    ('277aecba-9401-43d4-91d5-ae43822c7b81', '62426faa-587f-4192-ad04-009960aff719', '22222222-0000-0000-0000-000000001202', 1, '2026-06-15 00:00:00+07'),
    ('2056d058-145f-434b-b757-a8b51fe396fa', '62426faa-587f-4192-ad04-009960aff719', '22222222-0000-0000-0000-000000001203', 1, '2026-06-15 00:00:00+07'),
    ('2f0fb201-1cf5-47b4-8384-1ce50a686bbd', '62426faa-587f-4192-ad04-009960aff719', '22222222-0000-0000-0000-000000001204', 1, '2026-06-15 00:00:00+07'),
    ('c7909b3d-067d-4d76-8290-09748535a0aa', '62426faa-587f-4192-ad04-009960aff719', '22222222-0000-0000-0000-000000001205', 1, '2026-06-15 00:00:00+07'),
    ('714b5d78-c2fb-4d5b-8459-a92286e71191', '6c345520-98c2-4cbd-8b14-8304da50333a', '22222222-0000-0000-0000-000000001201', 1, '2026-06-15 00:00:00+07'),
    ('a982a62d-904d-4c2b-a8e0-013c518d0840', '6c345520-98c2-4cbd-8b14-8304da50333a', '22222222-0000-0000-0000-000000001202', 1, '2026-06-15 00:00:00+07'),
    ('0831f796-b6fe-4910-98a1-2146ecd1f4c9', '6c345520-98c2-4cbd-8b14-8304da50333a', '22222222-0000-0000-0000-000000001203', 1, '2026-06-15 00:00:00+07'),
    ('9b52b89c-edcb-4642-890f-f55a227ff2e9', '6c345520-98c2-4cbd-8b14-8304da50333a', '22222222-0000-0000-0000-000000001204', 1, '2026-06-15 00:00:00+07'),
    ('45ddc18d-35c5-4b85-b933-3fc4fdb998f4', '6c345520-98c2-4cbd-8b14-8304da50333a', '22222222-0000-0000-0000-000000001205', 1, '2026-06-15 00:00:00+07');

-- 15. EVALUATIONS  (12 users × 3 periods = 36 rows)
-- Khoa-level users: điểm cố định (không có KPI)
-- BM-level users  : điểm tính từ tổng auto_score 2 KPI
INSERT INTO evaluations
    (id, org_unit_id, user_id, kpi_period_id,
     evaluator_id, score, comment, system_score,
     period_start, period_end)
VALUES
    ('fa513cad-5e43-4801-acec-befac4727de8', 'a0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000001001', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000001002', 87.5, 'Tốt', 88.0,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('9f07a170-3f65-49c3-bebd-945b9a964434', 'a0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000001001', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000001002', 90.5, 'Xuất sắc', 91.0,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('7351c264-b3ef-436d-8c73-fd84fc6518e7', 'a0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000001001', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000001002', 93.5, 'Xuất sắc', 94.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('d30f8510-4b4b-4ba3-b83e-adce9351529b', 'a0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000001002', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000001001', 83.5, 'Tốt', 84.0,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('8c5266d8-4b01-4ad7-9573-70961d160dc8', 'a0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000001002', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000001001', 87.5, 'Tốt', 88.0,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('3e44b9bc-34f7-464a-a98f-36f287be2223', 'a0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000001002', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000001001', 91.5, 'Xuất sắc', 92.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('a2f42569-851c-4174-bcf0-97a1011e3a51', 'b0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000001101', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000001001', 96.3, 'Xuất sắc', 96.8,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('357e60a0-bb48-4880-af54-acfd0115e94b', 'b0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000001101', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000001001', 99.5, 'Xuất sắc', 100.0,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('2d3dc201-c8ad-425b-b16f-f53c4412bc45', 'b0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000001101', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000001001', 99.5, 'Xuất sắc', 100.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('49af126a-764c-466f-86f2-ff93f4b3fcf5', 'b0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000001102', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000001001', 89.8, 'Xuất sắc', 90.3,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('2245b70c-94f9-470a-a7e4-d7f2df14e031', 'b0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000001102', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000001001', 95.0, 'Xuất sắc', 95.5,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('cd12f917-cbcb-4af2-ac47-4af8eb502168', 'b0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000001102', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000001001', 99.5, 'Xuất sắc', 100.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('ab7e22e8-5cb2-41c3-ae42-e5b315c3e9f0', 'b0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000001103', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000001101', 85.3, 'Tốt', 85.8,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('5655f5a1-3744-4f33-b12d-5b2031f1f72a', 'b0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000001103', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000001101', 92.4, 'Xuất sắc', 92.9,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('bd4aa6f6-1c2b-415c-8c65-cc7b565bf2fd', 'b0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000001103', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000001101', 99.5, 'Xuất sắc', 100.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('57a57da3-f427-4d35-a97a-3552b0f81bee', 'b0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000001104', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000001101', 93.1, 'Xuất sắc', 93.6,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('87f46d5e-75be-4101-a5e9-a2d29954af0b', 'b0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000001104', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000001101', 99.5, 'Xuất sắc', 100.0,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('c039106c-ae01-4470-93f2-609c2c509df5', 'b0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000001104', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000001101', 99.5, 'Xuất sắc', 100.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('3d1ebaa7-a22f-4c40-9db6-27c791e84b51', 'b0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000001105', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000001101', 75.7, 'Khá', 76.2,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('f4d765ab-fb4f-4053-b3a0-76f9339350c1', 'b0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000001105', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000001101', 85.3, 'Tốt', 85.8,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('d713f0bd-162d-4870-ae22-a0e7c7c7ac25', 'b0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000001105', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000001101', 94.4, 'Xuất sắc', 94.9,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('60970afa-f5d8-4cc0-be3f-0e2b3ea3b020', 'b0000000-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000001201', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000001001', 99.5, 'Xuất sắc', 100.0,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('9aa3ff96-d44f-4c21-a124-f10f3225e23e', 'b0000000-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000001201', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000001001', 99.5, 'Xuất sắc', 100.0,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('7b9c0aeb-3c2b-46a9-abe9-c83b928c5af3', 'b0000000-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000001201', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000001001', 99.5, 'Xuất sắc', 100.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('3ba5010d-50ef-4d1f-aa24-4cf07a2e16fc', 'b0000000-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000001202', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000001001', 92.4, 'Xuất sắc', 92.9,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('b95d4baf-9c73-4496-8a84-b5f17b80f806', 'b0000000-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000001202', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000001001', 98.2, 'Xuất sắc', 98.7,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('4ef1c5c3-b458-49b6-8913-2da425c44113', 'b0000000-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000001202', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000001001', 99.5, 'Xuất sắc', 100.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('50148f0a-d87e-4a9d-a403-7014a39912d2', 'b0000000-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000001203', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000001201', 81.4, 'Tốt', 81.9,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('e1631540-f7bb-4b90-8951-8279e1ca017f', 'b0000000-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000001203', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000001201', 89.2, 'Tốt', 89.7,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('71b5e43c-8320-42ad-9cdf-59e1fe492f39', 'b0000000-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000001203', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000001201', 97.0, 'Xuất sắc', 97.5,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('94a0d888-8c12-4de2-b960-cd0614e170ab', 'b0000000-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000001204', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000001201', 96.3, 'Xuất sắc', 96.8,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('414e6cc8-992c-433a-ae27-5e3f3365d71f', 'b0000000-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000001204', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000001201', 99.5, 'Xuất sắc', 100.0,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('c7212086-1a05-46bf-8c06-6b69c5668b4f', 'b0000000-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000001204', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000001201', 99.5, 'Xuất sắc', 100.0,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07'),
    ('2943d893-ce94-437d-ad96-e533b025f1e1', 'b0000000-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000001205', '33333333-0000-0000-0000-000000000104',
     '22222222-0000-0000-0000-000000001201', 72.4, 'Khá', 72.9,
     '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07'),
    ('197b9a96-8bc0-4be9-ab8d-d0cbb90cb5a7', 'b0000000-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000001205', '33333333-0000-0000-0000-000000000105',
     '22222222-0000-0000-0000-000000001201', 81.4, 'Tốt', 81.9,
     '2026-05-01 00:00:00+07', '2026-05-31 23:59:59+07'),
    ('10fdcc2d-b772-4894-bbf4-91616d16c900', 'b0000000-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000001205', '33333333-0000-0000-0000-000000000106',
     '22222222-0000-0000-0000-000000001201', 91.8, 'Xuất sắc', 92.3,
     '2026-06-01 00:00:00+07', '2026-06-30 23:59:59+07');

-- 16. SCOPES & POLICIES
INSERT INTO scopes (id, code) VALUES
    ('00000000-0000-0000-0000-000000000001', 'NODE'),
    ('00000000-0000-0000-0000-000000000002', 'SUBTREE'),
    ('00000000-0000-0000-0000-000000000003', 'CUSTOM')
ON CONFLICT (id) DO NOTHING;

INSERT INTO policies (id, org_unit_id, name, effect) VALUES
    ('d1000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-000000000001',
     'KTPM Management Policy', 'ALLOW'),
    ('d1000000-0000-0000-0000-000000000002',
     'b0000000-0000-0000-0000-000000000001',
     'Deny SV approval', 'DENY')
ON CONFLICT (id) DO NOTHING;

INSERT INTO policy_conditions (policy_id, type, condition_json) VALUES
    ('d1000000-0000-0000-0000-000000000001', 'ORG_UNIT',  '{"scope": "SUBTREE"}'),
    ('d1000000-0000-0000-0000-000000000002', 'ATTRIBUTE', '{"role": "STUDENT"}')
ON CONFLICT DO NOTHING;

INSERT INTO role_policies (role_id, policy_id) VALUES
    ('c4000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001'),
    ('c4000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

-- 17. SIDEBAR CUSTOM LABELS
INSERT INTO sidebar_settings (id, organization_id, menu_key, custom_label) VALUES
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '/dashboard', 'Tổng quan'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '/dashboard?view=staff', 'Dashboard cá nhân'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Thiết lập công ty', 'Thiệt lập tổ chức'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '/company', 'Thông tin trường'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Tổ chức', 'Tổ chức'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '/roles', 'Phân quyền vai trò'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '/org-structure', 'Cấu trúc Khoa - Bộ môn'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '/users', 'Quản lý sinh viên & GV'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '/settings', 'Cấu hình hệ thống'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Quản lý KPI', 'Quản trị KPI học kỳ'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '/kpi-periods', 'Danh mục đợt KPI'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '/kpi-criteria', 'Thiết lập chỉ tiêu'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '/kpi-criteria/pending', 'Phê duyệt chỉ tiêu'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '/kpi-adjustments/pending', 'Duyệt điều chỉnh'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '/submissions/org-unit', 'Kiểm soát bài nộp'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '/evaluations', 'Đánh giá kết quả'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '/my-kpi', 'KPI của tôi'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '/my-adjustments', 'Yêu cầu điều chỉnh'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '/submissions', 'Lịch sử báo cáo'),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '/analytics', 'Phân tích & Thống kê');