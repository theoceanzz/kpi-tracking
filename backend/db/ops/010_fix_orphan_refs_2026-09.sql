-- 010_fix_orphan_refs_2026-09.sql — dọn tham chiếu mồ côi phát hiện trên prod 2026-09-15
--
-- Hiện trạng (org demo 11111111-1111-1111-1111-111111111111):
--   * đợt "jbkjbkj" (248ecbff-8b28-4df4-a88a-d1ca8ca0cffe) xoá mềm 2026-07-13 nhưng còn 7 KPI active
--     trỏ tới -> dashboard / danh sách bài nộp / đánh giá của org demo đổ 500 từ tháng 7.
--   * user duc1999@gmail.com (5fd337ca-...) xoá mềm 2026-07-13, còn 48 bài nộp active — bài nộp của
--     người đã nghỉ là dữ liệu lịch sử hợp lệ, KHÔNG xoá; code (SoftDeletedRefs) đã hiển thị được.
--
-- Việc làm: xoá mềm các KPI thuộc đợt đã xoá mềm (mọi org, không chỉ demo) và bài nộp của các KPI
-- đó. Đây là xoá MỀM (set deleted_at) — hoàn tác bằng UPDATE ... SET deleted_at = NULL theo mốc thời
-- gian ghi ở cột deleted_at. Code mới (KpiPeriodService.deleteKpiPeriod) chặn không cho tái diễn.
--
-- Cách chạy: đọc phần PREVIEW trước; đồng ý thì bỏ comment khối APPLY. Chạy qua tunnel:
--   psql -h localhost -p 5433 -U postgres -d kpitracking -f backend/db/ops/010_fix_orphan_refs_2026-09.sql

\echo '===== PREVIEW: KPI active trỏ tới đợt đã xoá mềm'
SELECT k.id, k.name, k.status, p.name AS period_name, p.deleted_at AS period_deleted_at,
       (SELECT count(*) FROM kpi_submissions s WHERE s.kpi_criteria_id = k.id AND s.deleted_at IS NULL) AS active_submissions
  FROM kpi_criteria k
  JOIN kpi_periods p ON p.id = k.kpi_period_id
 WHERE k.deleted_at IS NULL AND p.deleted_at IS NOT NULL
 ORDER BY p.name, k.name;

\echo '===== PREVIEW: bài nộp active của user đã xoá mềm (chỉ thống kê — KHÔNG xoá)'
SELECT u.email, u.deleted_at, count(*) AS active_submissions
  FROM kpi_submissions s JOIN users u ON u.id = s.submitted_by
 WHERE s.deleted_at IS NULL AND u.deleted_at IS NOT NULL
 GROUP BY u.email, u.deleted_at;

-- ===== APPLY (bỏ comment sau khi xem preview) =====
-- BEGIN;
-- UPDATE kpi_submissions s
--    SET deleted_at = now()
--   FROM kpi_criteria k JOIN kpi_periods p ON p.id = k.kpi_period_id
--  WHERE s.kpi_criteria_id = k.id AND s.deleted_at IS NULL
--    AND k.deleted_at IS NULL AND p.deleted_at IS NOT NULL;
-- UPDATE kpi_criteria k
--    SET deleted_at = now()
--   FROM kpi_periods p
--  WHERE p.id = k.kpi_period_id AND k.deleted_at IS NULL AND p.deleted_at IS NOT NULL;
-- COMMIT;
--
-- Hoàn tác (trong vòng vài phút sau khi chạy, thay <mốc> bằng deleted_at vừa ghi):
-- UPDATE kpi_criteria    SET deleted_at = NULL WHERE deleted_at = '<mốc>';
-- UPDATE kpi_submissions SET deleted_at = NULL WHERE deleted_at = '<mốc>';
