-- V34 — Thư viện tài liệu, phần mở rộng (docs/DOCUMENTS_DESIGN.md §15, §16):
--   §15 kiểu Lark Docs: thư mục, chia sẻ, phiên bản, thùng rác (người xoá), trạng thái riêng của từng người
--       (yêu thích, ghim, mở gần đây);
--   §16 ngày rà soát / hết hiệu lực, đề xuất đưa tài liệu lên đơn vị / công ty có bước duyệt.
-- Gộp từ V34 + V37 cũ (cùng chức năng, chưa lên prod). Mọi câu đều chạy lại được (IF NOT EXISTS).
--
-- SỐ MIGRATION: lấy số trống lúc viết (V33 là số cuối). Chưa lên prod thì đổi số được nếu nhánh khác chiếm trước.

-- ── Thư mục ───────────────────────────────────────────────────────────────────────────────────────
-- Cùng luật phạm vi với tài liệu: thư mục CÁ NHÂN của một người, thư mục của một ĐƠN VỊ, thư mục CÔNG TY.
-- Tài liệu trong thư mục phải cùng phạm vi (cùng chủ / cùng đơn vị) với thư mục — service kiểm.
CREATE TABLE IF NOT EXISTS document_folders (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL REFERENCES organizations(id),
    scope            VARCHAR(20) NOT NULL,
    owner_user_id    UUID REFERENCES users(id),
    org_unit_id      UUID REFERENCES org_units(id),
    parent_id        UUID REFERENCES document_folders(id),
    name             VARCHAR(255) NOT NULL,
    created_by       UUID NOT NULL REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ,
    CONSTRAINT document_folders_scope_ck CHECK (
        (scope = 'PERSONAL' AND owner_user_id IS NOT NULL AND org_unit_id IS NULL) OR
        (scope = 'UNIT'     AND org_unit_id   IS NOT NULL AND owner_user_id IS NULL) OR
        (scope = 'COMPANY'  AND owner_user_id IS NULL     AND org_unit_id IS NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_document_folders_parent ON document_folders (parent_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_document_folders_scope  ON document_folders (organization_id, scope) WHERE deleted_at IS NULL;

ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id  UUID REFERENCES document_folders(id);
-- Ai đưa tài liệu vào thùng rác — để thùng rác hiện "Xoá bởi" và để khôi phục đúng người có quyền.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents (folder_id) WHERE deleted_at IS NULL;

-- ── Phiên bản ─────────────────────────────────────────────────────────────────────────────────────
-- Tệp CŨ mỗi lần "Thay tệp". Bản hiện hành vẫn nằm ở documents; bảng này chỉ giữ các bản trước (tối đa N bản,
-- service tự dọn bản cũ nhất).
CREATE TABLE IF NOT EXISTS document_versions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id       UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version           INT NOT NULL,
    file_name         VARCHAR(255) NOT NULL,
    content_type      VARCHAR(120) NOT NULL,
    file_size         BIGINT NOT NULL,
    content_sha256    VARCHAR(64) NOT NULL,
    storage_provider  VARCHAR(20) NOT NULL,
    storage_key       TEXT NOT NULL,
    created_by        UUID NOT NULL REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT document_versions_doc_version_uq UNIQUE (document_id, version)
);

-- ── Chia sẻ ───────────────────────────────────────────────────────────────────────────────────────
-- Quyền XEM (đọc, tải về; K.AI đọc khi trả lời người được chia sẻ) cho đúng một người HOẶC một đơn vị
-- (thành viên đơn vị đó và các đơn vị con).
CREATE TABLE IF NOT EXISTS document_shares (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id       UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    grantee_user_id   UUID REFERENCES users(id),
    grantee_unit_id   UUID REFERENCES org_units(id),
    granted_by        UUID NOT NULL REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT document_shares_one_grantee_ck CHECK (
        (grantee_user_id IS NOT NULL AND grantee_unit_id IS NULL) OR
        (grantee_user_id IS NULL AND grantee_unit_id IS NOT NULL)
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_document_shares_user ON document_shares (document_id, grantee_user_id) WHERE grantee_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_document_shares_unit ON document_shares (document_id, grantee_unit_id) WHERE grantee_unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_shares_user ON document_shares (grantee_user_id) WHERE grantee_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_shares_unit ON document_shares (grantee_unit_id) WHERE grantee_unit_id IS NOT NULL;

-- ── Trạng thái riêng của từng người với từng tài liệu ─────────────────────────────────────────────
-- Yêu thích, ghim lên thanh bên, lần mở gần nhất (tab "Gần đây"). Không phải quyền: mất quyền xem thì dòng này
-- vô nghĩa và bị lọc đi khi đọc (mọi danh sách đều đi qua bộ lọc quyền trước).
CREATE TABLE IF NOT EXISTS document_user_states (
    user_id          UUID NOT NULL REFERENCES users(id),
    document_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    favorite         BOOLEAN NOT NULL DEFAULT FALSE,
    pinned           BOOLEAN NOT NULL DEFAULT FALSE,
    last_opened_at   TIMESTAMPTZ,
    PRIMARY KEY (user_id, document_id)
);
CREATE INDEX IF NOT EXISTS idx_document_user_states_recent ON document_user_states (user_id, last_opened_at DESC);

-- ═══ §16: ngày rà soát / hết hiệu lực, đề xuất đưa lên ═══════════════════════════════════════════
-- ── Ngày rà soát / hết hiệu lực ──────────────────────────────────────────────────────────────────
-- review_date: ngày người quản lý cần đọc lại tài liệu (quy chế thay đổi theo năm…).
-- expiry_date: từ ngày này tài liệu hết hiệu lực — K.AI vẫn đọc nhưng ghi chú "đã hết hiệu lực" khi trích.
-- *_notified_for: đã nhắc cho đúng ngày nào — đổi ngày thì nhắc lại, không đổi thì chỉ nhắc một lần.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS review_date DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS review_notified_for DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expiry_notified_for DATE;
CREATE INDEX IF NOT EXISTS idx_documents_review_date ON documents (review_date) WHERE deleted_at IS NULL AND review_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_expiry_date ON documents (expiry_date) WHERE deleted_at IS NULL AND expiry_date IS NOT NULL;

-- ── Đề xuất đưa tài liệu lên phạm vi rộng hơn ─────────────────────────────────────────────────────
-- Người không có quyền tạo tài liệu ở đơn vị / công ty đề xuất; người quản lý phạm vi đích duyệt. Duyệt = SAO CHÉP
-- thành tài liệu mới ở phạm vi đích (result_document_id); tài liệu gốc giữ nguyên.
CREATE TABLE IF NOT EXISTS document_promotion_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    document_id         UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    target_scope        VARCHAR(20) NOT NULL,
    target_unit_id      UUID REFERENCES org_units(id),
    note                TEXT,
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    requested_by        UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_by          UUID REFERENCES users(id),
    decided_at          TIMESTAMPTZ,
    decision_note       TEXT,
    result_document_id  UUID REFERENCES documents(id) ON DELETE SET NULL,
    CONSTRAINT document_promotion_target_ck CHECK (
        (target_scope = 'UNIT' AND target_unit_id IS NOT NULL) OR
        (target_scope = 'COMPANY' AND target_unit_id IS NULL)
    ),
    CONSTRAINT document_promotion_status_ck CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'))
);
-- Một đề xuất đang chờ cho mỗi (tài liệu, đích).
CREATE UNIQUE INDEX IF NOT EXISTS uq_document_promotion_pending
    ON document_promotion_requests (document_id, target_scope, COALESCE(target_unit_id, '00000000-0000-0000-0000-000000000000'::uuid))
    WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_document_promotion_org_status ON document_promotion_requests (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_document_promotion_requester ON document_promotion_requests (requested_by, created_at DESC);
