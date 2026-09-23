-- rag_assets.content_sha256: CHAR(64) → VARCHAR(64).
--
-- V12 khai báo CHAR(64) trong khi entity RagAsset để @Column(length = 64) tức VARCHAR(64), nên
-- Hibernate ddl-auto=validate từ chối khởi động: "found [bpchar], but expecting [varchar(64)]".
-- Chọn sửa DB thay vì sửa entity: băm sha256 luôn đúng 64 ký tự nên CHAR không mang lại gì, mà
-- kiểu bpchar còn kéo theo luật đệm khoảng trắng khi so sánh — thứ không ai muốn ở một khoá chính.
--
-- char(n) → varchar(n) là đổi kiểu tương thích nhị phân: Postgres chỉ sửa metadata, không viết lại
-- bảng, nên chạy được cả khi bảng đã có dữ liệu.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_name = 'rag_assets'
           AND column_name = 'content_sha256'
           AND data_type = 'character'
    ) THEN
        ALTER TABLE rag_assets ALTER COLUMN content_sha256 TYPE VARCHAR(64);
    END IF;
END $$;
