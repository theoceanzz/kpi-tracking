-- ============================================================================
-- V13 — Seed cây thẻ điểm BSC ba tầng cho Demo Company (khối 18.9, trước nằm cuối V2).
--
-- Tách khỏi V2 vì V1/V2 đã ĐÓNG BĂNG (checksum trên prod và mọi DB dev được repair một lần,
-- 15/09/2026): mọi thay đổi schema/seed từ đó đi bằng file V{n} mới. Khối này vốn idempotent
-- (id sinh từ md5 của khoá nghiệp vụ, ON CONFLICT DO NOTHING, UPDATE có điều kiện) nên DB dev đã
-- chạy nó trong V2 bản cũ vẫn áp lại an toàn; DB không có Demo Company thì không có dòng nào khớp.
-- ============================================================================

-- ============================================================================
-- 18.9 Cây thẻ điểm BSC của Demo Company: Công ty → Phòng → Team, phân rã chỉ tiêu và kết quả đợt.
--
-- Tab "Hạng mục BSC" ở Thống kê đọc mô hình THẺ ĐIỂM (cây thẻ, kết quả đợt `bsc_unit_results`,
-- phân rã `parent_item_id`, hạng mục chặn). Seed cũ chỉ có thẻ CÔNG TY cho mỗi đợt, nên toàn bộ tab
-- trống — người xem demo không biết tab đó để làm gì. Khối này dựng đủ một cây ba tầng cho cả 12
-- đợt để mọi ô có số.
--
-- Mọi id sinh từ md5 của khoá nghiệp vụ (đơn vị + đợt + hạng mục) nên chạy lại bao nhiêu lần cũng
-- ra đúng bộ id đó, và ON CONFLICT DO NOTHING giữ cho khối này idempotent.
--
-- Chỉ chạm Demo Company (DEMO1): Demo Education giữ nguyên thẻ công ty đơn lẻ để còn một tổ chức
-- minh hoạ trạng thái "chưa phân rã".
-- ============================================================================

-- 18.9.1 Mục tiêu cho bốn chỉ tiêu ở thẻ CÔNG TY của Demo Company. Seed hạng mục không có mục
-- tiêu (target NULL) thì độ phủ phân rã không so được đủ/thiếu và bullet không có vạch mục tiêu.
UPDATE bsc_scorecard_perspectives sp
SET target_value = v.target, minimum_value = v.minimum, unit = v.unit,
    is_gate = v.is_gate, gate_min_percent = CASE WHEN v.is_gate THEN 70 END,
    gate_effect = CASE WHEN v.is_gate THEN 'WARN_ONLY' END, gate_applies_to = 'BOTH'
FROM bsc_scorecards s
JOIN bsc_perspectives p ON p.organization_id = s.organization_id AND p.deleted_at IS NULL
JOIN (VALUES
    ('FINANCIAL',        120.0, 100.0, 'tỷ đồng', FALSE),
    ('CUSTOMER',          90.0,  80.0, '%',       FALSE),
    ('INTERNAL_PROCESS',  95.0,  85.0, '%',       TRUE),
    ('LEARNING_GROWTH',   40.0,  24.0, 'giờ',     FALSE)
) AS v(code, target, minimum, unit, is_gate) ON v.code = p.code
WHERE sp.scorecard_id = s.id AND sp.perspective_id = p.id
  AND s.organization_id = '11111111-1111-1111-1111-111111111111'
  AND s.level = 'COMPANY' AND s.deleted_at IS NULL
  AND sp.target_value IS NULL;

-- 18.9.2 Thẻ điểm ĐƠN VỊ: hai phòng nối vào thẻ công ty của đợt, bốn team nối vào thẻ phòng.
-- id = md5('bsc-sc' + đơn vị + đợt) để bước sau nối cha–con mà không cần RETURNING.
INSERT INTO bsc_scorecards
    (id, organization_id, apply_scope, name, vision, level, parent_scorecard_id, status, scoring_mode, empty_perspective_policy, created_at, updated_at)
