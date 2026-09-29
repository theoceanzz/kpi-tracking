-- Bộ tiêu chí: người duyệt đã đối chiếu tài liệu và xác nhận dòng đúng dù máy không thấy nguyên văn đoạn gốc
-- (bảng PDF xếp chữ khác thứ tự, mô hình chép gộp ô…). Máy kiểm (excerpt_verified) và người xác nhận tách riêng
-- để biết dòng nào do người chịu trách nhiệm.
ALTER TABLE ai_criteria_set_items ADD COLUMN IF NOT EXISTS reviewer_confirmed BOOLEAN NOT NULL DEFAULT FALSE;
