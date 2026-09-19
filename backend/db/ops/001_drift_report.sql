-- 001_drift_report.sql
-- Mục đích : CHỈ ĐỌC. Xuất schema thật (cột, index, constraint, thống kê) để đối chiếu
--            với V1__init_schema.sql — xem docs/DATABASE_SCALING.md mục "Drift report".
-- Lock     : không. Thời gian: < 5 s. Chạy bất kỳ lúc nào, cả prod.
-- Cách dùng:
--   psql -U postgres -d kpitracking -f backend/db/ops/001_drift_report.sql > drift_prod.txt   (KHÔNG dùng -v ON_ERROR_STOP=1 cho file này)
--   psql -U postgres -d kpitracking -f backend/db/ops/001_drift_report.sql > drift_local.txt
--   diff drift_local.txt drift_prod.txt
-- Không ghi gì vào DB — chạy lại bao nhiêu lần cũng được.
\pset pager off
\pset format unaligned
\pset fieldsep ' | '

\echo '===== SERVER'
SELECT version();
SHOW max_connections;
SHOW shared_buffers;
SHOW shared_preload_libraries;
SHOW max_wal_size;

\echo '===== FLYWAY'
SELECT installed_rank, version, description, checksum, installed_on, success FROM flyway_schema_history ORDER BY installed_rank;

\echo '===== TABLES (n_live_tup, dead, size)'
SELECT relname, n_live_tup, n_dead_tup, pg_size_pretty(pg_total_relation_size(relid)) AS total,
       last_autovacuum, last_autoanalyze
  FROM pg_stat_user_tables ORDER BY relname;

\echo '===== COLUMNS'
SELECT table_name, column_name, data_type,
       COALESCE(character_maximum_length::text, '') AS len,
       is_nullable, COALESCE(column_default, '') AS col_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
 ORDER BY table_name, ordinal_position;

\echo '===== INDEXES (định nghĩa)'
SELECT tablename, indexname, indexdef
  FROM pg_indexes WHERE schemaname = 'public'
 ORDER BY tablename, indexname;

\echo '===== INDEX USAGE (idx_scan = 0 sau thời gian dài => ứng viên bỏ)'
SELECT s.relname AS tablename, s.indexrelname AS indexname, s.idx_scan,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS size, i.indisvalid
  FROM pg_stat_user_indexes s JOIN pg_index i ON i.indexrelid = s.indexrelid
 ORDER BY s.relname, s.idx_scan;

\echo '===== CONSTRAINTS (tên hash uk*/fk* = do Hibernate sinh, không có trong V1)'
SELECT conrelid::regclass AS tablename, conname, contype, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
 WHERE connamespace = 'public'::regnamespace
 ORDER BY conrelid::regclass::text, conname;

\echo '===== TABLE STORAGE PARAMS (autovacuum theo bảng)'
SELECT relname, reloptions FROM pg_class
 WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND reloptions IS NOT NULL
 ORDER BY relname;

\echo '===== PARTITIONED TABLES'
SELECT inhparent::regclass AS parent, inhrelid::regclass AS partition
  FROM pg_inherits ORDER BY 1, 2;
