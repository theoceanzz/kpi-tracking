-- Trang "Của tôi" gom sáu mục cá nhân, nhưng nhãn seed đặt theo sáu kiểu khác nhau
-- ("Lịch sử báo cáo", "Đánh giá xếp loại", "Yêu cầu điều chỉnh", "Ví tiền"…) nên nhìn
-- không ra đây đều là dữ liệu của chính người đang đăng nhập. Đưa tất cả về một khuôn
-- "<Cái gì> của tôi".
--
-- Như V6/V8/V9: chỉ chỉnh dòng ĐANG BẰNG giá trị seed cũ, tổ chức nào đã tự đặt tên
-- riêng thì giữ nguyên.

UPDATE sidebar_settings
SET custom_label = 'Báo cáo của tôi', updated_at = NOW()
WHERE menu_key = '/submissions'
  AND custom_label = 'Lịch sử báo cáo';

-- Hai tổ chức demo được seed hai tên khác nhau cho cùng một mục.
UPDATE sidebar_settings
SET custom_label = 'Đánh giá của tôi', updated_at = NOW()
WHERE menu_key = '/evaluations'
  AND custom_label IN ('Đánh giá xếp loại', 'Đánh giá kết quả');

UPDATE sidebar_settings
SET custom_label = 'Điều chỉnh của tôi', updated_at = NOW()
WHERE menu_key = '/my-adjustments'
  AND custom_label = 'Yêu cầu điều chỉnh';

-- '/my-kpi' seed sẵn là "KPI của tôi" nên đã đúng khuôn; '/rewards/me' và '/wallet/me'
-- không có dòng nào trong seed, nhãn của chúng lấy thẳng từ `navigation.tsx`.
