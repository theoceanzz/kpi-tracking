-- Bật module Hạnh kiểm cho tổ chức demo và sinh phiếu mẫu, để cột "Giá trị cốt lõi" của hai bảng
-- xếp hạng trên trang Thống kê có số thật thay vì một cột toàn dấu gạch.
--
-- Chỉ chạm tổ chức demo (Demo Company). Bỏ qua toàn bộ nếu tổ chức đó đã có phiếu hạnh kiểm —
-- ai đó đã dùng thật thì không đè lên.
--
-- Điểm sinh tất định theo md5(user_id || đợt) nên chạy lại ra đúng bộ số; thang điểm lấy từ chính
-- bộ tiêu chí của tổ chức (`conduct_criteria_sets.max_score`), không viết cứng.

CREATE TEMP TABLE conduct_demo_guard ON COMMIT DROP AS
SELECT NOT EXISTS (
    SELECT 1 FROM conduct_evaluations
    WHERE organization_id = '11111111-1111-1111-1111-111111111111'
) AS ok;

UPDATE organizations SET enable_conduct = true
WHERE id = '11111111-1111-1111-1111-111111111111'
  AND (SELECT ok FROM conduct_demo_guard);

-- ── Phiếu theo ĐỢT: mỗi người một phiếu cho 6 đợt của 2026 ───────────────────
-- Điểm trải 2.6 → max: một dải đủ rộng để bảng xếp hạng không phẳng, và cao dần theo đợt để
-- đường xu hướng có hướng.
INSERT INTO conduct_evaluations (id, organization_id, user_id, kpi_period_id, conduct_criteria_set_id,
                                 scope, status, self_score, manager_score, max_score, evaluated_at,
                                 created_at, updated_at)
SELECT md5('conduct-demo:' || u.id::text || ':' || p.id::text)::uuid,
       '11111111-1111-1111-1111-111111111111', u.id, p.id, cs.id,
       'PERIOD', 'REVIEWED',
       ROUND((s.base + 0.2)::numeric, 1),
       s.base,
       cs.max_score, NOW(), NOW(), NOW()
FROM (SELECT DISTINCT r.user_id AS id FROM user_role_org_units r
      JOIN users us ON us.id = r.user_id AND us.deleted_at IS NULL
      WHERE r.org_unit_id IN (
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          'cccccccc-cccc-cccc-cccc-cccccccccccc', 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          'abcdefab-cdef-cdef-cdef-abcdefabcdef')) u
CROSS JOIN (SELECT id, start_date FROM kpi_periods
            WHERE organization_id = '11111111-1111-1111-1111-111111111111'
              AND start_date >= DATE '2026-01-01' AND name NOT LIKE '%-2026') p
JOIN conduct_criteria_sets cs ON cs.organization_id = '11111111-1111-1111-1111-111111111111'
 AND cs.is_default AND cs.deleted_at IS NULL
JOIN LATERAL (
    SELECT LEAST(cs.max_score,
                 2.6 + 0.1 * (EXTRACT(MONTH FROM p.start_date)::int - 1)
                     + 0.2 * (('x' || substr(md5(u.id::text || p.id::text), 1, 8))::bit(32)::bigint % 9)
    ) AS base
) s ON true
WHERE (SELECT ok FROM conduct_demo_guard);

-- ── Dòng chi tiết: chụp lại 4 tiêu chí của bộ, để màn hạnh kiểm mở ra không rỗng ─────────────
INSERT INTO conduct_evaluation_items (id, conduct_evaluation_id, criteria_id, criteria_name,
                                      criteria_description, weight, position_index,
                                      self_score, manager_score)
SELECT md5('conduct-demo-item:' || e.id::text || ':' || c.id::text)::uuid,
       e.id, c.id, c.name, c.description, c.weight, c.position_index,
       v.self_score, v.manager_score
FROM conduct_evaluations e
JOIN conduct_criteria c ON c.conduct_criteria_set_id = e.conduct_criteria_set_id
 AND c.deleted_at IS NULL
-- Điểm từng tiêu chí LỆCH quanh điểm tổng (±0,6), tất định theo (người, tiêu chí). Cho mọi tiêu
-- chí cùng một điểm thì radar ra đa giác ĐỀU — một hình vuông không nói được ai mạnh mặt nào,
-- tức là cả biểu đồ vô dụng.
JOIN LATERAL (
    SELECT GREATEST(1, LEAST(e.max_score, ROUND((e.manager_score + d.delta)::numeric, 1))) AS manager_score,
           GREATEST(1, LEAST(e.max_score, ROUND((e.self_score + d.self_delta)::numeric, 1))) AS self_score
    FROM (SELECT (ARRAY[-0.6, -0.3, 0.0, 0.2, 0.4, 0.6])[
             1 + (('x' || substr(md5(e.user_id::text || c.id::text), 1, 8))::bit(32)::bigint % 6)
          ] AS delta,
          -- Lệch RIÊNG cho cột tự chấm: dùng chung một lệch thì hai đa giác trên radar trùng khít
          -- nhau và chuỗi "Tự chấm" biến mất sau chuỗi "Quản lý chấm".
          (ARRAY[-0.4, 0.0, 0.3, 0.5, 0.7, 0.9])[
             1 + (('x' || substr(md5('self:' || e.user_id::text || c.id::text), 1, 8))::bit(32)::bigint % 6)
          ] AS self_delta) d
) v ON true
WHERE e.organization_id = '11111111-1111-1111-1111-111111111111'
  AND (SELECT ok FROM conduct_demo_guard);

-- ── Phiếu theo KỲ: bình quân các đợt thuộc kỳ ───────────────────────────────
-- ConductService tự rơi về bình quân phiếu đợt khi kỳ chưa có phiếu, nhưng chốt sẵn thì bảng xếp
-- hạng "theo kỳ" đọc đúng con số đã chốt thay vì con số suy ra.
INSERT INTO conduct_evaluations (id, organization_id, user_id, kpi_cycle_id, conduct_criteria_set_id,
                                 scope, status, self_score, manager_score, max_score, evaluated_at,
                                 created_at, updated_at)
SELECT md5('conduct-demo-cycle:' || e.user_id::text || ':' || p.kpi_cycle_id::text)::uuid,
       '11111111-1111-1111-1111-111111111111', e.user_id, p.kpi_cycle_id, (array_agg(e.conduct_criteria_set_id))[1],
       'CYCLE', 'REVIEWED',
       ROUND(AVG(e.self_score)::numeric, 1), ROUND(AVG(e.manager_score)::numeric, 1),
       MAX(e.max_score), NOW(), NOW(), NOW()
FROM conduct_evaluations e
JOIN kpi_periods p ON p.id = e.kpi_period_id AND p.kpi_cycle_id IS NOT NULL
WHERE e.organization_id = '11111111-1111-1111-1111-111111111111' AND e.scope = 'PERIOD'
  AND (SELECT ok FROM conduct_demo_guard)
GROUP BY e.user_id, p.kpi_cycle_id;
