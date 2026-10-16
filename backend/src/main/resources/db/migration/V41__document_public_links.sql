-- Gửi tài liệu qua email cho người ngoài hệ thống (DocumentEmailService).
--
-- Mỗi lần gửi sinh MỘT link công khai riêng: người nhận mở /s/d/{token} không cần tài khoản. Chỉ lưu SHA-256 của token
-- (token thật chỉ nằm trong email) — lộ bảng này không mở được tài liệu nào. Link luôn trỏ tới bản HIỆN HÀNH của tài
-- liệu; tài liệu vào thùng rác / hết hạn / bị thu hồi thì link chết. Bảng mới, nhỏ: tạo index thường.
CREATE TABLE IF NOT EXISTS document_public_links (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    organization_id  UUID NOT NULL REFERENCES organizations(id),
    token_hash       VARCHAR(64)  NOT NULL,
    -- Địa chỉ đã gửi (To + Cc), cách nhau bằng dấu phẩy — để người gửi biết link nào đi cho ai mà thu hồi.
    recipients       TEXT         NOT NULL,
    subject          VARCHAR(255) NOT NULL,
    created_by       UUID         NOT NULL,
    -- Tên người gửi lúc gửi: trang công khai vẫn hiện đúng người gửi kể cả khi tài khoản đó sau này bị xoá.
    sender_name      VARCHAR(255) NOT NULL,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at       TIMESTAMPTZ  NOT NULL,
    revoked_at       TIMESTAMPTZ,
    revoked_by       UUID,
    view_count       INTEGER      NOT NULL DEFAULT 0,
    last_viewed_at   TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_document_public_links_token ON document_public_links (token_hash);
CREATE INDEX IF NOT EXISTS idx_document_public_links_document ON document_public_links (document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_public_links_sender ON document_public_links (created_by, created_at DESC);