SELECT ('7b' || substr(md5('bsc-sc:' || u.id::text || ':' || p.id::text), 3))::uuid,
       s.organization_id, 'PERIOD',
       'BSC ' || u.name || ' — ' || p.name,
       'Phân rã từ thẻ điểm công ty.',
       'UNIT',
       CASE WHEN u.parent_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' THEN s.id
            ELSE ('7b' || substr(md5('bsc-sc:' || u.parent_id::text || ':' || p.id::text), 3))::uuid END,
       -- Đợt mới nhất còn ở trạng thái chờ duyệt để tab có gì đó không phải "đang áp dụng" 100%.
       CASE WHEN p.start_date >= '2026-06-01' THEN 'SUBMITTED' ELSE 'ACTIVE' END,
       'SHADOW', 'RENORMALIZE',
       p.start_date - INTERVAL '5 days', p.start_date - INTERVAL '5 days'
FROM bsc_scorecards s
JOIN bsc_scorecard_periods spd ON spd.scorecard_id = s.id
JOIN kpi_periods p ON p.id = spd.kpi_period_id
JOIN org_units u ON u.deleted_at IS NULL AND u.id IN (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc',   -- Phòng IT, Phòng Truyền Thông
    'dddddddd-dddd-dddd-dddd-dddddddddddd', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',   -- Team Backend, Team Frontend
    'abcdefab-cdef-cdef-cdef-abcdefabcdef', 'ffffffff-ffff-ffff-ffff-ffffffffffff')   -- Team Design, Team Content
WHERE s.organization_id = '11111111-1111-1111-1111-111111111111'
  AND s.level = 'COMPANY' AND s.deleted_at IS NULL
-- Nối theo thứ tự: phòng trước (cha đã có), team sau. Postgres chèn theo thứ tự SELECT nên sắp
-- theo độ sâu là đủ; FK tự tham chiếu kiểm ngay từng dòng.
ORDER BY CASE WHEN u.parent_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' THEN 0 ELSE 1 END
ON CONFLICT (id) DO NOTHING;

-- Gắn đơn vị + đợt cho thẻ vừa tạo: tìm lại (đơn vị, đợt) có md5 khớp id thẻ.
INSERT INTO bsc_scorecard_org_units (scorecard_id, org_unit_id)
SELECT s.id, u.id
FROM bsc_scorecards s
CROSS JOIN kpi_periods p
CROSS JOIN org_units u
WHERE s.organization_id = '11111111-1111-1111-1111-111111111111' AND s.level = 'UNIT'
  AND p.organization_id = s.organization_id
  AND ('7b' || substr(md5('bsc-sc:' || u.id::text || ':' || p.id::text), 3))::uuid = s.id
ON CONFLICT DO NOTHING;

INSERT INTO bsc_scorecard_periods (scorecard_id, kpi_period_id)
SELECT s.id, p.id
FROM bsc_scorecards s
CROSS JOIN kpi_periods p
CROSS JOIN org_units u
WHERE s.organization_id = '11111111-1111-1111-1111-111111111111' AND s.level = 'UNIT'
  AND p.organization_id = s.organization_id
  AND ('7b' || substr(md5('bsc-sc:' || u.id::text || ':' || p.id::text), 3))::uuid = s.id
ON CONFLICT DO NOTHING;

-- 18.9.3 Dòng chỉ tiêu của thẻ đơn vị: chép bốn dòng của thẻ cha, gắn `parent_item_id` (phân rã),
-- origin ASSIGNED + locked (cấp trên giao). Kiểu liên kết:
--   FINANCIAL, LEARNING_GROWTH = SUM   (mỗi đơn vị gánh một phần con số: 50%/50% phòng, 50%/50% team)
--   CUSTOMER, INTERNAL_PROCESS = SHARED (cùng một tỉ lệ, không cộng dồn)
-- Riêng LEARNING_GROWTH cho phòng chỉ nhận 40% mỗi phòng → độ phủ "thiếu" để ô độ phủ có màu.
INSERT INTO bsc_scorecard_perspectives
    (id, scorecard_id, perspective_id, weight_percentage, display_order, target_value, minimum_value, unit,
     measurement_source, parent_item_id, link_type, contribution_value, contribution_percent, origin, locked,
     is_gate, gate_min_percent, gate_effect, gate_applies_to)
