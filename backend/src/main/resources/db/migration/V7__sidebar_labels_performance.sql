-- Năm màn hình vận hành KPI gom về một trang "Quản lý hiệu suất". Chỉnh các nhãn tuỳ
-- chỉnh ĐANG BẰNG giá trị seed cũ về đúng tên trong sơ đồ điều hướng; tổ chức nào đã
-- tự đặt tên riêng thì không bị đụng tới.

-- Nhãn của nhóm cũ 'Quản lý KPI' không còn mục nào để gắn: nhóm đó nay là một dòng
-- sidebar duy nhất, lưu nhãn ở khoá 'performance'.
DELETE FROM sidebar_settings
WHERE menu_key = 'Quản lý KPI'
  AND custom_label IN ('Quản trị KPI', 'Quản trị KPI học kỳ');

UPDATE sidebar_settings
SET custom_label = 'Điều chỉnh chỉ tiêu', updated_at = NOW()
WHERE menu_key = '/kpi-adjustments/pending'
  AND custom_label = 'Duyệt điều chỉnh';

UPDATE sidebar_settings
SET custom_label = 'Đánh giá đợt', updated_at = NOW()
WHERE menu_key = '/submissions/org-unit'
  AND custom_label = 'Kiểm soát bài nộp';
