-- V31 — Điểm AI cho chỉ tiêu ĐỊNH TÍNH (người dùng chốt 30/09): cũng chia 60/30/10 nhưng trên THANG HÀNH VI riêng
-- (100 chia theo trọng số các chỉ tiêu định tính), không cộng vào điểm đánh giá 100 của chỉ tiêu định lượng — đúng như
-- hệ thống tách điểm KPI và điểm hành vi. Cột này để báo cáo lệch AI–quản lý chỉ cộng phần định lượng.

ALTER TABLE ai_submission_review_items
    ADD COLUMN IF NOT EXISTS qualitative BOOLEAN NOT NULL DEFAULT false;
