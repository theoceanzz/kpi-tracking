-- V35 — BSC: bỏ khoá bộ tiêu chí và phân rã CẢ BỘ tiêu chí.
-- Gộp từ V35 + V36 + V38 cũ (cùng chức năng, chưa lên prod). Mọi câu đều chạy lại được.

-- ═══ 1. Bỏ khoá / mở khoá bộ tiêu chí ═══════════════════════════════════════════════════════════
-- Bỏ khoá / mở khoá bộ tiêu chí BSC. Khoá không đổi gì ở việc chấm điểm, chỉ chặn phân rã tiếp
-- dưới thẻ, nên đã gỡ khỏi giao diện lẫn API và enum BscScorecardStatus không còn LOCKED.
-- Thẻ đang khoá phải về lại ACTIVE trước, nếu không Hibernate đọc bản ghi sẽ lỗi enum.
UPDATE bsc_scorecards SET status = 'ACTIVE' WHERE status = 'LOCKED';

ALTER TABLE bsc_scorecards DROP COLUMN IF EXISTS locked_at;

-- Mã thông báo "bsc_scorecard_locked" không còn phát nữa; cấu hình bật/tắt của nó thành rác.
DELETE FROM org_notification_configs WHERE event_code = 'bsc_scorecard_locked';

-- ═══ 2. Phân rã cả bộ tiêu chí ══════════════════════════════════════════════════════════════════
-- Phân rã CẢ BỘ tiêu chí (chế độ thứ hai, cạnh phân rã từng chỉ tiêu).
--
-- Đơn vị con nhận MỘT dòng duy nhất, chỉ có trọng số, điểm = kết quả tổng của thẻ cha trong cùng
-- đợt. Dòng đó vẫn là một dòng bsc_scorecard_perspectives bình thường (ASSIGNED + locked), chỉ
-- trỏ tới một HẠNG MỤC HỆ THỐNG riêng cho từng thẻ nguồn — hạng mục này mang source_scorecard_id
-- và bị giấu khỏi danh mục để không KPI nào gắn nhầm vào.
--
-- RESTRICT chứ không CASCADE: xoá thẻ nguồn mà các thẻ con vẫn đang lấy điểm từ nó thì điểm của
-- họ biến mất không ai hay. Xoá mềm ở tầng service cũng chặn cùng điều kiện.
ALTER TABLE bsc_perspectives
    ADD COLUMN IF NOT EXISTS source_scorecard_id UUID
        REFERENCES bsc_scorecards(id) ON DELETE RESTRICT;

-- Mỗi thẻ nguồn đúng một hạng mục hệ thống.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bsc_perspectives_source_scorecard
    ON bsc_perspectives (source_scorecard_id)
    WHERE source_scorecard_id IS NOT NULL;

-- Chốt kết quả đơn vị / đánh giá cá nhân khi thẻ nguồn CHƯA chốt là ngoại lệ do quản trị cho
-- phép — đánh dấu lại để biết điểm "Kết quả cấp trên" trong đó là số tạm tính lúc chốt.
ALTER TABLE bsc_unit_results
    ADD COLUMN IF NOT EXISTS provisional_source BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE evaluations
    ADD COLUMN IF NOT EXISTS bsc_provisional BOOLEAN NOT NULL DEFAULT FALSE;

-- ═══ 3. Dòng "Kết quả cấp trên" không cần chỉ tiêu cha ═══════════════════════════════════════════
-- Dòng "Kết quả cấp trên" (phân rã cả bộ, phần 2 ở trên) là dòng ASSIGNED nhưng KHÔNG nhận từ một chỉ tiêu
-- cha nào: nó nhận kết quả tổng của cả thẻ nguồn, truy về nguồn qua hạng mục hệ thống
-- (bsc_perspectives.source_scorecard_id). Ràng buộc cũ "ASSIGNED ⇒ có parent_item_id" vì vậy chặn
-- mọi lần giao cả bộ ("Dữ liệu đã tồn tại hoặc vi phạm ràng buộc hệ thống").
--
-- CHECK không nhìn sang bảng khác được nên không viết lại được thành "có parent_item_id HOẶC hạng
-- mục là hạng mục nguồn"; luật đó giữ ở tầng service: phân rã từng chỉ tiêu luôn đặt parent_item,
-- phân rã cả bộ luôn dùng hạng mục nguồn. IF EXISTS vì schema prod do Hibernate sinh có thể không
-- có ràng buộc này.
ALTER TABLE bsc_scorecard_perspectives DROP CONSTRAINT IF EXISTS chk_bsc_sp_assigned_has_parent;
