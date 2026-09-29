-- 020_cycle_overlap_report.sql
-- Mục đích : CHỈ ĐỌC. Liệt kê các cặp kỳ CÙNG TỔ CHỨC + CÙNG LOẠI có thời gian chồng lấn nhau,
--            trước khi bật luật chống chồng lấn (app.kpi.cycle-overlap-check) trên prod.
--            Luật chỉ áp cho thao tác tạo/sửa MỚI — dữ liệu cũ không bị sửa, nhưng kỳ đang chồng
--            lấn sẽ không đổi được ngày (và gia hạn khi khoá kỳ sẽ bị từ chối) cho tới khi xử lý.
-- Lock     : không. Chạy bất kỳ lúc nào, cả prod.
-- Cách dùng:
--   psql -U postgres -d kpitracking -f backend/db/ops/020_cycle_overlap_report.sql
--   docker exec -i <container-db> psql -U postgres -d kpitracking < backend/db/ops/020_cycle_overlap_report.sql
\pset pager off

\echo '===== TÓM TẮT: số cặp kỳ chồng lấn theo tổ chức'
SELECT o.name                AS to_chuc,
       a.cycle_type          AS loai_ky,
       COUNT(*)              AS so_cap_chong_lan
  FROM kpi_cycles a
  JOIN kpi_cycles b
    ON b.organization_id = a.organization_id
   AND b.cycle_type      = a.cycle_type
   AND a.id < b.id
   AND a.start_date < b.end_date
   AND b.start_date < a.end_date
  JOIN organizations o ON o.id = a.organization_id
 WHERE a.deleted_at IS NULL AND b.deleted_at IS NULL
   AND a.start_date IS NOT NULL AND a.end_date IS NOT NULL
   AND b.start_date IS NOT NULL AND b.end_date IS NOT NULL
 GROUP BY o.name, a.cycle_type
 ORDER BY so_cap_chong_lan DESC, o.name;

\echo '===== CHI TIẾT từng cặp (số ngày chồng lấn, số đợt mỗi kỳ)'
SELECT o.name                                              AS to_chuc,
       a.cycle_type                                        AS loai_ky,
       a.name                                              AS ky_a,
       to_char(a.start_date AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY') || ' – ' ||
       to_char(a.end_date   AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY') AS thoi_gian_a,
       b.name                                              AS ky_b,
       to_char(b.start_date AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY') || ' – ' ||
       to_char(b.end_date   AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY') AS thoi_gian_b,
       ROUND(EXTRACT(EPOCH FROM (LEAST(a.end_date, b.end_date) - GREATEST(a.start_date, b.start_date))) / 86400.0, 1)
                                                           AS so_ngay_chong,
       (SELECT COUNT(*) FROM kpi_periods p WHERE p.kpi_cycle_id = a.id AND p.deleted_at IS NULL) AS dot_a,
       (SELECT COUNT(*) FROM kpi_periods p WHERE p.kpi_cycle_id = b.id AND p.deleted_at IS NULL) AS dot_b,
       a.id AS id_a,
       b.id AS id_b
  FROM kpi_cycles a
  JOIN kpi_cycles b
    ON b.organization_id = a.organization_id
   AND b.cycle_type      = a.cycle_type
   AND a.id < b.id
   AND a.start_date < b.end_date
   AND b.start_date < a.end_date
  JOIN organizations o ON o.id = a.organization_id
 WHERE a.deleted_at IS NULL AND b.deleted_at IS NULL
   AND a.start_date IS NOT NULL AND a.end_date IS NOT NULL
   AND b.start_date IS NOT NULL AND b.end_date IS NOT NULL
 ORDER BY o.name, a.cycle_type, a.start_date;

\echo '===== Kỳ thiếu ngày bắt đầu/kết thúc (luật chồng lấn và gia hạn bỏ qua các kỳ này)'
SELECT o.name AS to_chuc, c.name AS ky, c.cycle_type AS loai_ky, c.start_date, c.end_date, c.id
  FROM kpi_cycles c
  JOIN organizations o ON o.id = c.organization_id
 WHERE c.deleted_at IS NULL AND (c.start_date IS NULL OR c.end_date IS NULL)
 ORDER BY o.name, c.name;
