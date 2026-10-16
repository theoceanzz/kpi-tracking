-- BSC "giao cả bộ" kiểu mới: đơn vị nhận TOÀN BỘ chỉ tiêu của thẻ nguồn (mỗi chỉ tiêu một dòng khoá,
-- kiểu "cùng chịu chung"), thay cho MỘT dòng "Kết quả cấp trên". Cột này đánh dấu dòng sinh ra từ giao
-- cả bộ và giữ trọng số X% mà cấp trên đặt cho CẢ BỘ ở đơn vị đó (trọng số từng dòng = trọng số dòng
-- nguồn × X / 100). NULL = dòng phân rã từng chỉ tiêu hoặc dòng tự có.
ALTER TABLE bsc_scorecard_perspectives ADD COLUMN IF NOT EXISTS whole_share_percent DOUBLE PRECISION;
