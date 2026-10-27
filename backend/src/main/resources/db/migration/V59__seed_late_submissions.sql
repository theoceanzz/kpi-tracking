-- Vài ca NỘP MUỘN và THIẾU BÀI cho tổ chức demo, để ô "Tỉ lệ trễ hẹn" trên trang thống kê chi tiết
-- một người có số khác 0.
--
-- Trước file này 472/472 bài nộp của demo đều tạo trước khi đợt đóng, nên ô đó luôn hiện 0% — đúng
-- nhưng không nói lên điều gì, và không ai biết nó có chạy hay không.
--
-- Chỉ chạm tổ chức demo. Bỏ qua toàn bộ nếu đã có bài nộp muộn (file đã chạy, hoặc có dữ liệu thật).

CREATE TEMP TABLE late_demo_guard ON COMMIT DROP AS
SELECT NOT EXISTS (
    SELECT 1 FROM kpi_submissions s
    JOIN kpi_criteria k ON k.id = s.kpi_criteria_id
    JOIN kpi_periods p ON p.id = k.kpi_period_id
    WHERE p.organization_id = '11111111-1111-1111-1111-111111111111'
      AND s.deleted_at IS NULL AND s.created_at > p.end_date
) AS ok;

-- ── Nộp MUỘN: đẩy ngày tạo ra sau khi đợt đóng ──────────────────────────────
-- Chọn tất định ~1/6 số bài theo md5(id) nên chạy lại ra đúng bộ cũ.
UPDATE kpi_submissions s
SET created_at = p.end_date + INTERVAL '2 days' + (('x' || substr(md5(s.id::text), 1, 4))::bit(16)::bigint % 72) * INTERVAL '1 hour'
FROM kpi_criteria k, kpi_periods p
WHERE k.id = s.kpi_criteria_id AND p.id = k.kpi_period_id
  AND p.organization_id = '11111111-1111-1111-1111-111111111111'
  AND s.deleted_at IS NULL
  AND p.end_date IS NOT NULL
  AND (('x' || substr(md5(s.id::text), 5, 8))::bit(32)::bigint % 6) = 0
  AND (SELECT ok FROM late_demo_guard);

-- ── THIẾU bài: xoá mềm một ít bài để có cả trường hợp "không nộp gì" ────────
-- Trễ hẹn tính cả kỳ không có bài nào: "chưa nộp" và "nộp muộn" đều là lỗi hẹn.
UPDATE kpi_submissions s
SET deleted_at = NOW()
FROM kpi_criteria k, kpi_periods p
WHERE k.id = s.kpi_criteria_id AND p.id = k.kpi_period_id
  AND p.organization_id = '11111111-1111-1111-1111-111111111111'
  AND s.deleted_at IS NULL
  AND (('x' || substr(md5('missing:' || s.id::text), 1, 8))::bit(32)::bigint % 14) = 0
  AND (SELECT ok FROM late_demo_guard);
