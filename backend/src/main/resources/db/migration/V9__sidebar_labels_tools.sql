-- Hai mục trong nhóm "Công cụ" mang nhãn seed không còn mô tả đúng nội dung bên trong:
--   * '/kpi-cycles' tên "Danh mục kỳ KPI" nhưng trang này gồm CẢ kỳ lẫn đợt đánh giá.
--   * '/bsc' tên "Thẻ điểm BSC" nhưng thẻ điểm giờ chỉ là một trong bốn tab, cạnh
--     hạng mục, dashboard và bản đồ chiến lược.
--
-- Như V6/V8: chỉ chỉnh dòng ĐANG BẰNG giá trị seed cũ, tổ chức nào đã tự đặt tên riêng
-- thì giữ nguyên.

UPDATE sidebar_settings
SET custom_label = 'Quản lý kỳ/đợt đánh giá', updated_at = NOW()
WHERE menu_key = '/kpi-cycles'
  AND custom_label = 'Danh mục kỳ KPI';

-- '/kpi-periods' là khoá dự phòng của cùng mục đó (kỳ và đợt đã gộp về một trang). Sửa
-- luôn cho khớp thay vì xoá: tổ chức nào chỉ có dòng này mà không có '/kpi-cycles' thì
-- xoá đi sẽ rơi về nhãn mặc định, còn sửa thì hiện đúng tên mới.
UPDATE sidebar_settings
SET custom_label = 'Quản lý kỳ/đợt đánh giá', updated_at = NOW()
WHERE menu_key = '/kpi-periods'
  AND custom_label = 'Danh mục đợt KPI';

UPDATE sidebar_settings
SET custom_label = 'Quản lý BSC', updated_at = NOW()
WHERE menu_key = '/bsc'
  AND custom_label = 'Thẻ điểm BSC';
