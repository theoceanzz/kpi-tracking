-- Đánh giá 360 độ (docs/FEEDBACK_360_DESIGN.md).
--
-- Toàn bộ schema của cả ba giai đoạn (đề cử, tách liên kết ẩn danh, tóm tắt AI, móc vào xếp loại kỳ).
-- Số đo lưu DOUBLE PRECISION chứ không NUMERIC: entity dùng Double và ddl-auto=validate từ
-- chối numeric ↔ float8, cùng quy ước với mọi cột điểm khác trong dự án.
--
-- Không bảng nào ở đây thuộc nhóm "bảng lớn" nên index tạo thường. Riêng f360_answers sẽ lớn
-- dần (~100k dòng/chiến dịch 500 người): index THÊM SAU trên bảng này phải CONCURRENTLY + .conf.

-- Tắt mặc định như enable_conduct / enable_reward: không tổ chức nào bỗng thấy menu lạ.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS enable_feedback360         BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS feedback360_affects_rating BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Bộ câu hỏi (cấu hình, dùng lại qua nhiều chiến dịch) ──
CREATE TABLE IF NOT EXISTS f360_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    scale_max       INT          NOT NULL DEFAULT 5 CHECK (scale_max BETWEEN 3 AND 10),
    is_default      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_f360_tpl_org ON f360_templates(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_f360_tpl_default
    ON f360_templates(organization_id) WHERE is_default AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS f360_competencies (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id    UUID             NOT NULL REFERENCES f360_templates(id) ON DELETE CASCADE,
    name           VARCHAR(255)     NOT NULL,
    description    TEXT,
    weight         DOUBLE PRECISION NOT NULL,
    position_index INT              NOT NULL,
    created_at     TIMESTAMPTZ      NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ,
    deleted_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_f360_comp_tpl ON f360_competencies(template_id);

CREATE TABLE IF NOT EXISTS f360_questions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id    UUID        NOT NULL REFERENCES f360_templates(id) ON DELETE CASCADE,
    -- NULL = câu mở chung, không thuộc năng lực nào.
    competency_id  UUID REFERENCES f360_competencies(id) ON DELETE CASCADE,
    question_type  VARCHAR(20) NOT NULL,
    text           TEXT        NOT NULL,
    -- Nhóm quan hệ được hỏi câu này, CSV enum. NULL = hỏi mọi nhóm.
    relationships  VARCHAR(100),
    required       BOOLEAN     NOT NULL DEFAULT TRUE,
    allow_na       BOOLEAN     NOT NULL DEFAULT TRUE,
    position_index INT         NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ,
    deleted_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_f360_q_tpl ON f360_questions(template_id);

-- ── Chiến dịch ──
CREATE TABLE IF NOT EXISTS f360_campaigns (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    kpi_cycle_id          UUID REFERENCES kpi_cycles(id) ON DELETE SET NULL,
    -- Chỉ để truy vết: phiếu dùng bản chụp f360_campaign_questions.
    template_id           UUID REFERENCES f360_templates(id) ON DELETE SET NULL,
    name                  VARCHAR(255) NOT NULL,
    description           TEXT,
    status                VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    scoring_mode          VARCHAR(30)  NOT NULL DEFAULT 'DEVELOPMENT_ONLY',
    blend_conduct_percent INT,
    scale_max             INT          NOT NULL DEFAULT 5,
    anonymity_threshold   INT          NOT NULL DEFAULT 3 CHECK (anonymity_threshold >= 2),
    -- Tách liên kết người chấm ↔ câu trả lời khi đóng chiến dịch (F360UnlinkJob, §6.3).
    strict_anonymity      BOOLEAN      NOT NULL DEFAULT TRUE,
    -- CHỈ ghi nhận lần F360UnlinkJob chạy gần nhất; KHÔNG dùng để bỏ qua job.
    unlinked_at           TIMESTAMPTZ,
    include_self          BOOLEAN      NOT NULL DEFAULT TRUE,
    manager_anonymous     BOOLEAN      NOT NULL DEFAULT FALSE,
    allow_nomination      BOOLEAN      NOT NULL DEFAULT FALSE,
    release_to_subject    BOOLEAN      NOT NULL DEFAULT TRUE,
    relationship_weights  JSONB        NOT NULL DEFAULT '{"MANAGER":40,"PEER":30,"DIRECT_REPORT":20,"OTHER":10,"SELF":0}',
    rater_rules           JSONB        NOT NULL DEFAULT '{"maxPeers":5,"maxDirectReports":6,"minNominees":0,"maxNominees":5,"maxAssignmentsPerRater":10,"managerWarnThreshold":12}',
    report_settings       JSONB        NOT NULL DEFAULT '{"blindSpotGap":1.0,"dispersionFlag":1.2,"aiSummary":false}',
    nomination_deadline   TIMESTAMPTZ,
    start_at              TIMESTAMPTZ,
    due_at                TIMESTAMPTZ,
    auto_close            BOOLEAN      NOT NULL DEFAULT TRUE,
    launched_at           TIMESTAMPTZ,
    closed_at             TIMESTAMPTZ,
    released_at           TIMESTAMPTZ,
    created_by            UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ,
    deleted_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_f360_camp_org   ON f360_campaigns(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_f360_camp_cycle ON f360_campaigns(kpi_cycle_id);
-- Tra nhanh "các chiến dịch có ảnh hưởng điểm của một kỳ" cho guard chốt kỳ (§7.2-5).
CREATE INDEX IF NOT EXISTS idx_f360_camp_cycle_mode ON f360_campaigns(kpi_cycle_id, scoring_mode)
    WHERE deleted_at IS NULL;

-- Bộ câu hỏi THUỘC một chiến dịch (soạn thẳng trong form chiến dịch, như hạng mục trong bộ tiêu chí
-- BSC). NULL = bộ mẫu dùng chung của tổ chức (bộ mặc định dựng lúc bật tính năng). Thêm bằng ALTER vì
-- f360_campaigns tham chiếu ngược f360_templates.
ALTER TABLE f360_templates ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES f360_campaigns(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_f360_tpl_campaign ON f360_templates(campaign_id);

-- Bản chụp câu hỏi lúc launch: sửa/xoá bộ câu hỏi sau đó không làm đổi phiếu đã phát
-- (cùng lý do ConductEvaluationItem chụp tiêu chí).
CREATE TABLE IF NOT EXISTS f360_campaign_questions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID        NOT NULL REFERENCES f360_campaigns(id) ON DELETE CASCADE,
    source_question_id  UUID,
    -- Khoá gom câu theo năng lực trong bản chụp (id năng lực gốc, không FK).
    competency_key      UUID,
    competency_name     VARCHAR(255),
    competency_weight   DOUBLE PRECISION,
    competency_position INT,
    question_type       VARCHAR(20) NOT NULL,
    text                TEXT        NOT NULL,
    relationships       VARCHAR(100),
    required            BOOLEAN     NOT NULL,
    allow_na            BOOLEAN     NOT NULL,
    position_index      INT         NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_f360_cq_camp ON f360_campaign_questions(campaign_id);

CREATE TABLE IF NOT EXISTS f360_subjects (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id             UUID        NOT NULL REFERENCES f360_campaigns(id) ON DELETE CASCADE,
    user_id                 UUID        NOT NULL REFERENCES users(id),
    -- Đơn vị chính CHỤP lúc thêm: chuyển phòng giữa chiến dịch không làm lệch quan hệ.
    org_unit_id             UUID REFERENCES org_units(id) ON DELETE SET NULL,
    approver_id             UUID REFERENCES users(id) ON DELETE SET NULL,
    status                  VARCHAR(30) NOT NULL DEFAULT 'NOMINATING',
    nomination_submitted_at TIMESTAMPTZ,
    approved_at             TIMESTAMPTZ,
    -- Kết quả CHỤP lúc CLOSED. result_snapshot giữ ĐIỂM và chỉ số đã qua ngưỡng ẩn danh,
    -- KHÔNG giữ nhận xét: nhận xét đọc live có lọc hidden_at để "Ẩn nhận xét" có hiệu lực ngay.
    overall_score           DOUBLE PRECISION,
    self_score              DOUBLE PRECISION,
    response_count          INT,
    result_snapshot         JSONB,
    ai_summary              TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ,
    deleted_at              TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_f360_subject
    ON f360_subjects(campaign_id, user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_f360_subject_user ON f360_subjects(user_id);
-- Hàng chờ duyệt đề cử của một người duyệt.
CREATE INDEX IF NOT EXISTS idx_f360_subject_approver ON f360_subjects(approver_id, status);

CREATE TABLE IF NOT EXISTS f360_assignments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id       UUID        NOT NULL REFERENCES f360_subjects(id) ON DELETE CASCADE,
    rater_id         UUID        NOT NULL REFERENCES users(id),
    relationship     VARCHAR(20) NOT NULL,
    source           VARCHAR(20) NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    decline_reason   TEXT,
    reopen_reason    TEXT,
    started_at       TIMESTAMPTZ,
    submitted_at     TIMESTAMPTZ,
    last_reminded_at TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ
);
-- Partial: phiếu REMOVED không chặn. Service tái dùng dòng REMOVED khi thêm lại đúng người;
-- index này là lưới an toàn nếu có đường nào đó tạo dòng mới.
CREATE UNIQUE INDEX IF NOT EXISTS uq_f360_assign
    ON f360_assignments(subject_id, rater_id) WHERE status <> 'REMOVED';
CREATE INDEX IF NOT EXISTS idx_f360_assign_rater ON f360_assignments(rater_id, status);

CREATE TABLE IF NOT EXISTS f360_answers (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- NULL sau khi tách liên kết ở chế độ ẩn danh nghiêm ngặt.
    assignment_id        UUID REFERENCES f360_assignments(id) ON DELETE CASCADE,
    subject_id           UUID        NOT NULL REFERENCES f360_subjects(id) ON DELETE CASCADE,
    relationship         VARCHAR(20) NOT NULL,
    campaign_question_id UUID        NOT NULL REFERENCES f360_campaign_questions(id) ON DELETE CASCADE,
    score                DOUBLE PRECISION,
    is_na                BOOLEAN     NOT NULL DEFAULT FALSE,
    comment              TEXT,
    hidden_at            TIMESTAMPTZ,
    hidden_by            UUID REFERENCES users(id) ON DELETE SET NULL,
    hidden_reason        TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_f360_answer
    ON f360_answers(assignment_id, campaign_question_id) WHERE assignment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_f360_answer_subject ON f360_answers(subject_id, relationship);

-- Nhật ký chỉ ghi thêm. detail KHÔNG chứa nội dung nhận xét.
CREATE TABLE IF NOT EXISTS f360_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID        NOT NULL REFERENCES f360_campaigns(id) ON DELETE CASCADE,
    subject_id  UUID REFERENCES f360_subjects(id) ON DELETE CASCADE,
    action      VARCHAR(40) NOT NULL,
    actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    detail      JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_f360_events_camp ON f360_events(campaign_id, created_at);

-- Điểm 360 chụp lúc "chốt dữ liệu kỳ" (giai đoạn 3) — cạnh baseline_score.
ALTER TABLE cycle_user_evaluations ADD COLUMN IF NOT EXISTS feedback360_score DOUBLE PRECISION;

-- ── Quyền ──
INSERT INTO permissions (id, code, resource, action, description) VALUES
  ('00000000-0000-0000-0000-000000000601', 'FEEDBACK360:MANAGE',  'FEEDBACK360', 'MANAGE',
   'Tạo, cấu hình, mở/đóng/công bố chiến dịch đánh giá 360 và bộ câu hỏi'),
  ('00000000-0000-0000-0000-000000000602', 'FEEDBACK360:VIEW',    'FEEDBACK360', 'VIEW',
   'Xem tiến độ và báo cáo 360 của nhân sự trong phạm vi quản lý'),
  ('00000000-0000-0000-0000-000000000603', 'FEEDBACK360:VIEW_MY', 'FEEDBACK360', 'VIEW_MY',
   'Xem báo cáo 360 của chính mình khi đã công bố')
ON CONFLICT DO NOTHING;

-- Gán cho vai trò HIỆN CÓ theo quyền tương đương đang có, không theo tên vai trò (mỗi tổ chức
-- đặt tên một khác). VIEW_MY đi theo cả KPI:VIEW_MY lẫn COMPANY:VIEW vì giám đốc không có
-- quyền "của tôi" nào nhưng vẫn có thể là người được đánh giá.
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, np.id
  FROM role_permissions rp
  JOIN permissions op ON op.id = rp.permission_id
  JOIN permissions np ON (op.code = 'COMPANY:UPDATE'  AND np.code = 'FEEDBACK360:MANAGE')
                      OR (op.code IN ('KPI:VIEW_MY', 'COMPANY:VIEW') AND np.code = 'FEEDBACK360:VIEW_MY')
ON CONFLICT DO NOTHING;

-- VIEW (xem báo cáo 360 của người trong đơn vị) CHỈ cho vai trò lãnh đạo (rank 0 trưởng, 1 phó)
-- đang xem được đánh giá. KHÔNG suy từ riêng EVALUATION:VIEW: vai trò nhân viên cũng có quyền đó,
-- và FEEDBACK360:VIEW xét theo đơn vị — nhân viên sẽ đọc được báo cáo 360 của đồng nghiệp.
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, np.id
  FROM role_permissions rp
  JOIN roles r        ON r.id = rp.role_id
  JOIN permissions op ON op.id = rp.permission_id
  JOIN permissions np ON np.code = 'FEEDBACK360:VIEW'
 WHERE op.code IN ('EVALUATION:VIEW', 'COMPANY:UPDATE')
   AND (r.rank IS NOT NULL AND r.rank <= 1 OR op.code = 'COMPANY:UPDATE')
ON CONFLICT DO NOTHING;
