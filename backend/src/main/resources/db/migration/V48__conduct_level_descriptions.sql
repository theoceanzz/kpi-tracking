-- Định nghĩa từng MỨC điểm của tiêu chí hạnh kiểm (VD thang 1–5: "5 = luôn chủ động…", "1 = thường xuyên…"),
-- bên cạnh các biểu hiện chung (cột description). JSON {"1": "...", "5": "..."}; null = không định nghĩa theo mức.
-- Dòng phiếu chụp lại lúc mở phiếu như tên / biểu hiện. Chỉ là hướng dẫn chấm — không đổi cách cộng điểm.
ALTER TABLE conduct_criteria
    ADD COLUMN IF NOT EXISTS level_descriptions JSONB;

ALTER TABLE conduct_evaluation_items
    ADD COLUMN IF NOT EXISTS criteria_level_descriptions JSONB;
