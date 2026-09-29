-- Bộ tiêu chí bóc từ văn bản quy chế TỰ DO (không phải bảng chấm điểm sẵn):
--  * mỗi dòng có LOẠI — tiêu chí chấm / thang mức / quy định tham khảo — và MỤC gốc (Điều, Phụ lục…);
--  * bộ ghi lại các mục không bóc được gì (để người duyệt biết không mục nào bị bỏ lặng lẽ);
--  * bộ đã xác nhận được nạp toàn văn vào kho tri thức — giữ id để gỡ khi có phiên bản mới / xoá bộ.

ALTER TABLE ai_criteria_set_items
    ADD COLUMN IF NOT EXISTS kind    VARCHAR(20) NOT NULL DEFAULT 'TIEU_CHI',
    ADD COLUMN IF NOT EXISTS section VARCHAR(255);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_criteria_set_items_kind_check') THEN
        ALTER TABLE ai_criteria_set_items
            ADD CONSTRAINT ai_criteria_set_items_kind_check CHECK (kind IN ('TIEU_CHI', 'THANG_MUC', 'THAM_KHAO'));
    END IF;
END $$;

ALTER TABLE ai_criteria_sets
    ADD COLUMN IF NOT EXISTS skipped_sections TEXT,
    ADD COLUMN IF NOT EXISTS rag_document_id  UUID REFERENCES rag_documents(id) ON DELETE SET NULL;
