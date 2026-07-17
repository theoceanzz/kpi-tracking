-- ====================================================
-- V6: BSC - Đưa KPI ĐỊNH TÍNH vào điểm BSC
-- Thêm score_percent trên qualitative_levels: HR tự định nghĩa mỗi mức tương ứng bao nhiêu %.
--
-- Vì sao cần: bsc_score là trung bình CÓ TRỌNG SỐ của mọi KPI trong một viễn cảnh, nên KPI định tính
-- phải quy về cùng thang "tỉ lệ đạt" với KPI định lượng mới cộng chung được.
-- level_value (0/2/3/3.5/4.5) vốn dùng cho TRỤC HÀNG của ma trận hiệu suất — KHÔNG dùng để ra %.
--
-- LƯU Ý: system_score và ma trận hiệu suất KHÔNG đổi. Cột này chỉ phục vụ bsc_score.
-- ====================================================

ALTER TABLE qualitative_levels
    ADD COLUMN IF NOT EXISTS score_percent DOUBLE PRECISION;

-- Backfill: quy tỉ lệ theo mức cao nhất của từng tổ chức để dữ liệu cũ có giá trị khởi điểm hợp lý.
-- HR có thể chỉnh lại trong màn hình cấu hình Thang điểm định tính.
UPDATE qualitative_levels q
SET score_percent = ROUND((q.level_value / NULLIF(m.max_value, 0) * 100)::numeric, 2)
FROM (
    SELECT organization_id, MAX(level_value) AS max_value
    FROM qualitative_levels
    GROUP BY organization_id
) m
WHERE q.organization_id = m.organization_id
  AND q.score_percent IS NULL;

COMMENT ON COLUMN qualitative_levels.score_percent IS
    'Mức định tính này tương đương bao nhiêu % hoàn thành khi tính điểm BSC (0..100). HR cấu hình.';
