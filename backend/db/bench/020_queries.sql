-- =====================================================================
-- BENCH QUERIES — các câu truy vấn thật của ứng dụng (lấy từ repository) chạy
-- trên kg_bench. Chạy TRƯỚC và SAU khi áp dụng db/ops/*.sql để so sánh.
--   psql -U postgres -d kg_bench -f db/bench/020_queries.sql
-- Chỉ in dòng "Execution Time" và node đầu tiên cho gọn; bỏ `\o` để xem full plan.
-- =====================================================================
\timing off
\pset pager off

-- Chọn user có NHIỀU thông báo nhất (người quản lý/HR nhận thông báo liên tục) — đo đúng
-- trường hợp xấu; user 20 thông báo thì index nào cũng nhanh.
SELECT user_id AS uid FROM notifications GROUP BY user_id ORDER BY count(*) DESC LIMIT 1 \gset
SELECT organization_id AS orgid FROM security_audit_logs LIMIT 1 \gset
SELECT kpi_criteria_id AS kid, submitted_by AS sid FROM kpi_submissions LIMIT 1 \gset

\echo '--- Q1 notifications: NotificationRepository.findByUserIdOrderByCreatedAtDesc, trang 0 (size 20)'
EXPLAIN (ANALYZE, BUFFERS, SUMMARY ON, TIMING OFF)
SELECT * FROM notifications WHERE user_id = :'uid' ORDER BY created_at DESC LIMIT 20 OFFSET 0;

\echo '--- Q2 notifications: COUNT(*) đi kèm Page<T> (Spring Data chạy thêm câu này mỗi lần)'
EXPLAIN (ANALYZE, BUFFERS, SUMMARY ON, TIMING OFF)
SELECT count(*) FROM notifications WHERE user_id = :'uid';

\echo '--- Q3 notifications: countByUserIdAndIsReadFalse (badge, gọi mỗi lần mở app)'
EXPLAIN (ANALYZE, BUFFERS, SUMMARY ON, TIMING OFF)
SELECT count(*) FROM notifications WHERE user_id = :'uid' AND is_read = false;

\echo '--- Q4 notifications: keyset (đề xuất thay OFFSET)'
SELECT created_at AS cts, id AS cid FROM notifications WHERE user_id = :'uid'
 ORDER BY created_at DESC, id DESC OFFSET 1000 LIMIT 1 \gset
EXPLAIN (ANALYZE, BUFFERS, SUMMARY ON, TIMING OFF)
SELECT * FROM notifications WHERE user_id = :'uid'
   AND (created_at, id) < (:'cts'::timestamptz, :'cid'::uuid)
 ORDER BY created_at DESC, id DESC LIMIT 20;

\echo '--- Q4b notifications: OFFSET 1000 (trang 50) để so với keyset'
EXPLAIN (ANALYZE, BUFFERS, SUMMARY ON, TIMING OFF)
SELECT * FROM notifications WHERE user_id = :'uid' ORDER BY created_at DESC LIMIT 20 OFFSET 1000;

\echo '--- Q5 refresh_tokens: RefreshTokenRepository.deleteExpiredTokens (chưa ai gọi định kỳ) — chỉ EXPLAIN, không xoá'
EXPLAIN (BUFFERS, SUMMARY ON)
DELETE FROM refresh_tokens WHERE expires_at < now();

\echo '--- Q6 refresh_tokens: findByTokenAndRevokedFalse'
EXPLAIN (ANALYZE, BUFFERS, SUMMARY ON, TIMING OFF)
SELECT * FROM refresh_tokens WHERE token = (SELECT token FROM refresh_tokens LIMIT 1) AND revoked = false;

\echo '--- Q7 kpi_submissions: countByKpiCriteriaIdAndSubmittedByIdAndDeletedAtIsNull (gọi mỗi KPI trong danh sách)'
EXPLAIN (ANALYZE, BUFFERS, SUMMARY ON, TIMING OFF)
SELECT count(*) FROM kpi_submissions WHERE kpi_criteria_id = :'kid' AND submitted_by = :'sid' AND deleted_at IS NULL;

\echo '--- Q8 kpi_submissions: findBySubmittedByIdOrderByCreatedAtDesc (lịch sử nộp của 1 người)'
EXPLAIN (ANALYZE, BUFFERS, SUMMARY ON, TIMING OFF)
SELECT * FROM kpi_submissions WHERE submitted_by = :'sid' ORDER BY created_at DESC;

\echo '--- Q9 security_audit_logs: tra cứu theo org + event 30 ngày gần nhất'
EXPLAIN (ANALYZE, BUFFERS, SUMMARY ON, TIMING OFF)
SELECT * FROM security_audit_logs WHERE organization_id = :'orgid' AND event = 'LOGIN_FAILURE'
   AND created_at > now() - interval '30 days' ORDER BY created_at DESC LIMIT 100;

\echo '--- Q10 security_audit_logs: DELETE > 180 ngày (retention không partition) — chỉ EXPLAIN'
EXPLAIN (BUFFERS, SUMMARY ON)
DELETE FROM security_audit_logs WHERE created_at < now() - interval '180 days';

\echo '--- Kích thước index các bảng nóng'
SELECT tablename, indexname, pg_size_pretty(pg_relation_size((schemaname||'.'||indexname)::regclass)) AS size
FROM pg_indexes WHERE schemaname='public'
  AND tablename IN ('notifications','security_audit_logs','kpi_submissions','refresh_tokens')
ORDER BY tablename, pg_relation_size((schemaname||'.'||indexname)::regclass) DESC;
