-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- V42 — CÔNG VIỆC KIỂU LARK ĐẦY ĐỦ (thiết kế: docs/TASKS_DESIGN.md)
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- KPI thành tuỳ chọn; nhiều người thực hiện; danh sách công việc (nhóm, trường tuỳ chỉnh, chế độ xem, mẫu, tự động hoá);
-- việc con nhiều cấp; ngày bắt đầu; nhãn; phụ thuộc; nguồn tạo việc; cá nhân hoá (ghim / thư mục danh sách, "Nhóm của tôi",
-- biểu tượng + bảng điều khiển danh sách); việc mốc. Mọi câu chạy lại được.
-- (Gộp từ V42 + V43 tasks_lark_personal + V44 tasks_milestone ngày 2026-10-16, trước khi lên prod.)

-- ═══ 1. kpi_tasks ══════════════════════════════════════════════════════════════════════════════════
-- KPI tuỳ chọn. Khoá ngoại giữ ON DELETE CASCADE: KPI chỉ xoá MỀM (việc giữ id + kpi_name_snapshot, chỉ đọc) — xoá cứng
-- chỉ có ở dọn dữ liệu test. KHÔNG chuyển về NULL khi KPI bị xoá: việc sẽ thoát luật chỉ đọc.
ALTER TABLE kpi_tasks ALTER COLUMN kpi_criteria_id DROP NOT NULL;