SELECT ('7c' || substr(md5('bsc-row:' || child.id::text || ':' || pr.perspective_id::text), 3))::uuid,
       child.id, pr.perspective_id, pr.weight_percentage, pr.display_order,
       CASE WHEN p.code IN ('FINANCIAL', 'LEARNING_GROWTH') THEN round((pr.target_value * share.pct / 100.0)::numeric, 2) ELSE pr.target_value END,
       CASE WHEN p.code IN ('FINANCIAL', 'LEARNING_GROWTH') THEN round((pr.minimum_value * share.pct / 100.0)::numeric, 2) ELSE pr.minimum_value END,
       pr.unit,
       'ROLLUP',
       pr.id,
       CASE WHEN p.code IN ('FINANCIAL', 'LEARNING_GROWTH') THEN 'SUM' ELSE 'SHARED' END,
       CASE WHEN p.code IN ('FINANCIAL', 'LEARNING_GROWTH') THEN round((pr.target_value * share.pct / 100.0)::numeric, 2) END,
       CASE WHEN p.code IN ('FINANCIAL', 'LEARNING_GROWTH') THEN share.pct END,
       'ASSIGNED', TRUE,
       pr.is_gate, pr.gate_min_percent, pr.gate_effect, pr.gate_applies_to
FROM bsc_scorecards child
JOIN bsc_scorecards parent ON parent.id = child.parent_scorecard_id
JOIN bsc_scorecard_perspectives pr ON pr.scorecard_id = parent.id
JOIN bsc_perspectives p ON p.id = pr.perspective_id
JOIN LATERAL (
    SELECT CASE WHEN p.code = 'LEARNING_GROWTH' AND parent.level = 'COMPANY' THEN 40.0 ELSE 50.0 END AS pct
) share ON TRUE
WHERE child.organization_id = '11111111-1111-1111-1111-111111111111' AND child.level = 'UNIT'
ON CONFLICT (scorecard_id, perspective_id) DO NOTHING;

-- Chạy lần hai cho tầng TEAM: lần đầu, dòng của thẻ PHÒNG (cha của team) chưa tồn tại lúc SELECT
-- chạy nên team chưa nhận được dòng nào. Idempotent nhờ ON CONFLICT.
INSERT INTO bsc_scorecard_perspectives
    (id, scorecard_id, perspective_id, weight_percentage, display_order, target_value, minimum_value, unit,
     measurement_source, parent_item_id, link_type, contribution_value, contribution_percent, origin, locked,
     is_gate, gate_min_percent, gate_effect, gate_applies_to)
SELECT ('7c' || substr(md5('bsc-row:' || child.id::text || ':' || pr.perspective_id::text), 3))::uuid,
       child.id, pr.perspective_id, pr.weight_percentage, pr.display_order,
       CASE WHEN p.code IN ('FINANCIAL', 'LEARNING_GROWTH') THEN round((pr.target_value * share.pct / 100.0)::numeric, 2) ELSE pr.target_value END,
       CASE WHEN p.code IN ('FINANCIAL', 'LEARNING_GROWTH') THEN round((pr.minimum_value * share.pct / 100.0)::numeric, 2) ELSE pr.minimum_value END,
       pr.unit,
       'ROLLUP',
       pr.id,
       CASE WHEN p.code IN ('FINANCIAL', 'LEARNING_GROWTH') THEN 'SUM' ELSE 'SHARED' END,
       CASE WHEN p.code IN ('FINANCIAL', 'LEARNING_GROWTH') THEN round((pr.target_value * share.pct / 100.0)::numeric, 2) END,
       CASE WHEN p.code IN ('FINANCIAL', 'LEARNING_GROWTH') THEN share.pct END,
       'ASSIGNED', TRUE,
       pr.is_gate, pr.gate_min_percent, pr.gate_effect, pr.gate_applies_to
