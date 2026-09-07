-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- V5 — NẮN `created_at` CỦA BÀI NỘP VỀ ĐÚNG THÁNG CỦA KỲ
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- ⚠️  Nhắc lại cảnh báo của V4: TUYỆT ĐỐI KHÔNG sửa V1–V4. FlywayConfig gọi flyway.clean() khi
--     checksum lệch, tức xoá sạch database. Mọi điều chỉnh dữ liệu đã seed phải là file mới.
--
-- VẤN ĐỀ
-- V2 chèn kpi_submissions mà không đặt `created_at`, nên cột này lấy DEFAULT NOW() — tức là NGÀY
-- CHẠY MIGRATION, không phải tháng mà bài nộp thuộc về. Hệ quả: một bài nộp của kỳ "Tháng 4/2026"
-- lại mang dấu thời gian tháng 8/2026.
--
-- Điều đó vô hại với mọi màn hình đang có (chúng lọc theo kpi_period_id), nhưng biểu đồ "Cơ cấu bài
-- nộp theo thời gian" gom theo `created_at`. Kết quả là toàn bộ 156 bài nộp của V2 dồn vào đúng một
-- cột — cao gấp ba các tháng khác — tạo ra một đỉnh không có thật ở tháng mà thực tế không ai nộp
-- gì. Người xem sẽ tưởng biểu đồ hỏng, và đó là cách nhanh nhất làm mất lòng tin vào cả trang.
--
-- CÁCH SỬA
-- Đưa `created_at` về ngày 10 của tháng thuộc kỳ — cùng quy ước V4 đã dùng cho bài nộp mới, để hai
-- lô dữ liệu không lệch nhau. Chỉ chạm những dòng đang nằm NGOÀI cửa sổ kỳ của chính nó, nên bài
-- nộp nào đã đúng chỗ thì giữ nguyên, và chạy lại file này bao nhiêu lần cũng ra cùng kết quả.

UPDATE kpi_submissions s
SET created_at = p.start_date + INTERVAL '10 days',
    updated_at = p.start_date + INTERVAL '10 days'
FROM kpi_criteria k
JOIN kpi_periods p ON p.id = k.kpi_period_id
WHERE k.id = s.kpi_criteria_id
  AND s.deleted_at IS NULL
  AND p.start_date IS NOT NULL
  AND p.end_date IS NOT NULL
  AND (s.created_at < p.start_date OR s.created_at > p.end_date);

-- Ngày duyệt phải nằm sau ngày nộp, nếu không màn hình chi tiết bài nộp hiện một dòng thời gian đi
-- ngược. Chỉ nắn những dòng đã bị lệch bởi cùng nguyên nhân trên.
UPDATE kpi_submissions s
SET reviewed_at = p.end_date - INTERVAL '2 days'
FROM kpi_criteria k
JOIN kpi_periods p ON p.id = k.kpi_period_id
WHERE k.id = s.kpi_criteria_id
  AND s.deleted_at IS NULL
  AND s.reviewed_at IS NOT NULL
  AND p.end_date IS NOT NULL
  AND (s.reviewed_at < s.created_at OR s.reviewed_at > p.end_date);
