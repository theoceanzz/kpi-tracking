-- V9: Ghim cuộc trò chuyện của trợ lý K.AI.
--
-- pinned_at thay vì cờ boolean: vừa biết có ghim hay không, vừa xếp được "ghim gần nhất lên đầu"
-- mà không cần thêm cột thứ tự. Bảng conversations nhỏ (mỗi người vài chục dòng) nên không cần
-- index riêng; danh sách vốn đã lọc theo user_id.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;
