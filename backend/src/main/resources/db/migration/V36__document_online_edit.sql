-- V36 — Soạn tài liệu trực tuyến (kiểu Lark Docs / Google Docs) ngay trong thư viện tài liệu.
-- Gộp từ V36 + V37 cũ (cùng chức năng, chưa lên prod). Mọi câu đều chạy lại được.
--
-- ═══ 1. Gộp phiên soạn ═══════════════════════════════════════════════════════════════════════════
--
-- Tài liệu / bảng tính soạn trực tuyến (và tệp .md, .txt) sửa được trực tiếp trên trình duyệt, tự lưu vài giây một lần. Để mỗi lần tự lưu không đẻ ra
-- một phiên bản (và không đẩy các bản cũ thật sự ra khỏi trần 10 phiên bản), các lần lưu liên tiếp của CÙNG một người
-- trong một phiên soạn được gộp vào bản hiện hành. Hai cột dưới đây nhớ ai/lúc nào soạn bản hiện hành; thay tệp hay
-- khôi phục phiên bản đặt lại NULL để lần soạn sau mở phiên bản mới.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_edited_by UUID;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_edited_at TIMESTAMPTZ;

-- ═══ 2. Quyền chia sẻ xem / chỉnh sửa ════════════════════════════════════════════════════════
-- Chia sẻ tài liệu có hai mức quyền như Google Docs: XEM (như trước) hoặc CHỈNH SỬA nội dung trong trình soạn
-- trực tuyến. Người được chia sẻ quyền sửa chỉ sửa nội dung — không xoá, không di chuyển, không chia sẻ tiếp.
-- Mọi lượt chia sẻ đã có giữ nguyên là quyền xem.
ALTER TABLE document_shares ADD COLUMN IF NOT EXISTS permission VARCHAR(10) NOT NULL DEFAULT 'VIEW';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_document_shares_permission') THEN
        ALTER TABLE document_shares
            ADD CONSTRAINT ck_document_shares_permission CHECK (permission IN ('VIEW', 'EDIT'));
    END IF;
END $$;
