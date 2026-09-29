-- Bộ tiêu chí bóc ĐẦY ĐỦ mọi mục của quy chế, không chỉ mục đánh giá: thêm hai loại dòng
--   NHIEM_VU (chức năng / nhiệm vụ bộ phận, vai trò) và THUONG (quy định thưởng).
ALTER TABLE ai_criteria_set_items DROP CONSTRAINT IF EXISTS ai_criteria_set_items_kind_check;
ALTER TABLE ai_criteria_set_items
    ADD CONSTRAINT ai_criteria_set_items_kind_check
        CHECK (kind IN ('TIEU_CHI', 'THANG_MUC', 'THAM_KHAO', 'NHIEM_VU', 'THUONG'));
