-- ====================================================
-- ĐƯA NHÃN ĐIỀU HƯỚNG VỀ ĐÚNG KHOÁ HIỆN TẠI
--
-- `sidebar_settings.menu_key` seed ở V2 vẫn dùng bộ khoá CŨ (theo path, thời mỗi màn
-- hình là một dòng sidebar). Phần lớn màn hình nay là mục BÊN TRONG một trang, khoá lấy
-- theo `id` của mục trong `navigation.tsx`.
--
-- Ứng dụng vẫn đọc được nhãn cũ nhờ `legacyKeys` nên không có gì hỏng, nhưng dữ liệu
-- demo thì nên đúng ngay từ đầu: màn "Quản lý Sidebar" xếp mục theo nơi xuất hiện, mà
-- khoá cũ thì phải tra dự phòng mới ra nhãn.
--
-- CHỈ đụng vào hai tổ chức demo. Nhãn của tổ chức thật là dữ liệu của họ — cứ để chạy
-- bằng `legacyKeys`, và sẽ tự chuyển sang khoá hiện tại ở lần lưu kế tiếp trong màn
-- "Quản lý Sidebar".
-- ====================================================

-- 1. Khoá không còn mục nào trong cây điều hướng (mọi tổ chức).
--    '/dashboard?view=staff': dashboard cá nhân không còn là dòng sidebar riêng.
--    'Tổ chức': tên nhóm sidebar cũ; nay chỉ là tên CỤM bên trong trang Thiết lập công
--    ty, mà cụm thì không đổi tên được ⇒ dòng này vĩnh viễn không gắn vào đâu.
DELETE FROM sidebar_settings
WHERE menu_key IN ('/dashboard?view=staff', 'Tổ chức');

-- 2. Hai khoá cũ cùng trỏ về MỘT mục ⇒ phải bỏ bớt cái thua trước khi đổi tên khoá.
--    Không có ràng buộc UNIQUE trên (organization_id, menu_key), nên để lọt hai dòng
--    cùng khoá thì `SidebarSettingService.getCustomLabels` gom Map sẽ ném lỗi trùng khoá.
--    Thứ tự ưu tiên lấy đúng theo `legacyKeys` trong navigation.tsx:
--      kpi-cycles: ['/kpi-cycles', '/kpi-periods']   ⇒ giữ '/kpi-cycles'
--      bsc:        ['/bsc', 'Quản lý BSC']           ⇒ giữ '/bsc'
DELETE FROM sidebar_settings
WHERE organization_id IN (
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222')
  AND menu_key IN ('/kpi-periods', 'Quản lý BSC');

-- 3. Đổi khoá cũ sang khoá hiện tại. '/dashboard' và '/analytics' KHÔNG có trong bảng
--    dưới: hai mục đó vẫn là dòng sidebar nên khoá vẫn là path, giữ nguyên.
UPDATE sidebar_settings s
SET menu_key = m.new_key
FROM (VALUES
    -- Dòng sidebar
    ('Thiết lập công ty',        'setup-company'),
    -- Mục trong trang "Thiết lập công ty"
    ('/company',                 'info'),
    ('/roles',                   'roles'),
    ('/org-structure',           'org-structure'),
    ('/users',                   'users'),
    -- Mục trong trang "Thiết lập công cụ"
    ('/kpi-cycles',              'kpi-cycles'),
    ('/okr',                     'okr'),
    ('/bsc',                     'bsc'),
    -- Mục trong trang "Quản lý hiệu suất"
    ('/kpi-criteria',            'kpi-criteria'),
    ('/kpi-criteria/pending',    'kpi-criteria-pending'),
    ('/kpi-adjustments/pending', 'kpi-adjustments-pending'),
    ('/submissions/org-unit',    'submissions-org-unit'),
    ('/kpi-cycles/evaluation',   'cycle-evaluation'),
    -- Mục trong trang "Của tôi"
    ('/my-kpi',                  'my-kpi'),
    ('/submissions',             'my-submissions'),
    ('/evaluations',             'evaluations'),
    ('/my-adjustments',          'my-adjustments')
) AS m(old_key, new_key)
WHERE s.organization_id IN (
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222')
  AND s.menu_key = m.old_key;
