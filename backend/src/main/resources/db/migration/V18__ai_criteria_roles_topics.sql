-- Bộ tiêu chí: VAI TRÒ cố định (AI dùng dòng thế nào) + CHỦ ĐỀ động (lấy từ chính tài liệu), và loại tài liệu
-- đã dùng để bóc. Văn bản tự do ít mảng nội dung ra ít nhóm, nhiều mảng ra nhiều nhóm — không còn 5 loại cứng.
--   TIEU_CHI căn cứ chấm · THANG_MUC thang mức · THAM_KHAO AI đọc khi chấm · TRA_CUU chỉ tra cứu.

ALTER TABLE ai_criteria_set_items ADD COLUMN IF NOT EXISTS topic VARCHAR(120);

-- Bỏ ràng buộc cũ TRƯỚC khi đổi dữ liệu (ràng buộc V17 chưa có TRA_CUU).
ALTER TABLE ai_criteria_set_items DROP CONSTRAINT IF EXISTS ai_criteria_set_items_kind_check;

-- Hai loại cũ thực chất là chủ đề: chuyển sang vai trò tra cứu + chủ đề tương ứng.
UPDATE ai_criteria_set_items SET topic = COALESCE(topic, 'Nhiệm vụ bộ phận'), kind = 'TRA_CUU' WHERE kind = 'NHIEM_VU';
UPDATE ai_criteria_set_items SET topic = COALESCE(topic, 'Thưởng'), kind = 'TRA_CUU' WHERE kind = 'THUONG';

ALTER TABLE ai_criteria_set_items
    ADD CONSTRAINT ai_criteria_set_items_kind_check CHECK (kind IN ('TIEU_CHI', 'THANG_MUC', 'THAM_KHAO', 'TRA_CUU'));

-- Loại tài liệu (DocumentProfile) đã dùng để bóc: quyết định bộ nhóm, cách cắt mục khi nạp kho lúc xác nhận.
ALTER TABLE ai_criteria_sets ADD COLUMN IF NOT EXISTS profile VARCHAR(40);
