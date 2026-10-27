-- Thang điểm AI nhiều mức, tuỳ chỉnh được (người dùng chốt 13/10): thay ô "điểm tối đa" của V47.
-- AI chọn MỘT mức trong thang này; điểm AI = điểm của mức; điểm tối đa = điểm của mức cao nhất. Thang riêng của AI,
-- tách khỏi thang định tính của KPI (qualitative_levels). Một thang cho cả công ty.

CREATE TABLE IF NOT EXISTS ai_review_levels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    position        INT NOT NULL,
    name            VARCHAR(100) NOT NULL,
    points          NUMERIC(6, 2) NOT NULL,
    color           VARCHAR(20),
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_review_levels_org ON ai_review_levels (organization_id, position);

-- Chép thang định tính hiện có sang thang AI: cùng tên / màu / thứ tự, điểm = % × điểm tối đa (V47). Kết quả AI cũ lưu
-- theo TÊN mức nên vẫn ra đúng điểm cũ. Mức chưa có % thì bỏ (trước đây nó cũng không ra điểm).
INSERT INTO ai_review_levels (organization_id, position, name, points, color)
SELECT q.organization_id, q.position_index, q.name,
       ROUND(q.score_percent::numeric / 100 * COALESCE(o.ai_review_max_points, 10), 2), q.color
FROM qualitative_levels q
JOIN organizations o ON o.id = q.organization_id
WHERE q.score_percent IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM ai_review_levels a WHERE a.organization_id = q.organization_id);

-- Tổ chức chưa có thang định tính: 5 mức mặc định trên thang 10.
INSERT INTO ai_review_levels (organization_id, position, name, points, color, description)
SELECT o.id, d.position, d.name, d.points, d.color, d.description
FROM organizations o
CROSS JOIN (VALUES
    (1, 'Kém', 0.00, '#ef4444', 'Không có minh chứng hoặc nội dung không liên quan chỉ tiêu'),
    (2, 'Yếu', 2.50, '#f59e0b', 'Minh chứng sơ sài, thiếu số liệu'),
    (3, 'Trung bình', 5.00, '#6366f1', 'Đủ ý chính nhưng thiếu số liệu hoặc đối chiếu'),
    (4, 'Khá', 7.50, '#3b82f6', 'Có số liệu cụ thể, còn thiếu đối chiếu với kế hoạch'),
    (5, 'Tốt', 10.00, '#10b981', 'Đầy đủ, có số liệu và đối chiếu với kế hoạch')
) AS d(position, name, points, color, description)
WHERE NOT EXISTS (SELECT 1 FROM ai_review_levels a WHERE a.organization_id = o.id);

ALTER TABLE organizations DROP COLUMN IF EXISTS ai_review_max_points;