ALTER TABLE kpi_tasks ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE kpi_tasks ADD COLUMN IF NOT EXISTS start_time TIME;
-- ANY: một người tích là xong; ALL: mỗi người tích phần mình, xong khi người cuối tích.
ALTER TABLE kpi_tasks ADD COLUMN IF NOT EXISTS completion_mode VARCHAR(10) NOT NULL DEFAULT 'ANY';
DO $$ BEGIN
    ALTER TABLE kpi_tasks ADD CONSTRAINT kpi_tasks_completion_mode_chk CHECK (completion_mode IN ('ANY', 'ALL'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Việc con nhiều cấp: root_task_id NULL = chính nó là gốc; depth 0 = gốc, tối đa 4 (5 cấp).
ALTER TABLE kpi_tasks ADD COLUMN IF NOT EXISTS root_task_id UUID REFERENCES kpi_tasks(id) ON DELETE CASCADE;
ALTER TABLE kpi_tasks ADD COLUMN IF NOT EXISTS depth SMALLINT NOT NULL DEFAULT 0;
-- Chuỗi id tổ tiên (gốc → cha): luật "người của việc tổ tiên xem / sửa được việc con" viết được bằng SQL không đệ quy.
ALTER TABLE kpi_tasks ADD COLUMN IF NOT EXISTS ancestor_ids UUID[] NOT NULL DEFAULT '{}';
-- Nguồn tạo việc: {"type":"COMMENT"|"DOCUMENT"|"AI","id":"…","label":"…"} — chỉ để hiện "Tạo từ …".
ALTER TABLE kpi_tasks ADD COLUMN IF NOT EXISTS source_ref JSONB;

UPDATE kpi_tasks SET root_task_id = parent_task_id, depth = 1, ancestor_ids = ARRAY[parent_task_id]
 WHERE parent_task_id IS NOT NULL AND root_task_id IS NULL;
-- Việc con có phạm vi xem của việc gốc (trước đây đổi phạm vi của việc cha không lan xuống việc con).
UPDATE kpi_tasks c SET visibility = p.visibility
  FROM kpi_tasks p WHERE c.parent_task_id = p.id AND c.visibility <> p.visibility;

CREATE INDEX IF NOT EXISTS idx_kpi_tasks_root ON kpi_tasks(root_task_id) WHERE deleted_at IS NULL AND root_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kpi_tasks_start ON kpi_tasks(start_date) WHERE deleted_at IS NULL AND start_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kpi_tasks_org_nokpi ON kpi_tasks(organization_id) WHERE deleted_at IS NULL AND kpi_criteria_id IS NULL;

-- ═══ 2. Người thực hiện ════════════════════════════════════════════════════════════════════════════
-- owner_id vẫn là người phụ trách CHÍNH và luôn có mặt ở đây. completed_at: phần của người này (chế độ ALL).
CREATE TABLE IF NOT EXISTS kpi_task_assignees (
    task_id      UUID        NOT NULL REFERENCES kpi_tasks(id) ON DELETE CASCADE,
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ,
    added_by     UUID        REFERENCES users(id),
    added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_kpi_task_assignees_user ON kpi_task_assignees(user_id);

INSERT INTO kpi_task_assignees (task_id, user_id, completed_at, added_by, added_at)
SELECT t.id, t.owner_id, CASE WHEN t.status = 'DONE' THEN t.completed_at END, t.created_by, t.created_at
  FROM kpi_tasks t
ON CONFLICT DO NOTHING;

-- ═══ 3. Danh sách công việc ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS task_lists (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    color           VARCHAR(20),
    created_by      UUID         NOT NULL REFERENCES users(id),
    archived_at     TIMESTAMPTZ,
    version         BIGINT       NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_task_lists_org ON task_lists(organization_id) WHERE deleted_at IS NULL;

-- Thành viên: MỘT người hoặc MỘT đơn vị (gồm cả đơn vị con). Vai trò cao nhất thắng.
CREATE TABLE IF NOT EXISTS task_list_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id     UUID        NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
    user_id     UUID        REFERENCES users(id) ON DELETE CASCADE,
    org_unit_id UUID        REFERENCES org_units(id) ON DELETE CASCADE,
    role        VARCHAR(10) NOT NULL CHECK (role IN ('OWNER', 'EDITOR', 'VIEWER')),
    added_by    UUID        REFERENCES users(id),
    added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((user_id IS NULL) <> (org_unit_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_task_list_members_user ON task_list_members(list_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_task_list_members_unit ON task_list_members(list_id, org_unit_id) WHERE org_unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_list_members_user ON task_list_members(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_list_members_unit ON task_list_members(org_unit_id) WHERE org_unit_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS task_list_sections (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id    UUID             NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
    name       VARCHAR(120)     NOT NULL,
    sort_order DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_list_sections_list ON task_list_sections(list_id, sort_order);

-- Việc trong danh sách: nhóm + thứ tự gắn với CẶP (việc, danh sách). Chỉ việc gốc được thêm (việc con đi theo).
CREATE TABLE IF NOT EXISTS task_list_items (
    list_id    UUID             NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
    task_id    UUID             NOT NULL REFERENCES kpi_tasks(id) ON DELETE CASCADE,
    section_id UUID             REFERENCES task_list_sections(id) ON DELETE SET NULL,
    sort_order DOUBLE PRECISION NOT NULL DEFAULT 0,
    added_by   UUID             REFERENCES users(id),
    added_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    PRIMARY KEY (list_id, task_id)
);
CREATE INDEX IF NOT EXISTS idx_task_list_items_task ON task_list_items(task_id);

-- Trường tuỳ chỉnh — mỗi danh sách một bộ. options: [{"id","label","color"}] cho SINGLE/MULTI_SELECT.
CREATE TABLE IF NOT EXISTS task_list_fields (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id    UUID             NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
    name       VARCHAR(120)     NOT NULL,
    type       VARCHAR(20)      NOT NULL CHECK (type IN ('TEXT', 'NUMBER', 'SINGLE_SELECT', 'MULTI_SELECT', 'MEMBER', 'DATE', 'CHECKBOX')),
    options    JSONB,
    sort_order DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_task_list_fields_list ON task_list_fields(list_id) WHERE deleted_at IS NULL;

-- Giá trị: {"v": …} — chuỗi / số / id lựa chọn / mảng id / id người / ngày ISO / true-false.
CREATE TABLE IF NOT EXISTS task_field_values (
    task_id    UUID        NOT NULL REFERENCES kpi_tasks(id) ON DELETE CASCADE,
    field_id   UUID        NOT NULL REFERENCES task_list_fields(id) ON DELETE CASCADE,
    value      JSONB       NOT NULL,
    updated_by UUID        REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_id, field_id)
);
CREATE INDEX IF NOT EXISTS idx_task_field_values_field ON task_field_values(field_id);
CREATE INDEX IF NOT EXISTS idx_task_field_values_gin ON task_field_values USING GIN (value jsonb_path_ops);

-- Chế độ xem đã lưu: theo người (list_id NULL = trang "Của tôi"), hoặc chia sẻ cho thành viên một danh sách.
CREATE TABLE IF NOT EXISTS task_saved_views (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID             NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    owner_id        UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    list_id         UUID             REFERENCES task_lists(id) ON DELETE CASCADE,
    name            VARCHAR(120)     NOT NULL,
    config          JSONB            NOT NULL,
    shared          BOOLEAN          NOT NULL DEFAULT FALSE,
    sort_order      DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_saved_views_owner ON task_saved_views(owner_id);
CREATE INDEX IF NOT EXISTS idx_task_saved_views_list ON task_saved_views(list_id) WHERE list_id IS NOT NULL;

-- Mẫu danh sách của tổ chức (mẫu có sẵn nằm trong code). payload: {sections, fields, tasks, automations}.
CREATE TABLE IF NOT EXISTS task_list_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    payload         JSONB        NOT NULL,
    created_by      UUID         NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_task_list_templates_org ON task_list_templates(organization_id) WHERE deleted_at IS NULL;

-- Tự động hoá: trigger {"type": TASK_ADDED|SECTION_ENTERED|STATUS_CHANGED|COMPLETED|FIELD_CHANGED, …},
-- action {"type": SET_STATUS|MOVE_SECTION|ADD_ASSIGNEE|ADD_FOLLOWER|SET_PRIORITY|SET_FIELD|SET_DUE_IN_DAYS|NOTIFY, …}.
CREATE TABLE IF NOT EXISTS task_list_automations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id     UUID         NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    trigger     JSONB        NOT NULL,
    action      JSONB        NOT NULL,
    enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by  UUID         NOT NULL REFERENCES users(id),
    run_count   INT          NOT NULL DEFAULT 0,
    last_run_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_list_automations_list ON task_list_automations(list_id) WHERE enabled;

-- ═══ 4. Nhãn, phụ thuộc ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS task_tags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(60) NOT NULL,
    color           VARCHAR(20),
    created_by      UUID        REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_task_tags_name ON task_tags(organization_id, LOWER(name));

CREATE TABLE IF NOT EXISTS task_tag_links (
    task_id UUID NOT NULL REFERENCES kpi_tasks(id) ON DELETE CASCADE,
    tag_id  UUID NOT NULL REFERENCES task_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_task_tag_links_tag ON task_tag_links(tag_id);

-- FS: predecessor phải xong trước khi successor xong (chặn mềm, có "vẫn hoàn thành").
CREATE TABLE IF NOT EXISTS task_dependencies (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    predecessor_id UUID        NOT NULL REFERENCES kpi_tasks(id) ON DELETE CASCADE,
    successor_id   UUID        NOT NULL REFERENCES kpi_tasks(id) ON DELETE CASCADE,
    created_by     UUID        REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (predecessor_id <> successor_id),
    UNIQUE (predecessor_id, successor_id)
);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_successor ON task_dependencies(successor_id);

-- ═══ 5. Cá nhân hoá ═════════════════════════════════════════════════════════════════════════════════
-- Biểu tượng (emoji) + bảng điều khiển (cấu hình biểu đồ) của danh sách; ghim / thư mục RIÊNG từng người cho danh sách ở
-- cột trái (task_list_user_prefs); nhóm riêng trong "Việc của tôi" (task_my_sections + _items). Không đụng dữ liệu cũ.
ALTER TABLE task_lists ADD COLUMN IF NOT EXISTS icon VARCHAR(16);
ALTER TABLE task_lists ADD COLUMN IF NOT EXISTS dashboard JSONB;

CREATE TABLE IF NOT EXISTS task_list_user_prefs (
    list_id    UUID         NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
    user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pinned     BOOLEAN      NOT NULL DEFAULT FALSE,
    folder     VARCHAR(100),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (list_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_task_list_user_prefs_user ON task_list_user_prefs(user_id);

CREATE TABLE IF NOT EXISTS task_my_sections (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(120)     NOT NULL,
    sort_order DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_my_sections_user ON task_my_sections(user_id);

CREATE TABLE IF NOT EXISTS task_my_section_items (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id    UUID NOT NULL REFERENCES kpi_tasks(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES task_my_sections(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, task_id)
);
CREATE INDEX IF NOT EXISTS idx_task_my_section_items_section ON task_my_section_items(section_id);

-- ═══ 6. Việc mốc ═══════════════════════════════════════════════════════════════════════════════════
-- "Đánh dấu mốc" (Mark as Milestone) của Lark: việc mốc hiện hình thoi thay vì ô tròn ở mọi chế độ xem.
ALTER TABLE kpi_tasks ADD COLUMN IF NOT EXISTS milestone BOOLEAN NOT NULL DEFAULT FALSE;
