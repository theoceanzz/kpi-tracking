-- Xếp loại ĐƠN VỊ theo KỲ: chụp lại kết quả xếp loại ngay lúc chốt kỳ.
--
-- Cần snapshot chứ không tính lại live vì luật xếp loại (Organization.unit_classification_rules)
-- và đánh giá của các đợt cũ đều có thể bị sửa sau khi kỳ đã chốt — tính lại sẽ làm đổi kết quả
-- đã công bố cho đơn vị. Bản DRAFT vẫn hiển thị số tính live như trước.
ALTER TABLE cycle_unit_evaluations
    ADD COLUMN IF NOT EXISTS classification         VARCHAR(255),  -- tên mức, VD "XUẤT SẮC" / "Loại 4"
    ADD COLUMN IF NOT EXISTS classification_color   VARCHAR(20),   -- màu hiển thị của mức (hex)
    ADD COLUMN IF NOT EXISTS classification_profile VARCHAR(255);  -- hồ sơ luật đã áp (null = preset)

COMMENT ON COLUMN cycle_unit_evaluations.classification IS
    'Xếp loại đơn vị chụp lúc chốt kỳ — áp luật xếp loại lên phân bố mức của thành viên trong kỳ';
