-- Phân rã từng chỉ tiêu trước đây không chia tối thiểu: dòng con để trống tối thiểu nên rơi về tối thiểu
-- của hạng mục (con số của CẢ chỉ tiêu cha). Chia 1.000 thành 300 + 700 với tối thiểu 400 thì đơn vị
-- nhận 300 có tối thiểu > mục tiêu (form bộ tiêu chí không cho lưu), đơn vị nhận 700 thì tối thiểu 400
-- thay vì 280. Điền tối thiểu theo đúng luật mới (BscCascadeService.scaledMinimum):
-- tối thiểu con = tối thiểu cha / mục tiêu cha × mục tiêu con, không vượt mục tiêu con.
-- Bỏ qua: dòng giao cả bộ (luôn chép đủ mục tiêu + tối thiểu của thẻ nguồn), dòng đã có tối thiểu riêng,
-- và thẻ đã chốt kết quả đơn vị (không đổi lại con số của kết quả đã chốt).
UPDATE bsc_scorecard_perspectives c
SET minimum_value = LEAST(
        c.target_value,
        ROUND((COALESCE(p.minimum_value, pp.minimum_value)
               / COALESCE(p.target_value, pp.target_value)
               * c.target_value)::numeric, 2)::double precision),
    updated_at = now()
FROM bsc_scorecard_perspectives p, bsc_perspectives pp
WHERE c.parent_item_id = p.id
  AND pp.id = p.perspective_id
  AND c.whole_share_percent IS NULL
  AND c.minimum_value IS NULL
  AND c.target_value IS NOT NULL
  AND c.target_value > 0
  AND COALESCE(p.minimum_value, pp.minimum_value) IS NOT NULL
  AND COALESCE(p.target_value, pp.target_value) > 0
  AND NOT EXISTS (
      SELECT 1 FROM bsc_unit_results r
      WHERE r.scorecard_id = c.scorecard_id AND r.finalized_at IS NOT NULL
  );
