-- =====================================================================
-- BENCH DATA GENERATOR — CHỈ chạy trên DB bench riêng (kg_bench), KHÔNG chạy
-- trên DB dev hằng ngày và tuyệt đối không trên staging/prod.
--
-- Cách dùng (Windows, PG local):
--   createdb -U postgres kg_bench
--   psql -U postgres -d kg_bench -v ON_ERROR_STOP=1 -f src/main/resources/db/migration/V1__init_schema.sql
--   psql -U postgres -d kg_bench -v ON_ERROR_STOP=1 \
--        -v orgs=100 -v users_per_org=1000 -v notif_per_user=20 \
--        -v audit_rows=2000000 -v subs_per_user=5 -f db/bench/010_generate_data.sql
--
-- Mặc định bên dưới (100 org × 1.000 user = 100k user, 2M notification, 2M audit
-- log, 500k submission) tốn ~1,5 GB đĩa và ~3–5 phút trên laptop. Tăng dần —
-- 1M user × 20 notification = 20M dòng cần ~8 GB và ~30 phút; kiểm tra đĩa
-- trống trước (`SELECT pg_size_pretty(pg_database_size('kg_bench'))`).
-- =====================================================================
\set orgs           :orgs
\set users_per_org  :users_per_org
\set notif_per_user :notif_per_user
\set audit_rows     :audit_rows
\set subs_per_user  :subs_per_user

\timing on
SET synchronous_commit = off;      -- chỉ để nạp nhanh; không dùng ở prod
SET maintenance_work_mem = '512MB';

-- 1. Tổ chức
INSERT INTO organizations (id, name, code, status)
SELECT gen_random_uuid(), 'Org ' || g, 'ORG' || lpad(g::text, 5, '0'), 'ACTIVE'
FROM generate_series(1, :orgs) g;

-- 2. Một cấp hierarchy + một org unit gốc + 10 phòng ban mỗi tổ chức
INSERT INTO org_hierarchy_levels (id, organization_id, level_order, unit_type_name, role_level)
SELECT gen_random_uuid(), o.id, 1, 'Company', 1 FROM organizations o;

INSERT INTO org_units (id, name, code, parent_id, org_hierarchy_id, path, status)
SELECT gen_random_uuid(), o.name, o.code, NULL, h.id, '/' || o.code || '/', 'ACTIVE'
FROM organizations o JOIN org_hierarchy_levels h ON h.organization_id = o.id;

INSERT INTO org_units (id, name, code, parent_id, org_hierarchy_id, path, status)
SELECT gen_random_uuid(), root.name || ' D' || d, root.code || '-D' || d, root.id,
       root.org_hierarchy_id, root.path || 'D' || d || '/', 'ACTIVE'
FROM org_units root CROSS JOIN generate_series(1, 10) d
WHERE root.parent_id IS NULL;

-- 3. Người dùng: users_per_org mỗi tổ chức, rải đều vào 10 phòng ban.
--    Bảng tạm giữ mapping user → org_unit để các bước sau không phải join lại.
CREATE TEMP TABLE bench_users AS
SELECT gen_random_uuid() AS id,
       ou.id AS org_unit_id,
       ou.path AS org_unit_path,
       o.id AS organization_id,
       'u' || row_number() OVER () || '@bench.local' AS email
FROM organizations o
JOIN org_units ou ON ou.org_hierarchy_id = (SELECT id FROM org_hierarchy_levels WHERE organization_id = o.id)
                 AND ou.parent_id IS NOT NULL
CROSS JOIN generate_series(1, :users_per_org / 10) g;

INSERT INTO users (id, email, password, full_name, status, employee_code, created_at)
SELECT id, email, '$2a$10$benchbenchbenchbenchbenchbenchbenchbenchbenchbenchbench', 'Bench ' || email,
       'ACTIVE', 'EMP' || row_number() OVER (), now() - (random() * interval '365 days')
FROM bench_users;

-- 4. KPI period + criteria (1 period/org, 5 KPI/phòng ban)
INSERT INTO kpi_periods (id, organization_id, name, period_type, start_date, end_date)
SELECT gen_random_uuid(), id, 'Bench period', 'MONTHLY', now() - interval '30 days', now()
FROM organizations;

