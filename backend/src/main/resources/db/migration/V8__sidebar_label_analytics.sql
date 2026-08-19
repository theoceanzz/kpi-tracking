-- Sơ đồ điều hướng đặt tên mục này là "Phân tích"; nhãn seed cũ là "Phân tích & Thống kê".
-- Chỉ chỉnh dòng đang bằng đúng giá trị seed, tổ chức tự đặt tên riêng thì giữ nguyên.
UPDATE sidebar_settings
SET custom_label = 'Phân tích', updated_at = NOW()
WHERE menu_key = '/analytics'
  AND custom_label = 'Phân tích & Thống kê';
