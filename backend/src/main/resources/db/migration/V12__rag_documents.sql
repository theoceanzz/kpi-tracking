-- V12 — Tài liệu đã nạp vào kho tri thức của trợ lý AI (RAG).
--
-- Từng là V3 trên nhánh nghianv. Đổi số vì history prod còn version 3..7 của các file cũ đã gộp vào
-- V1/V2 (ignore-migration-patterns "*:missing"): một file V3 mới sẽ bị Flyway coi là đã chạy và
-- bỏ qua, prod lên với JPA ddl-auto=validate sẽ không khởi động vì thiếu bảng. IF NOT EXISTS để DB
-- dev đã áp bản V3 cũ (sau khi flyway:repair đánh dấu V3 là deleted) chạy lại không lỗi.
--
-- Bảng này chỉ giữ BẢN GHI QUẢN TRỊ: tài liệu nào, của tổ chức nào, nạp lúc nào, bao nhiêu đoạn.
-- Nội dung đã cắt đoạn + vector nằm ở kho pgvector do langchain4j tự quản (bảng
-- app.ai.rag.embedding.table), ở dev là một DB khác vì PG13 cục bộ không có extension vector.
-- Hai bên nối nhau bằng metadata.docId = rag_documents.id; xoá tài liệu thì xoá vector theo khoá đó.
CREATE TABLE IF NOT EXISTS rag_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- NULL = tài liệu chung toàn hệ thống (bộ hướng dẫn KeyGo). Có giá trị = quy chế riêng của
    -- một tổ chức, CHỈ tổ chức đó được truy hồi.
    organization_id UUID REFERENCES organizations(id),
    source          VARCHAR(30) NOT NULL,          -- GUIDE | REGULATION | JOB_DESCRIPTION | STRATEGY
    title           VARCHAR(255) NOT NULL,
    file_name       VARCHAR(255),
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING | READY | FAILED
    chunk_count     INT NOT NULL DEFAULT 0,
    image_count     INT NOT NULL DEFAULT 0,
    error_message   TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rag_documents_org ON rag_documents(organization_id);

-- Ảnh bóc từ tài liệu, đã tải lên Cloudinary. Khoá theo băm nội dung để nạp lại cùng tài liệu
-- không tải lại 45 ảnh — mỗi lần nạp lại là một lần tốn băng thông và tạo bản sao trên Cloudinary.
CREATE TABLE IF NOT EXISTS rag_assets (
    content_sha256  CHAR(64) PRIMARY KEY,
    url             TEXT NOT NULL,
    public_id       TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
