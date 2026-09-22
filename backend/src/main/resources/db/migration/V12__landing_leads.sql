-- V12: Lưu đăng ký tư vấn / dùng thử gửi từ form cuối trang giới thiệu (landing).
--
-- Bảng độc lập, không gắn organization: người gửi CHƯA là khách hàng nên chưa có org.
-- Không xoá mềm — đây là dữ liệu bán hàng, sale xử lý bằng cột status; bản ghi không bao
-- giờ bị xoá khỏi UI. Bảng nhỏ (vài dòng/ngày) nên chỉ cần index theo created_at để liệt kê
-- mới nhất và theo phone để nhận ra người gửi lại.
CREATE TABLE IF NOT EXISTS landing_leads (
    id          UUID PRIMARY KEY,
    full_name   VARCHAR(120) NOT NULL,
    phone       VARCHAR(20)  NOT NULL,
    email       VARCHAR(160),
    company     VARCHAR(200),
    headcount   VARCHAR(20),               -- khoảng quy mô: '<50' | '50-200' | '200-500' | '>500'
    note        VARCHAR(1000),
    source      VARCHAR(60),               -- 'landing' hoặc utm tuỳ chỗ đặt form
    client_ip   VARCHAR(64),
    status      VARCHAR(20)  NOT NULL DEFAULT 'NEW',   -- NEW | CONTACTED | CONVERTED | SPAM
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_landing_leads_created_at ON landing_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_landing_leads_phone ON landing_leads (phone);
