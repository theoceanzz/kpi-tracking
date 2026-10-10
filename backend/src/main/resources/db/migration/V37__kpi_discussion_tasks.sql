-- V37 — Thảo luận trên KPI / công việc (kiểu 1Office) và Công việc (task) cá nhân gắn với KPI.
-- Gộp từ V37 + V38 (công việc kiểu Lark) + V39 (tệp đính kèm sao từ thư viện) cũ — cùng một chức năng,
-- chưa lên prod. Mọi câu đều chạy lại được (IF NOT EXISTS / ON CONFLICT / NOT EXISTS).
--
-- ═══ 1. Thảo luận ════════════════════════════════════════════════════════════════════════════════
-- Một bảng bình luận chung cho mọi loại đối tượng (target_type = KPI | TASK). Trả lời chỉ lồng MỘT cấp
-- (parent_id trỏ tới bình luận gốc — backend chặn trả lời vào một trả lời). Dòng hệ thống (kind = SYSTEM,
-- author_id NULL) là lịch sử duyệt / từ chối / thay thế hiện xen trong khung thảo luận; chữ của nó lưu
-- dạng LocalizedText (system_i18n) và dịch lúc đọc. Xoá bình luận = xoá mềm; còn trả lời thì giao diện
-- hiện "Bình luận đã bị xoá" và giữ các trả lời.
CREATE TABLE IF NOT EXISTS discussion_comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    target_type     VARCHAR(20)  NOT NULL CHECK (target_type IN ('KPI', 'TASK')),
    target_id       UUID         NOT NULL,
    parent_id       UUID         REFERENCES discussion_comments(id) ON DELETE CASCADE,
    author_id       UUID         REFERENCES users(id),
    kind            VARCHAR(10)  NOT NULL DEFAULT 'USER' CHECK (kind IN ('USER', 'SYSTEM')),
    body            TEXT,
    system_i18n     TEXT,
    -- action (SUBMITTED / APPROVED_FORWARD / APPROVED_FINAL / REJECTED / REPLACED_BY / REPLACES / CYCLE_LOCKED …),
    -- actorId, stepOrder, linkedKpiId … — đủ để giao diện chọn icon và dựng link.
    system_meta     JSONB,
    -- Số chưa đọc chỉ đếm bình luận người dùng; dòng hệ thống chỉ đếm khi có người được đánh dấu ở đây
    -- (dòng "từ chối" → người tạo KPI).
    notify_user_id  UUID         REFERENCES users(id),
    reply_count     INT          NOT NULL DEFAULT 0,
    edited_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    deleted_by      UUID         REFERENCES users(id)
);
-- Phân trang keyset theo (created_at, id) cho bình luận gốc của một đối tượng, mới nhất trước.
CREATE INDEX IF NOT EXISTS idx_discussion_comments_target
    ON discussion_comments(target_type, target_id, created_at DESC, id DESC) WHERE parent_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_discussion_comments_parent
    ON discussion_comments(parent_id, created_at, id) WHERE parent_id IS NOT NULL;
-- Đếm chưa đọc: mọi bình luận (gốc + trả lời) của một đối tượng sau một mốc thời gian.
CREATE INDEX IF NOT EXISTS idx_discussion_comments_unread
    ON discussion_comments(target_type, target_id, created_at) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS discussion_attachments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id       UUID         NOT NULL REFERENCES discussion_comments(id) ON DELETE CASCADE,
    file_name        VARCHAR(255) NOT NULL,
    file_url         TEXT         NOT NULL,
    file_size        BIGINT,
    content_type     VARCHAR(100),
    storage_provider VARCHAR(20)  NOT NULL DEFAULT 'CLOUDINARY',
    storage_key      TEXT,
    uploaded_by      UUID         NOT NULL REFERENCES users(id),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_discussion_attachments_comment ON discussion_attachments(comment_id);

