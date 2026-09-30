-- V30 — Điểm AI gợi ý trên THANG ĐIỂM ĐÁNH GIÁ, chia ba phần (người dùng chốt 30/09).
--
-- Mỗi chỉ tiêu định lượng chiếm "điểm tối đa" = trọng số × 100 / Σ trọng số định lượng (cùng thang với ô quản lý
-- nhập ở màn chấm). Điểm tối đa chia theo ba trọng số của tổ chức (mặc định 60/30/10): đạt chỉ tiêu, chất lượng,
-- đúng hạn — đủ cả ba là đủ điểm. suggested_score từ nay cũng ở thang này. Dòng cũ để NULL (giao diện hiện kiểu cũ).

ALTER TABLE ai_submission_review_items
    ADD COLUMN IF NOT EXISTS max_points     NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS target_points  NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS quality_points NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS on_time_points NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS system_points  NUMERIC(6,2);
