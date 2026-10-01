-- V22 — Thư viện tài liệu 3 phạm vi (cá nhân / đơn vị / công ty) làm tri thức cho K.AI.
-- Thiết kế: docs/DOCUMENTS_DESIGN.md.
--
-- SỐ MIGRATION: lúc viết, 22 là số trống trên mọi nhánh. Nhiều nhánh đang chạy song song — trước khi merge
-- phải xem lại file trên develop và flyway_schema_history của DB dev; số đã bị chiếm thì đổi tên file này
-- (chưa lên prod nên đổi được).
--
-- Kho vector (bảng của langchain4j) KHÔNG sửa ở đây: nó nằm ngoài Flyway và có thể ở DB khác. Gắn scope
-- cho vector cũ, index biểu thức và chốt chặn index ANN do VectorStoreSchemaInitializer làm lúc khởi động.

-- ── Tài liệu ──────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id),

    scope             VARCHAR(20) NOT NULL,              -- PERSONAL | UNIT | COMPANY
    owner_user_id     UUID REFERENCES users(id),         -- chỉ khi PERSONAL
    org_unit_id       UUID REFERENCES org_units(id),     -- chỉ khi UNIT

    title             VARCHAR(255) NOT NULL,
    description       TEXT,
    category          VARCHAR(30) NOT NULL DEFAULT 'OTHER',

    file_name         VARCHAR(255) NOT NULL,
    content_type      VARCHAR(120) NOT NULL,
    file_size         BIGINT NOT NULL,
    content_sha256    VARCHAR(64) NOT NULL,
    -- Kho riêng tư: KHÔNG lưu URL công khai. Tải về luôn đi qua backend kiểm quyền.
    storage_provider  VARCHAR(20) NOT NULL,
    storage_key       TEXT NOT NULL,
    version           INT NOT NULL DEFAULT 1,

    ai_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
    ai_status         VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- NONE | PENDING | INDEXING | READY | FAILED | UNSUPPORTED
    ai_chunk_count    INT NOT NULL DEFAULT 0,
    ai_error_i18n     TEXT,                              -- LocalizedText JSON, dịch lúc đọc
    ai_indexed_at     TIMESTAMPTZ,
    -- Tài liệu này thay cho một tài liệu cũ trong rag_documents (tải tệp gốc lên, §4.4): nạp xong thì xoá bản cũ.
    legacy_rag_document_id UUID,

    created_by        UUID NOT NULL REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ,

    CONSTRAINT documents_scope_ck CHECK (
        (scope = 'PERSONAL' AND owner_user_id IS NOT NULL AND org_unit_id IS NULL) OR
        (scope = 'UNIT'     AND org_unit_id   IS NOT NULL AND owner_user_id IS NULL) OR
        (scope = 'COMPANY'  AND owner_user_id IS NULL     AND org_unit_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_documents_org_scope ON documents (organization_id, scope) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_unit      ON documents (org_unit_id)            WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_owner     ON documents (owner_user_id)          WHERE deleted_at IS NULL;
-- Job khôi phục nhặt tài liệu kẹt ở hai trạng thái này.
CREATE INDEX IF NOT EXISTS idx_documents_ai_pending ON documents (ai_status, updated_at)
    WHERE ai_status IN ('PENDING', 'INDEXING') AND deleted_at IS NULL;
-- Job dọn tệp của tài liệu đã xoá mềm quá hạn.
CREATE INDEX IF NOT EXISTS idx_documents_deleted   ON documents (deleted_at) WHERE deleted_at IS NOT NULL;

-- ── Mốc vô hiệu hoá người dùng ────────────────────────────────────────────────────────────────────
-- Tài liệu cá nhân của người bị vô hiệu hoá tự xoá mềm sau N ngày (mặc định 90). users chưa có cột
-- nào ghi lúc chuyển sang tạm dừng/tạm khoá, nên thêm cột; UserService ghi khi vô hiệu hoá, xoá khi mở lại.
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

-- Người đã bị vô hiệu hoá từ trước: không biết mốc thật, lấy lần sửa cuối (hoặc lúc xoá mềm).
UPDATE users
   SET deactivated_at = COALESCE(deleted_at, updated_at, now())
 WHERE deactivated_at IS NULL
   AND (status IN ('INACTIVE', 'SUSPENDED') OR deleted_at IS NOT NULL);

-- ── Quyền ─────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO permissions (id, code, resource, action, description) VALUES
  ('00000000-0000-0000-0000-000000000801', 'DOCUMENT:UPLOAD_PERSONAL', 'DOCUMENT', 'UPLOAD_PERSONAL',
   'Có kho tài liệu cá nhân: tải lên, sửa, xoá tài liệu chỉ mình xem được; K.AI dùng chúng khi trả lời riêng cho mình'),
  ('00000000-0000-0000-0000-000000000802', 'DOCUMENT:MANAGE_UNIT', 'DOCUMENT', 'MANAGE_UNIT',
   'Quản lý tài liệu của đơn vị mình và các đơn vị con: tải lên, sửa, xoá; xem được tài liệu của đơn vị con'),
  ('00000000-0000-0000-0000-000000000803', 'DOCUMENT:MANAGE_COMPANY', 'DOCUMENT', 'MANAGE_COMPANY',
   'Quản lý tài liệu chung của công ty (quy chế, quy trình, chiến lược) làm tri thức cho K.AI')
ON CONFLICT DO NOTHING;

-- UPLOAD_PERSONAL: mọi vai trò đang có.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, np.id
  FROM roles r
  JOIN permissions np ON np.code = 'DOCUMENT:UPLOAD_PERSONAL'
 WHERE r.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- MANAGE_UNIT: vai trò trưởng (rank 0) và vai trò quản trị.
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT r.id, np.id
  FROM roles r
  JOIN permissions np ON np.code = 'DOCUMENT:MANAGE_UNIT'
 WHERE r.deleted_at IS NULL
   AND (r.rank = 0
        OR EXISTS (SELECT 1 FROM role_permissions rp JOIN permissions op ON op.id = rp.permission_id
                    WHERE rp.role_id = r.id AND op.code = 'SYSTEM:ADMIN'))
ON CONFLICT DO NOTHING;

-- MANAGE_COMPANY: vai trò quản trị + vai trò trưởng đang được gán ở đơn vị GỐC (lãnh đạo công ty).
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, np.id
  FROM role_permissions rp
  JOIN permissions op ON op.id = rp.permission_id
  JOIN permissions np ON np.code = 'DOCUMENT:MANAGE_COMPANY'
 WHERE op.code = 'SYSTEM:ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT uro.role_id, np.id
  FROM user_role_org_units uro
  JOIN roles r        ON r.id = uro.role_id
  JOIN org_units ou   ON ou.id = uro.org_unit_id
  JOIN permissions np ON np.code = 'DOCUMENT:MANAGE_COMPANY'
 WHERE ou.parent_id IS NULL
   AND ou.deleted_at IS NULL
   AND r.rank = 0
ON CONFLICT DO NOTHING;
