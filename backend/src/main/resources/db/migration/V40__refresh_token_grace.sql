-- Ân hạn cho refresh token vừa bị xoay (RefreshTokenService.GRACE).
--
-- Mỗi trình duyệt có MỘT dòng refresh token (user + User-Agent) và mỗi lần làm mới phiên là token bị thay ngay.
-- Các tab dùng chung cookie nên phiên hết hạn CÙNG lúc ở mọi tab; hai tab cùng gửi làm mới thì tab chậm cầm token
-- vừa bị thay → bị từ chối → văng ra đăng nhập. Giữ token trước đó thêm vài chục giây: request mang nó trong ân
-- hạn được trả lại phiên hiện tại, không xoay thêm.
--
-- refresh_tokens là bảng lớn: thêm cột NULL không khoá lâu, index tạo CONCURRENTLY (file .conf bên cạnh tắt
-- transaction). Mọi câu chạy lại được.
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS previous_token       VARCHAR(255);
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS previous_valid_until TIMESTAMPTZ;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_tokens_previous_token
    ON refresh_tokens (previous_token) WHERE previous_token IS NOT NULL;