CREATE TABLE IF NOT EXISTS discussion_reactions (
    comment_id UUID        NOT NULL REFERENCES discussion_comments(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction   VARCHAR(20) NOT NULL CHECK (reaction IN ('LIKE', 'AGREE', 'LOVE', 'CHECK', 'QUESTION')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (comment_id, user_id, reaction)
);

CREATE TABLE IF NOT EXISTS discussion_mentions (
    comment_id        UUID NOT NULL REFERENCES discussion_comments(id) ON DELETE CASCADE,
    mentioned_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (comment_id, mentioned_user_id)
);

-- Mốc "đã đọc tới" của từng người trên từng đối tượng. Không có dòng = chưa từng mở.
CREATE TABLE IF NOT EXISTS discussion_read_states (
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type  VARCHAR(20) NOT NULL,
    target_id    UUID        NOT NULL,
    last_read_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, target_type, target_id)
);

-- ═══ 2. Công việc (task) gắn KPI ═════════════════════════════════════════════════════════════════
-- Bản đầu: task cá nhân (người tạo = người thực hiện). owner_id tách khỏi created_by để sau này mở giao việc
-- mà không đổi bảng. visibility: KPI_SCOPE = cấp trên / người duyệt KPI xem được (chỉ đọc), PRIVATE = chỉ
-- người thực hiện. KPI bị xoá mềm thì task vẫn giữ, tên KPI chụp lại ở kpi_name_snapshot.
CREATE TABLE IF NOT EXISTS kpi_tasks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    kpi_criteria_id     UUID         NOT NULL REFERENCES kpi_criteria(id) ON DELETE CASCADE,
    title               VARCHAR(255) NOT NULL,
    description         TEXT,
    due_date            DATE,
    priority            VARCHAR(10)  NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
    status              VARCHAR(20)  NOT NULL DEFAULT 'TODO'
                            CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED')),
    visibility          VARCHAR(20)  NOT NULL DEFAULT 'KPI_SCOPE' CHECK (visibility IN ('KPI_SCOPE', 'PRIVATE')),
    owner_id            UUID         NOT NULL REFERENCES users(id),
    created_by          UUID         NOT NULL REFERENCES users(id),
    sort_order          DOUBLE PRECISION NOT NULL DEFAULT 0,
    completed_at        TIMESTAMPTZ,
    reminded_due_at     TIMESTAMPTZ,
    reminded_overdue_at TIMESTAMPTZ,
    kpi_name_snapshot   VARCHAR(255),
    version             BIGINT       NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_kpi_tasks_owner ON kpi_tasks(owner_id, status, due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_kpi_tasks_kpi ON kpi_tasks(kpi_criteria_id) WHERE deleted_at IS NULL;
-- Job nhắc việc quét task chưa xong có hạn.
CREATE INDEX IF NOT EXISTS idx_kpi_tasks_due ON kpi_tasks(due_date)
    WHERE deleted_at IS NULL AND status IN ('TODO', 'IN_PROGRESS');

CREATE TABLE IF NOT EXISTS kpi_task_checklist_items (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id    UUID         NOT NULL REFERENCES kpi_tasks(id) ON DELETE CASCADE,
    title      VARCHAR(500) NOT NULL,
    done       BOOLEAN      NOT NULL DEFAULT FALSE,
    sort_order INT          NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kpi_task_checklist_task ON kpi_task_checklist_items(task_id, sort_order);

CREATE TABLE IF NOT EXISTS kpi_task_attachments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id          UUID         NOT NULL REFERENCES kpi_tasks(id) ON DELETE CASCADE,
    file_name        VARCHAR(255) NOT NULL,
    file_url         TEXT         NOT NULL,
    file_size        BIGINT,
    content_type     VARCHAR(100),
    storage_provider VARCHAR(20)  NOT NULL DEFAULT 'CLOUDINARY',
    storage_key      TEXT,
    uploaded_by      UUID         NOT NULL REFERENCES users(id),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kpi_task_attachments_task ON kpi_task_attachments(task_id);

-- Lịch sử thay đổi task. Chỉ ghi thêm.
CREATE TABLE IF NOT EXISTS kpi_task_events (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id    UUID        NOT NULL REFERENCES kpi_tasks(id) ON DELETE CASCADE,
    actor_id   UUID        REFERENCES users(id),
    action     VARCHAR(30) NOT NULL,
    old_value  TEXT,
    new_value  TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kpi_task_events_task ON kpi_task_events(task_id, created_at);

-- ═══ 3. Quyền ════════════════════════════════════════════════════════════════════════════════════
-- Id dải 0Axx (08xx = AI, 09xx = DOCUMENT).
INSERT INTO permissions (id, code, resource, action, description) VALUES
  ('00000000-0000-0000-0000-000000000a01', 'KPI_COMMENT:VIEW', 'KPI_COMMENT', 'VIEW',
   'Xem thảo luận trên các KPI mình được xem'),
  ('00000000-0000-0000-0000-000000000a02', 'KPI_COMMENT:CREATE', 'KPI_COMMENT', 'CREATE',
   'Bình luận, trả lời, thả cảm xúc trên các KPI mình được xem'),
  ('00000000-0000-0000-0000-000000000a03', 'KPI_COMMENT:MODERATE', 'KPI_COMMENT', 'MODERATE',
   'Xoá bình luận của người khác trên các KPI mình được xem'),
  ('00000000-0000-0000-0000-000000000a04', 'TASK:VIEW_OWN', 'TASK', 'VIEW_OWN',
   'Có trang "Việc của tôi": tạo và quản lý công việc cá nhân gắn với KPI của mình'),
  ('00000000-0000-0000-0000-000000000a05', 'TASK:VIEW_TEAM', 'TASK', 'VIEW_TEAM',
   'Xem (chỉ đọc) công việc công khai của cấp dưới trên các KPI mình được xem')
ON CONFLICT DO NOTHING;

-- VIEW / CREATE / TASK:VIEW_OWN: mọi vai trò đang có.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, np.id
  FROM roles r
  JOIN permissions np ON np.code IN ('KPI_COMMENT:VIEW', 'KPI_COMMENT:CREATE', 'TASK:VIEW_OWN')
 WHERE r.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- MODERATE / TASK:VIEW_TEAM: vai trò trưởng (rank 0) và vai trò quản trị.
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT r.id, np.id
  FROM roles r
  JOIN permissions np ON np.code IN ('KPI_COMMENT:MODERATE', 'TASK:VIEW_TEAM')
 WHERE r.deleted_at IS NULL
   AND (r.rank = 0
        OR EXISTS (SELECT 1 FROM role_permissions rp JOIN permissions op ON op.id = rp.permission_id
                    WHERE rp.role_id = r.id AND op.code = 'SYSTEM:ADMIN'))
ON CONFLICT DO NOTHING;

-- ═══ 4. Dữ liệu mẫu cho 2 org demo ═══════════════════════════════════════════════════════════════
-- Chọn động 3 KPI đã duyệt có người thực hiện của mỗi org (không gắn cứng id KPI). Chỉ chạy khi org
-- đó chưa có thảo luận nào, nên chạy lại không nhân đôi.
DO $$
DECLARE
    v_org   UUID;
    v_kpi   RECORD;
    v_root  UUID;
    v_reply UUID;
    v_task  UUID;
    v_i     INT;
BEGIN
    FOREACH v_org IN ARRAY ARRAY['11111111-1111-1111-1111-111111111111'::uuid,
                                 '22222222-2222-2222-2222-222222222222'::uuid]
    LOOP
        CONTINUE WHEN NOT EXISTS (SELECT 1 FROM organizations WHERE id = v_org);
        CONTINUE WHEN EXISTS (SELECT 1 FROM discussion_comments WHERE organization_id = v_org);

        v_i := 0;
        FOR v_kpi IN
            SELECT DISTINCT ON (k.id) k.id, k.name, k.created_by, a.user_id AS assignee_id
              FROM kpi_criteria k
              JOIN org_units ou ON ou.id = k.org_unit_id
              JOIN org_hierarchy_levels hl ON hl.id = ou.org_hierarchy_id
              JOIN kpi_criteria_assignees a ON a.kpi_criteria_id = k.id
             WHERE hl.organization_id = v_org
               AND k.deleted_at IS NULL
               AND k.status = 'APPROVED'
               AND a.user_id <> k.created_by
             ORDER BY k.id, a.user_id
             LIMIT 3
        LOOP
            v_i := v_i + 1;

            -- Dòng hệ thống: duyệt cuối.
            INSERT INTO discussion_comments (organization_id, target_type, target_id, kind, system_i18n, system_meta, created_at)
            VALUES (v_org, 'KPI', v_kpi.id, 'SYSTEM',
                    '{"key":"discussion.system.approvedFinal","args":[]}',
                    jsonb_build_object('action', 'APPROVED_FINAL', 'actorId', v_kpi.created_by),
                    NOW() - INTERVAL '3 days');

            -- Nhân viên hỏi, có @tag người tạo KPI.
            INSERT INTO discussion_comments (organization_id, target_type, target_id, author_id, kind, body, reply_count, created_at)
            VALUES (v_org, 'KPI', v_kpi.id, v_kpi.assignee_id, 'USER',
                    'Anh/chị cho em hỏi chỉ tiêu này tính theo số liệu chốt cuối tháng hay theo tuần ạ?',
                    1, NOW() - INTERVAL '2 days')
            RETURNING id INTO v_root;
            INSERT INTO discussion_mentions (comment_id, mentioned_user_id) VALUES (v_root, v_kpi.created_by)
            ON CONFLICT DO NOTHING;

            -- Quản lý trả lời.
            INSERT INTO discussion_comments (organization_id, target_type, target_id, parent_id, author_id, kind, body, created_at)
            VALUES (v_org, 'KPI', v_kpi.id, v_root, v_kpi.created_by, 'USER',
                    'Tính theo số liệu chốt cuối tháng nhé, giữa tháng em cứ cập nhật để theo dõi.',
                    NOW() - INTERVAL '2 days' + INTERVAL '2 hours')
            RETURNING id INTO v_reply;
            INSERT INTO discussion_reactions (comment_id, user_id, reaction) VALUES (v_reply, v_kpi.assignee_id, 'LIKE')
            ON CONFLICT DO NOTHING;

            INSERT INTO discussion_comments (organization_id, target_type, target_id, author_id, kind, body, created_at)
            VALUES (v_org, 'KPI', v_kpi.id, v_kpi.assignee_id, 'USER',
                    'Em đã cập nhật kế hoạch tuần này, có gì anh/chị góp ý thêm ạ.',
                    NOW() - INTERVAL '5 hours');

            -- Người thực hiện đã đọc tới trước bình luận cuối của chính mình; người tạo KPI còn 1–2 bình luận chưa đọc.
            INSERT INTO discussion_read_states (user_id, target_type, target_id, last_read_at)
            VALUES (v_kpi.assignee_id, 'KPI', v_kpi.id, NOW() - INTERVAL '1 hour'),
                   (v_kpi.created_by, 'KPI', v_kpi.id, NOW() - INTERVAL '2 days' + INTERVAL '3 hours')
            ON CONFLICT DO NOTHING;

            -- Công việc của người thực hiện: đủ các trạng thái, có một việc quá hạn.
            INSERT INTO kpi_tasks (organization_id, kpi_criteria_id, title, description, due_date, priority, status,
                                   owner_id, created_by, sort_order, completed_at)
            VALUES
              (v_org, v_kpi.id, 'Thu thập số liệu tuần ' || v_i, 'Tổng hợp số liệu từ các kênh vào bảng theo dõi',
               CURRENT_DATE - 2, 'HIGH', 'IN_PROGRESS', v_kpi.assignee_id, v_kpi.assignee_id, 1, NULL),
              (v_org, v_kpi.id, 'Lập kế hoạch thực hiện', NULL,
               CURRENT_DATE - 7, 'MEDIUM', 'DONE', v_kpi.assignee_id, v_kpi.assignee_id, 2, NOW() - INTERVAL '6 days'),
              (v_org, v_kpi.id, 'Báo cáo tiến độ với trưởng phòng', NULL,
               CURRENT_DATE + 1, 'MEDIUM', 'TODO', v_kpi.assignee_id, v_kpi.assignee_id, 3, NULL),
              (v_org, v_kpi.id, 'Ghi chú cá nhân: ý tưởng cải tiến', 'Chỉ mình tôi xem',
               NULL, 'LOW', 'TODO', v_kpi.assignee_id, v_kpi.assignee_id, 4, NULL);
            UPDATE kpi_tasks SET visibility = 'PRIVATE'
             WHERE kpi_criteria_id = v_kpi.id AND title = 'Ghi chú cá nhân: ý tưởng cải tiến';

            SELECT id INTO v_task FROM kpi_tasks
             WHERE kpi_criteria_id = v_kpi.id AND title = 'Thu thập số liệu tuần ' || v_i LIMIT 1;
            INSERT INTO kpi_task_checklist_items (task_id, title, done, sort_order) VALUES
              (v_task, 'Lấy số liệu kênh 1', TRUE, 1),
              (v_task, 'Lấy số liệu kênh 2', FALSE, 2),
              (v_task, 'Đối chiếu với tháng trước', FALSE, 3);
            INSERT INTO kpi_task_events (task_id, actor_id, action, old_value, new_value)
            VALUES (v_task, v_kpi.assignee_id, 'CREATED', NULL, NULL),
                   (v_task, v_kpi.assignee_id, 'STATUS_CHANGED', 'TODO', 'IN_PROGRESS');
        END LOOP;
    END LOOP;
END $$;


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- PHẦN 2 (V38 cũ) — CÔNG VIỆC KIỂU LARK
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- Công việc kiểu Lark Tasks: giao việc + người theo dõi, việc con 1 cấp, lặp lại, hạn có giờ, nhắc theo từng
-- task, mô tả có định dạng. Mọi câu chạy lại được.
--
-- ═══ 1. Cột mới của kpi_tasks ═════════════════════════════════════════════════════════════════════
-- parent_task_id: việc con (chỉ 1 cấp — backend chặn việc con của việc con), cùng KPI với task cha.
-- due_time: giờ của hạn (giờ VN); NULL = hạn cả ngày. due_date giữ nguyên để nhóm / lọc / vẽ lịch theo ngày.
-- description_doc: mô tả có định dạng (JSON của trình soạn tiptap) — không lưu HTML nên không có XSS; cột
--   description cũ giữ bản chữ thuần để tìm kiếm và trích vào thông báo.
-- recurrence_rule: {freq: DAILY|WEEKLY|MONTHLY, interval, byWeekday[1..7], byMonthDay, template{…}}.
--   Lần kế tiếp được tạo LÚC HOÀN THÀNH lần trước (như Lark), chép từ "template" (giá trị cho các lần sau).
-- series_id / series_index: các lần của cùng một chuỗi lặp.
ALTER TABLE kpi_tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES kpi_tasks(id) ON DELETE CASCADE;
ALTER TABLE kpi_tasks ADD COLUMN IF NOT EXISTS due_time TIME;
ALTER TABLE kpi_tasks ADD COLUMN IF NOT EXISTS description_doc JSONB;
ALTER TABLE kpi_tasks ADD COLUMN IF NOT EXISTS recurrence_rule JSONB;
ALTER TABLE kpi_tasks ADD COLUMN IF NOT EXISTS recurrence_end_date DATE;
ALTER TABLE kpi_tasks ADD COLUMN IF NOT EXISTS series_id UUID;
ALTER TABLE kpi_tasks ADD COLUMN IF NOT EXISTS series_index INT;

CREATE INDEX IF NOT EXISTS idx_kpi_tasks_parent ON kpi_tasks(parent_task_id) WHERE deleted_at IS NULL AND parent_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kpi_tasks_series ON kpi_tasks(series_id, series_index) WHERE series_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kpi_tasks_creator ON kpi_tasks(created_by, status) WHERE deleted_at IS NULL;

-- ═══ 2. Người theo dõi ════════════════════════════════════════════════════════════════════════════
-- Chỉ xem + bình luận + nhận thông báo. Chỉ người xem được KPI của task mới được thêm (backend kiểm).
CREATE TABLE IF NOT EXISTS kpi_task_followers (
    task_id  UUID        NOT NULL REFERENCES kpi_tasks(id) ON DELETE CASCADE,
    user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_by UUID        REFERENCES users(id),
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_kpi_task_followers_user ON kpi_task_followers(user_id);

-- ═══ 3. Nhắc việc theo từng task ══════════════════════════════════════════════════════════════════
-- kind: AT_DUE (đúng hạn) | BEFORE (trước offset_minutes phút) | CUSTOM (đúng lúc custom_at).
-- remind_at tính sẵn (hạn cả ngày lấy 09:00 giờ VN làm mốc) để job 5 phút quét theo index; đổi hạn thì tính lại
-- và xoá sent_at. Mỗi dòng gửi đúng một lần (sent_at).
CREATE TABLE IF NOT EXISTS kpi_task_reminders (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id        UUID        NOT NULL REFERENCES kpi_tasks(id) ON DELETE CASCADE,
    kind           VARCHAR(10) NOT NULL CHECK (kind IN ('AT_DUE', 'BEFORE', 'CUSTOM')),
    offset_minutes INT,
    custom_at      TIMESTAMPTZ,
    remind_at      TIMESTAMPTZ,
    sent_at        TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kpi_task_reminders_task ON kpi_task_reminders(task_id);
CREATE INDEX IF NOT EXISTS idx_kpi_task_reminders_due ON kpi_task_reminders(remind_at) WHERE sent_at IS NULL;

-- Dữ liệu cũ: task có hạn, chưa xong, chưa được nhắc "sắp đến hạn" ⇒ một nhắc "trước 1 ngày" (giữ hành vi cũ).
INSERT INTO kpi_task_reminders (task_id, kind, offset_minutes, remind_at)
SELECT t.id, 'BEFORE', 1440,
       ((t.due_date - 1)::timestamp + TIME '09:00') AT TIME ZONE 'Asia/Ho_Chi_Minh'
  FROM kpi_tasks t
 WHERE t.deleted_at IS NULL
   AND t.due_date IS NOT NULL
   AND t.status IN ('TODO', 'IN_PROGRESS')
   AND t.reminded_due_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM kpi_task_reminders r WHERE r.task_id = t.id);

-- ═══ 4. Quyền giao việc ═══════════════════════════════════════════════════════════════════════════
-- Giao cho người trong đơn vị mình và đơn vị con, trên KPI của người đó mà mình xem được. Không có quyền này
-- thì chỉ tự giao cho mình.
INSERT INTO permissions (id, code, resource, action, description) VALUES
  ('00000000-0000-0000-0000-000000000a06', 'TASK:ASSIGN', 'TASK', 'ASSIGN',
   'Giao công việc cho người trong đơn vị mình và đơn vị con (trên KPI của họ mà mình xem được)')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT r.id, np.id
  FROM roles r
  JOIN permissions np ON np.code = 'TASK:ASSIGN'
 WHERE r.deleted_at IS NULL
   AND (r.rank <= 1
        OR EXISTS (SELECT 1 FROM role_permissions rp JOIN permissions op ON op.id = rp.permission_id
                    WHERE rp.role_id = r.id AND op.code = 'SYSTEM:ADMIN'))
ON CONFLICT DO NOTHING;

-- ═══ 5. Dữ liệu mẫu cho 2 org demo ═══════════════════════════════════════════════════════════════
-- Trên các task mẫu của V37: người tạo KPI (thường là trưởng đơn vị) theo dõi task "Thu thập số liệu", mỗi task đó
-- có 2 việc con; task "Báo cáo tiến độ" lặp hằng tuần vào thứ 6, có giờ hạn 16:00 và nhắc trước 1 giờ.
DO $$
DECLARE
    v_task RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM kpi_task_followers) THEN
        RETURN;
    END IF;
    FOR v_task IN
        SELECT t.id, t.organization_id, t.kpi_criteria_id, t.owner_id, k.created_by AS kpi_creator
          FROM kpi_tasks t JOIN kpi_criteria k ON k.id = t.kpi_criteria_id
         WHERE t.deleted_at IS NULL AND t.title LIKE 'Thu thập số liệu tuần %'
           AND t.organization_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')
    LOOP
        IF v_task.kpi_creator <> v_task.owner_id THEN
            INSERT INTO kpi_task_followers (task_id, user_id, added_by) VALUES (v_task.id, v_task.kpi_creator, v_task.owner_id)
            ON CONFLICT DO NOTHING;
        END IF;
        INSERT INTO kpi_tasks (organization_id, kpi_criteria_id, parent_task_id, title, priority, status, owner_id, created_by,
                               sort_order, due_date)
        VALUES (v_task.organization_id, v_task.kpi_criteria_id, v_task.id, 'Xuất số liệu từ hệ thống', 'MEDIUM', 'DONE',
                v_task.owner_id, v_task.owner_id, 1, CURRENT_DATE - 3),
               (v_task.organization_id, v_task.kpi_criteria_id, v_task.id, 'Làm sạch và đối chiếu số liệu', 'MEDIUM', 'TODO',
                v_task.owner_id, v_task.owner_id, 2, CURRENT_DATE + 2);
    END LOOP;

    UPDATE kpi_tasks t
       SET recurrence_rule = '{"freq":"WEEKLY","interval":1,"byWeekday":[5]}'::jsonb,
           series_id = t.id, series_index = 1,
           due_date = CURRENT_DATE + ((5 - EXTRACT(ISODOW FROM CURRENT_DATE)::int + 7) % 7),
           due_time = TIME '16:00'
     WHERE t.deleted_at IS NULL AND t.title = 'Báo cáo tiến độ với trưởng phòng' AND t.status = 'TODO'
       AND t.organization_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

    DELETE FROM kpi_task_reminders r USING kpi_tasks t
     WHERE r.task_id = t.id AND t.title = 'Báo cáo tiến độ với trưởng phòng' AND t.recurrence_rule IS NOT NULL;
    INSERT INTO kpi_task_reminders (task_id, kind, offset_minutes, remind_at)
    SELECT t.id, 'BEFORE', 60, ((t.due_date)::timestamp + t.due_time - INTERVAL '60 minutes') AT TIME ZONE 'Asia/Ho_Chi_Minh'
      FROM kpi_tasks t
     WHERE t.title = 'Báo cáo tiến độ với trưởng phòng' AND t.recurrence_rule IS NOT NULL AND t.deleted_at IS NULL;
END $$;


-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- PHẦN 3 (V39 cũ) — TỆP ĐÍNH KÈM SAO TỪ THƯ VIỆN TÀI LIỆU
-- ════════════════════════════════════════════════════════════════════════════════════════════════════
-- Tệp đính kèm chọn từ thư viện tài liệu: vẫn là BẢN SAO (tệp riêng trên kho lưu trữ), chỉ ghi thêm tài liệu gốc để
-- hiện nhãn "Từ thư viện: …" và link "Mở bản mới nhất". Không khoá ngoại: xoá / dọn tài liệu gốc không đụng tới bản sao,
-- link tự ẩn khi tài liệu gốc không còn. Tên lưu kèm là ảnh chụp lúc đính kèm (tài liệu gốc đã xoá vẫn còn nhãn).
ALTER TABLE discussion_attachments ADD COLUMN IF NOT EXISTS source_document_id UUID;
ALTER TABLE discussion_attachments ADD COLUMN IF NOT EXISTS source_document_title VARCHAR(500);
ALTER TABLE kpi_task_attachments ADD COLUMN IF NOT EXISTS source_document_id UUID;
ALTER TABLE kpi_task_attachments ADD COLUMN IF NOT EXISTS source_document_title VARCHAR(500);
