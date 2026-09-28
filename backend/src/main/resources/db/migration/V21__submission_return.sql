-- HOÀN DUYỆT BÀI NỘP: người chấm đợt trả một bài nộp về cho nhân viên làm lại.
--
-- Bài cũ KHÔNG bị sửa hay xoá: nó chuyển sang trạng thái RETURNED (giữ làm lịch sử, không tính
-- điểm, không tính vào số lần nộp) và nhân viên tạo một bài nộp MỚI trước hạn nộp lại mà người trả
-- lại đặt — kể cả khi đợt đã hết hạn. Bài mới trỏ về bài cũ qua resubmission_id của bài cũ.
--
-- kpi_submissions.status là VARCHAR(20) không có CHECK constraint nên RETURNED chỉ là giá trị enum
-- mới. Chỉ thêm cột cho phép NULL (không default) nên ALTER là thao tác chỉ đổi catalog, không ghi
-- lại bảng lớn này. Không thêm index: truy vấn "bài đang chờ nộp lại" luôn lọc theo
-- (kpi_criteria_id, submitted_by) vốn đã được index.

ALTER TABLE kpi_submissions ADD COLUMN IF NOT EXISTS returned_by       UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE kpi_submissions ADD COLUMN IF NOT EXISTS returned_at       TIMESTAMPTZ;
ALTER TABLE kpi_submissions ADD COLUMN IF NOT EXISTS return_reason     TEXT;
ALTER TABLE kpi_submissions ADD COLUMN IF NOT EXISTS resubmit_deadline TIMESTAMPTZ;
ALTER TABLE kpi_submissions ADD COLUMN IF NOT EXISTS resubmission_id   UUID REFERENCES kpi_submissions(id) ON DELETE SET NULL;

COMMENT ON COLUMN kpi_submissions.status IS 'DRAFT | PENDING | APPROVED | REJECTED | RETURNED';
COMMENT ON COLUMN kpi_submissions.resubmit_deadline IS
    'Hạn nộp lại do người trả lại đặt. Trước hạn này nhân viên được nộp bài mới cho KPI dù đợt đã hết hạn.';
COMMENT ON COLUMN kpi_submissions.resubmission_id IS
    'Bài nộp mới thay cho bài bị trả lại này. NULL = đang chờ nộp lại (nếu chưa quá hạn).';

-- Thông báo "bài nộp bị trả lại" bật sẵn như các mã thông báo khác: tổ chức chưa có dòng cấu hình
-- thì OrgNotificationConfigService coi là bật, nên không cần chèn gì thêm ở đây.
