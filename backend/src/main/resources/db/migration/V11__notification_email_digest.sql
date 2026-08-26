-- Gom email thông báo theo người nhận.
--
-- Trước đây mỗi sự kiện gửi thẳng một email: nhân viên nộp 12 báo cáo trong một buổi
-- sáng là trưởng đơn vị nhận đúng 12 lá thư nội dung gần như y hệt nhau, và một lượt
-- bulkReview 30 bài nộp sinh ra 30 lá thư nữa cho nhân viên. Người nhận ngừng đọc, rồi
-- ngừng để ý tới cả những thư thật sự quan trọng.
--
-- Từ đây email đi qua hàng đợi này: sự kiện được xếp hàng, một scheduler chờ cho luồng
-- sự kiện của người đó lắng xuống rồi mới gộp tất cả thành MỘT thư. Thông báo trong hệ
-- thống (chuông + WebSocket) vẫn tức thời như cũ — chỉ có kênh email bị gom lại.
CREATE TABLE notification_email_digest_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Tổ chức cần cho việc render template: mỗi tổ chức có thể tự sửa nội dung email.
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Người NHẬN thư. ON DELETE CASCADE vì thư chưa gửi của một tài khoản đã bị xoá
    -- cứng thì không còn ai để gửi tới.
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Địa chỉ và tên được chốt lại NGAY LÚC XẾP HÀNG chứ không đọc từ users lúc gửi:
    -- người nhận có thể đổi email giữa lúc sự kiện xảy ra và lúc thư đi.
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),

    -- Mã sự kiện (submission_submitted, kpi_approved…). Dùng để nhóm các mục cùng loại
    -- trong thư gộp, và để chọn template khi người nhận chỉ có đúng MỘT mục chờ gửi.
    event_code VARCHAR(100) NOT NULL,

    title TEXT NOT NULL,
    message TEXT NOT NULL,
    reference_id UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- NULL = còn chờ gửi. Ghi thời điểm gửi thay vì xoá bản ghi để còn lần được vì sao
    -- một người nhận thư vào lúc đó với đúng những nội dung đó.
    sent_at TIMESTAMPTZ
);

-- Scheduler quét đúng phần chưa gửi. Partial index để bảng có phình theo lịch sử thì
-- chi phí mỗi lượt quét vẫn chỉ theo số mục đang chờ.
CREATE INDEX idx_notif_digest_pending
    ON notification_email_digest_items(user_id, created_at)
    WHERE sent_at IS NULL;

-- Dọn lịch sử theo thời gian.
CREATE INDEX idx_notif_digest_sent_at
    ON notification_email_digest_items(sent_at)
    WHERE sent_at IS NOT NULL;
