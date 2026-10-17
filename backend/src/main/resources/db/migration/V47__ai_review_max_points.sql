-- AI chỉ chấm CHẤT LƯỢNG bài nộp, trên thang điểm riêng (người dùng chốt 13/10).
-- Điểm AI = % mức chất lượng × điểm tối đa do công ty đặt (mặc định 10), không chia từ thang 100 của định lượng /
-- định tính và không còn trọng số đạt chỉ tiêu / chất lượng / đúng hạn.
-- Cột trọng số cũ (organizations.ai_review_weight_*, ai_review_unit_settings.weight_*) giữ nguyên, đều có DEFAULT
-- nên code thôi ghi là đủ.

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS ai_review_max_points NUMERIC(6, 2) NOT NULL DEFAULT 10;

-- Bản ghi riêng của đơn vị đang BẬT AI chỉ để mang trọng số riêng — nay vô nghĩa. Còn lại là "đơn vị này tắt AI".
DELETE FROM ai_review_unit_settings WHERE enabled = true;
