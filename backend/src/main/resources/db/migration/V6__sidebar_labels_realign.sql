-- Gom các màn hình thiết lập công ty về một trang khiến vài nhãn tuỳ chỉnh cũ không
-- còn đúng nghĩa. Migration này chỉ chỉnh đúng các nhãn ĐANG BẰNG giá trị seed cũ, nên
-- tổ chức nào đã tự đặt tên riêng thì không bị đụng tới.

-- '/settings' xưa đặt tên cho cả trang cấu hình 4 tab; nay trang đó không còn tồn tại
-- riêng (bốn tab thành bốn mục trong "Thiết lập công ty"). Nhãn này không còn mục nào
-- để gắn vào, giữ lại chỉ làm rác và có thể gán nhầm tên cho mục "Quản lý Sidebar".
DELETE FROM sidebar_settings
WHERE menu_key = '/settings'
  AND custom_label = 'Cấu hình hệ thống';

-- Đưa hai nhãn của tổ chức demo về đúng tên đã thống nhất trong sơ đồ điều hướng.
UPDATE sidebar_settings
SET custom_label = 'Cơ cấu tổ chức', updated_at = NOW()
WHERE menu_key = '/org-structure'
  AND custom_label = 'Cấu trúc tổ chức';

UPDATE sidebar_settings
SET custom_label = 'Quản lý nhân viên', updated_at = NOW()
WHERE menu_key = '/users'
  AND custom_label = 'Quản lý nhân sự';
