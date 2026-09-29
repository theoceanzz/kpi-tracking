-- Thang chấm hạnh kiểm đổi từ 0–4 sang 1–5 cho khớp MA TRẬN XẾP LOẠI.
--
-- Điểm hạnh kiểm là thứ lấp trục hành vi của ma trận khi tổ chức không chấm KPI định tính
-- (xem ConductAxisResolver). Trục hành vi của ma trận mặc định chạy tới "≥4.5 và ≤5", nên
-- để thang 4 thì người chấm kịch khung mọi tiêu chí vẫn chỉ rơi vào dải áp chót — không
-- bao giờ chạm được mức 5. Mức thấp nhất cũng lên 1 vì ma trận đánh số 1..5 và "chưa chấm"
-- đã được biểu đạt bằng ô trống.
--
-- Chỉ đổi những chỗ còn ĐANG Ở GIÁ TRỊ MẶC ĐỊNH CŨ (4). Tổ chức đã tự chọn thang riêng
-- (3, 10, 100…) giữ nguyên — đó là lựa chọn của họ, không phải giá trị bỏ quên.

ALTER TABLE organizations        ALTER COLUMN conduct_max_score SET DEFAULT 5;
ALTER TABLE conduct_criteria_sets ALTER COLUMN max_score        SET DEFAULT 5;
ALTER TABLE conduct_evaluations   ALTER COLUMN max_score        SET DEFAULT 5;

UPDATE organizations         SET conduct_max_score = 5 WHERE conduct_max_score = 4;
UPDATE conduct_criteria_sets SET max_score = 5         WHERE max_score = 4 AND deleted_at IS NULL;

-- Phiếu đã chấm KHÔNG đụng vào: max_score là bản chụp lúc chấm, sửa nó sẽ làm điểm đã
-- công bố mang một thang khác với lúc người ta chấm. Chỉ nâng thang cho phiếu còn trắng.
UPDATE conduct_evaluations
   SET max_score = 5
 WHERE max_score = 4
   AND deleted_at IS NULL
   AND self_score IS NULL
   AND manager_score IS NULL;
