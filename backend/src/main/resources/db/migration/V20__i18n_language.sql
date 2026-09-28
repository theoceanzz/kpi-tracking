-- ĐA NGÔN NGỮ (i18n): ngôn ngữ theo tài khoản / tổ chức, và cột *_i18n cho chữ hệ thống sinh ra.
--
-- ── P0: lưu ngôn ngữ theo tài khoản và ngôn ngữ mặc định của tổ chức ──
-- Thiết kế: docs/I18N_DESIGN.md §7, §9. Danh sách mã hợp lệ nằm ở SupportedLanguages (vi, en).
--
-- preferred_language NULL = người dùng chưa tự chọn → theo default_language của tổ chức.
-- Chỉ thêm cột (không index, không backfill) nên chạy tức thì kể cả trên bảng lớn.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10);

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS default_language VARCHAR(10) NOT NULL DEFAULT 'vi';

-- ── Chữ do hệ thống sinh ra và lưu lại ──
-- Đa ngôn ngữ cho chữ do hệ thống sinh ra và lưu lại (docs/I18N_DESIGN.md §8).
-- Mỗi cột *_i18n giữ JSON {"key": "...", "args": [...]} — dịch lúc ĐỌC theo ngôn ngữ người xem, nên đổi
-- ngôn ngữ thì thông báo/lịch sử cũ cũng đổi theo. Cột chữ cũ (title, message, skip_reason, reason) vẫn
-- được ghi bản tiếng Việt cho dòng cũ, cho truy vấn tay và cho code chưa đọc cột mới.
-- Lý do người dùng tự nhập vẫn chỉ nằm ở cột reason, giữ nguyên văn.
-- Chỉ thêm cột nullable, không default: PostgreSQL đổi metadata, không viết lại bảng notifications.

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title_i18n TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message_i18n TEXT;

ALTER TABLE kpi_approval_steps ADD COLUMN IF NOT EXISTS skip_reason_i18n TEXT;

ALTER TABLE kpi_cycle_events ADD COLUMN IF NOT EXISTS reason_i18n TEXT;

-- Mẫu email tuỳ chỉnh theo từng ngôn ngữ: mỗi tổ chức một bản cho mỗi (loại mail, ngôn ngữ). Bản đã có
-- là tiếng Việt. Người nhận không có bản tuỳ chỉnh cho ngôn ngữ của mình thì nhận nội dung mặc định
-- của ngôn ngữ đó (EmailTemplateCatalog).
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS language VARCHAR(10) NOT NULL DEFAULT 'vi';
ALTER TABLE email_templates DROP CONSTRAINT IF EXISTS uq_org_template;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_org_template_language') THEN
        ALTER TABLE email_templates
            ADD CONSTRAINT uq_org_template_language UNIQUE (organization_id, template_code, language);
    END IF;
END $$;

-- Lý do do hệ thống ghi vào sự kiện chuỗi duyệt (huỷ theo luồng một cấp, KPI bị thay thế/xoá, đóng do khoá kỳ).
ALTER TABLE kpi_approval_events ADD COLUMN IF NOT EXISTS reason_i18n TEXT;