FROM bsc_scorecards child
JOIN bsc_scorecards parent ON parent.id = child.parent_scorecard_id
JOIN bsc_scorecard_perspectives pr ON pr.scorecard_id = parent.id
JOIN bsc_perspectives p ON p.id = pr.perspective_id
JOIN LATERAL (
    SELECT CASE WHEN p.code = 'LEARNING_GROWTH' AND parent.level = 'COMPANY' THEN 40.0 ELSE 50.0 END AS pct
) share ON TRUE
WHERE child.organization_id = '11111111-1111-1111-1111-111111111111' AND child.level = 'UNIT'
ON CONFLICT (scorecard_id, perspective_id) DO NOTHING;

-- 18.9.4 Kết quả đợt cho MỌI thẻ (team → phòng → công ty). Mức đạt lấy từ điểm BSC trung bình của
-- đánh giá thành viên trong cây con của đơn vị ở đợt đó (đã seed), cộng một độ lệch cố định theo
-- (đơn vị, hạng mục) để bốn bullet không chồng lên nhau và có đơn vị vượt, có đơn vị hụt.
-- Đợt mới nhất để DRAFT (chưa chốt) — các ô phải nói được "chưa tính" thay vì tự bịa số.
INSERT INTO bsc_unit_results (id, scorecard_id, kpi_period_id, kpi_cycle_id, achievement_percent, gate_passed, gate_failed_items, status, finalized_at, created_at, updated_at)
SELECT ('7d' || substr(md5('bsc-res:' || s.id::text || ':' || p.id::text), 3))::uuid,
       s.id, p.id, p.kpi_cycle_id,
       NULL, NULL, NULL,
       CASE WHEN p.start_date >= '2026-06-01' THEN 'DRAFT' ELSE 'FINALIZED' END,
       CASE WHEN p.start_date >= '2026-06-01' THEN NULL ELSE p.end_date + INTERVAL '3 days' END,
       p.end_date + INTERVAL '3 days', p.end_date + INTERVAL '3 days'
FROM bsc_scorecards s
JOIN bsc_scorecard_periods spd ON spd.scorecard_id = s.id
JOIN kpi_periods p ON p.id = spd.kpi_period_id
WHERE s.organization_id = '11111111-1111-1111-1111-111111111111' AND s.deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

-- Từng dòng kết quả: %đạt = điểm BSC bình quân của cây con (60→72 qua 12 đợt) + lệch (đơn vị, hạng mục)
-- trong [-12, +18]; chặn trong [35, 135]. Thực hiện = mục tiêu × %đạt.
INSERT INTO bsc_unit_result_items
    (id, unit_result_id, scorecard_perspective_id, actual_value, target_value, achievement_percent,
     weight_percentage, weighted_score, kpi_count, gate_passed, measurement_source)
SELECT ('7e' || substr(md5('bsc-ri:' || r.id::text || ':' || sp.id::text), 3))::uuid,
       r.id, sp.id,
       CASE WHEN sp.target_value IS NULL THEN NULL ELSE round((sp.target_value * a.ach / 100.0)::numeric, 2) END,
       sp.target_value,
       a.ach,
       sp.weight_percentage,
       round((a.ach * sp.weight_percentage / 100.0)::numeric, 2),
       COALESCE((SELECT COUNT(*) FROM kpi_criteria k
                 JOIN org_units ku ON ku.id = k.org_unit_id
                 WHERE k.kpi_period_id = r.kpi_period_id AND k.perspective_id = sp.perspective_id
                   AND k.deleted_at IS NULL AND ku.path LIKE scope.path || '%'), 0),
       CASE WHEN sp.is_gate THEN a.ach >= COALESCE(sp.gate_min_percent, 70) END,
       CASE WHEN s.level = 'COMPANY' OR EXISTS (SELECT 1 FROM bsc_scorecards c WHERE c.parent_scorecard_id = s.id)
            THEN 'CHILD_ROLLUP' ELSE 'ROLLUP' END
