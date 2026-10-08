-- AI chấm TỪNG bài (06/10): một lượt có thể chỉ chấm một số chỉ tiêu; mỗi chỉ tiêu có mức tin cậy riêng do mã
-- nguồn tính từ căn cứ (câu trích thật, số tệp đọc được, bộ tiêu chí).

-- Phạm vi của lượt: id chỉ tiêu, mỗi dòng một id. NULL = lượt cả phiếu (như trước).
ALTER TABLE ai_submission_reviews ADD COLUMN IF NOT EXISTS scope_criteria_ids TEXT;

-- Mức tin cậy riêng của chỉ tiêu (CAO / TRUNG_BINH / THAP) + mã lý do (mỗi dòng một mã) + số tệp đọc được.
-- Item của lượt cũ để NULL: giao diện dùng mức chung của lượt.
ALTER TABLE ai_submission_review_items ADD COLUMN IF NOT EXISTS confidence VARCHAR(20);
ALTER TABLE ai_submission_review_items ADD COLUMN IF NOT EXISTS confidence_reasons TEXT;
ALTER TABLE ai_submission_review_items ADD COLUMN IF NOT EXISTS files_read INT;
ALTER TABLE ai_submission_review_items ADD COLUMN IF NOT EXISTS files_total INT;