INSERT INTO kpi_criteria (id, org_unit_id, kpi_period_id, name, frequency, created_by, status)
SELECT gen_random_uuid(), ou.id, p.id, 'KPI ' || k, 'MONTHLY',
       (SELECT id FROM bench_users bu WHERE bu.org_unit_id = ou.id LIMIT 1), 'APPROVED'
FROM org_units ou
JOIN org_hierarchy_levels h ON h.id = ou.org_hierarchy_id
JOIN kpi_periods p ON p.organization_id = h.organization_id
CROSS JOIN generate_series(1, 5) k
WHERE ou.parent_id IS NOT NULL;

-- 5. Submissions: subs_per_user mỗi người, ngẫu nhiên trong 1 năm, 5% soft-deleted
INSERT INTO kpi_submissions (id, org_unit_id, kpi_criteria_id, submitted_by, actual_value, status,
                             period_start, created_at, deleted_at)
SELECT gen_random_uuid(), bu.org_unit_id, kc.id, bu.id, random() * 100,
       (ARRAY['PENDING','APPROVED','APPROVED','APPROVED','REJECTED'])[1 + floor(random() * 5)],
       ts, ts, CASE WHEN random() < 0.05 THEN ts + interval '1 day' END
FROM bench_users bu
JOIN LATERAL (SELECT id FROM kpi_criteria WHERE org_unit_id = bu.org_unit_id ORDER BY random() LIMIT :subs_per_user) kc ON true
CROSS JOIN LATERAL (SELECT now() - (random() * interval '365 days') AS ts) t;

-- 6. Notifications: notif_per_user mỗi người, 70% đã đọc, rải 1 năm
INSERT INTO notifications (id, org_unit_id, user_id, title, message, type, is_read, created_at)
SELECT gen_random_uuid(), bu.org_unit_id, bu.id, 'Thông báo ' || g, repeat('x', 120), 'KPI_REMINDER',
       random() < 0.7, now() - (random() * interval '365 days')
FROM bench_users bu CROSS JOIN generate_series(1, :notif_per_user) g;

-- 7. Security audit log: audit_rows dòng, rải 1 năm, 8 loại sự kiện
INSERT INTO security_audit_logs (id, event, outcome, user_id, user_email, organization_id, ip, request_id, created_at)
SELECT gen_random_uuid(),
       (ARRAY['LOGIN_SUCCESS','LOGIN_FAILURE','LOGOUT','TOKEN_REFRESH','PASSWORD_CHANGE','ROLE_ASSIGN','PERMISSION_DENIED','EXPORT'])[1 + floor(random() * 8)],
       CASE WHEN random() < 0.9 THEN 'SUCCESS' ELSE 'FAILURE' END,
       bu.id, bu.email, bu.organization_id,
       '10.0.' || floor(random() * 255) || '.' || floor(random() * 255),
       md5(g::text), now() - (random() * interval '365 days')
FROM generate_series(1, :audit_rows) g
JOIN LATERAL (SELECT id, email, organization_id FROM bench_users OFFSET floor(random() * (SELECT count(*) FROM bench_users)) LIMIT 1) bu ON true;

-- 8. Refresh tokens: 3 mỗi user, 60% đã hết hạn (mô phỏng chưa có job dọn)
INSERT INTO refresh_tokens (id, token, user_id, device_info, expires_at, revoked, created_at)
SELECT gen_random_uuid(), md5(bu.id::text || g), bu.id, 'device-' || g,
       CASE WHEN random() < 0.6 THEN now() - (random() * interval '60 days') ELSE now() + interval '7 days' END,
       random() < 0.2, now() - (random() * interval '90 days')
FROM bench_users bu CROSS JOIN generate_series(1, 3) g;

ANALYZE;
SELECT relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid)) AS total
FROM pg_stat_user_tables
WHERE relname IN ('users','notifications','security_audit_logs','kpi_submissions','refresh_tokens','kpi_criteria','org_units')
ORDER BY n_live_tup DESC;
SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size;
