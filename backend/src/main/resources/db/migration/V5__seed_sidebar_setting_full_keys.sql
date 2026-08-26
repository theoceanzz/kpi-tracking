-- ====================================================
-- SEED ĐỦ MỌI KHOÁ NHÃN ĐIỀU HƯỚNG CHO HAI TỔ CHỨC DEMO
--
-- Sau V4 thì khoá đã đúng chuẩn hiện tại, nhưng mới phủ 19/44 mục của màn "Quản lý
-- Sidebar": thiếu hẳn hai dòng gộp (`setup-tools`, `performance`), cả trang "Phân tích",
-- và các mục thiết lập mới (cấp bậc, ma trận, thưởng, ví, token AI...). Trên màn hình
-- những dòng đó chỉ hiện placeholder, nên demo không cho thấy được là mục nào cũng đổi
-- tên được.
--
-- Danh sách dưới đây bám đúng `navItemKey()` trong `frontend/src/config/navigation.tsx`:
-- khoá = `labelKey` ?? `path` ?? `id`, nhãn = `label` mặc định của mục đó.
--
-- CHỈ đụng hai tổ chức demo — nhãn của tổ chức thật là dữ liệu của họ, và để trống thì
-- ứng dụng đã tự lấy nhãn mặc định rồi, không cần ghi vào DB.
-- ====================================================

-- `NOT EXISTS` giữ hai điều:
--   1. Nhãn đã tuỳ chỉnh ở V2 không bị ghi đè (ví dụ '/company' → 'Thông tin trường' của
--      tổ chức giáo dục vẫn còn nguyên).
--   2. Không sinh dòng thứ hai cùng (organization_id, menu_key). Bảng KHÔNG có ràng buộc
--      UNIQUE cho cặp này, mà `SidebarSettingService.getCustomLabels` gom Map nên trùng
--      khoá là ném lỗi cả API.
--
-- Có seed cả mục thuộc tính năng đang tắt (OKR/BSC/thưởng/ví/AI): bản ghi thừa không hại
-- gì vì `collectNavLabelScopes` lọc theo cờ tính năng trước khi hiện, mà khi tổ chức bật
-- tính năng lên thì nhãn có sẵn ngay.
INSERT INTO sidebar_settings (id, organization_id, menu_key, custom_label)
SELECT gen_random_uuid(), o.id, m.menu_key, m.default_label
FROM (VALUES
    ('11111111-1111-1111-1111-111111111111'::uuid),
    ('22222222-2222-2222-2222-222222222222'::uuid)
) AS o(id)
CROSS JOIN (VALUES
    -- Thanh điều hướng: các dòng hiện trực tiếp trên sidebar.
    -- 'setup' là nhóm (không có path) nên khoá lấy theo id; hai dòng gộp dùng `labelKey`.
    ('/dashboard',              'Tổng quan'),
    ('setup',                   'Thiết lập'),
    ('setup-company',           'Thiết lập công ty'),
    ('setup-tools',             'Thiết lập công cụ'),
    ('performance',             'Quản lý hiệu suất'),
    ('/me',                     'Của tôi'),
    ('/analytics',              'Phân tích'),
    ('/ai-assistant',           'K.AI'),

    -- Mục trong trang "Thiết lập công ty" (/company)
    ('info',                    'Thông tin công ty'),
    ('ranks',                   'Cấp bậc'),
    ('roles',                   'Phân quyền vai trò'),
    ('org-structure',           'Cơ cấu tổ chức'),
    ('users',                   'Quản lý nhân viên'),
    ('sidebar',                 'Quản lý Sidebar'),
    ('notifications',           'Thiết lập thông báo'),
    ('email',                   'Thiết lập email'),
    ('api',                     'Thiết lập API'),

    -- Mục trong trang "Thiết lập công cụ" (/settings/tools)
    ('modules',                 'Module & tính năng'),
    ('scoring',                 'Thang điểm'),
    ('matrix',                  'Ma trận đánh giá'),
    ('unit-class',              'Xếp loại đơn vị'),
    ('kpi-cycles',              'Quản lý kỳ/đợt đánh giá'),
    ('okr',                     'Quản lý OKR'),
    ('bsc',                     'Quản lý BSC'),
    ('rewards',                 'Quản lý thưởng'),
    ('wallet',                  'Quản lý ví'),
    ('ai-quota',                'Quản lý token AI'),

    -- Mục trong trang "Quản lý hiệu suất" (/performance)
    ('kpi-criteria',            'Thiết lập chỉ tiêu'),
    ('kpi-criteria-pending',    'Phê duyệt chỉ tiêu'),
    ('kpi-adjustments-pending', 'Điều chỉnh chỉ tiêu'),
    ('submissions-org-unit',    'Đánh giá đợt'),
    ('cycle-evaluation',        'Đánh giá kỳ'),

    -- Mục trong trang "Của tôi" (/me)
    ('my-kpi',                  'KPI của tôi'),
    ('my-submissions',          'Báo cáo của tôi'),
    ('evaluations',             'Đánh giá của tôi'),
    ('my-adjustments',          'Điều chỉnh của tôi'),
    ('my-rewards',              'Điểm của tôi'),
    ('my-cash-wallet',          'Ví của tôi'),

    -- Mục trong trang "Phân tích" (/analytics)
    -- 'my' (KPI của tôi) khác 'my-kpi' bên trang "Của tôi": hai màn hình khác nhau, trùng
    -- nhãn mặc định thôi. 'analytics-bsc' là `labelKey` riêng vì id 'bsc' đã bị mục
    -- "Quản lý BSC" bên Thiết lập công cụ dùng mất.
    ('my-objectives',           'Mục tiêu của tôi'),
    ('subordinate',             'Mục tiêu đơn vị'),
    ('my',                      'KPI của tôi'),
    ('summary',                 'KPI đơn vị'),
    ('drilldown',               'Phân cấp'),
    ('analytics-bsc',           'Hạng mục (BSC)')
) AS m(menu_key, default_label)
WHERE NOT EXISTS (
    SELECT 1
    FROM sidebar_settings s
    WHERE s.organization_id = o.id
      AND s.menu_key = m.menu_key
);