FROM bsc_unit_results r
JOIN bsc_scorecards s ON s.id = r.scorecard_id
JOIN bsc_scorecard_perspectives sp ON sp.scorecard_id = s.id
JOIN bsc_perspectives p ON p.id = sp.perspective_id
JOIN LATERAL (
    SELECT COALESCE((SELECT ou.path FROM bsc_scorecard_org_units su JOIN org_units ou ON ou.id = su.org_unit_id
                     WHERE su.scorecard_id = s.id LIMIT 1),
                    '/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/') AS path
) scope ON TRUE
JOIN LATERAL (
    SELECT LEAST(135.0, GREATEST(35.0, round((
        COALESCE((SELECT AVG(e.bsc_score) FROM evaluations e JOIN org_units eu ON eu.id = e.org_unit_id
                  WHERE e.kpi_period_id = r.kpi_period_id AND e.deleted_at IS NULL AND e.bsc_score IS NOT NULL
                    AND eu.path LIKE scope.path || '%'), 65.0)
        + 14.0   -- điểm BSC seed quanh 60–72, nâng nền để %đạt quanh 75–90: có đơn vị vượt, có đơn vị hụt cửa
        -- Lệch cố định theo (ĐƠN VỊ, hạng mục) chứ không theo đợt: đường xu hướng đi theo điểm đánh
        -- giá, không nhảy zigzag từng tháng.
        + (abs(('x' || substr(md5('bsc-jit:' || scope.path || ':' || p.code), 1, 8))::bit(32)::int) % 31) - 12
    )::numeric, 1))) AS ach
) a ON TRUE
WHERE s.organization_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (id) DO NOTHING;

-- Tổng của thẻ = bình quân có trọng số các dòng; cửa chặn qua khi mọi dòng chặn đều đạt sàn.
UPDATE bsc_unit_results r
SET achievement_percent = agg.ach,
    gate_passed = agg.gate_ok,
    gate_failed_items = agg.failed
FROM (
    SELECT i.unit_result_id,
           round((SUM(i.achievement_percent * i.weight_percentage) / NULLIF(SUM(i.weight_percentage), 0))::numeric, 1) AS ach,
           BOOL_AND(COALESCE(i.gate_passed, TRUE)) AS gate_ok,
           NULLIF(string_agg(CASE WHEN i.gate_passed = FALSE THEN p.name END, ', '), '') AS failed
    FROM bsc_unit_result_items i
    JOIN bsc_scorecard_perspectives sp ON sp.id = i.scorecard_perspective_id
    JOIN bsc_perspectives p ON p.id = sp.perspective_id
    GROUP BY i.unit_result_id
) agg, bsc_scorecards s
WHERE agg.unit_result_id = r.id
  AND s.id = r.scorecard_id
  AND s.organization_id = '11111111-1111-1111-1111-111111111111'
  AND r.achievement_percent IS NULL;

-- 18.9.5 Bật BSC cho Demo Company: có cây thẻ điểm mà tab "Hạng mục BSC" tắt thì không ai thấy.
UPDATE organizations SET enable_bsc = TRUE WHERE id = '11111111-1111-1111-1111-111111111111';

-- 18.9.6 Khung bell curve cho Demo Company (xếp loại đơn vị theo ma trận: Loại 5 → Loại 1), để ô
-- "Xếp loại đơn vị" ở Thống kê và thẻ "Bell curve của kỳ" có khung hạn mức đối chiếu.
UPDATE organizations
SET unit_classification_rules = '{"profiles":[{"name":"Mặc định","isDefault":true,"orgUnitIds":[],"kpiCycleIds":[],"rules":[],"bellCurve":{"enabled":true,"mode":"warn","minMembers":5,"tolerance":5,"targets":[{"level":"Loại 5","percent":10},{"level":"Loại 4","percent":20},{"level":"Loại 3","percent":40},{"level":"Loại 2","percent":20},{"level":"Loại 1","percent":10}]}}]}'::jsonb
WHERE id = '11111111-1111-1111-1111-111111111111'
  AND (unit_classification_rules IS NULL OR unit_classification_rules::text NOT LIKE '%bellCurve%');
