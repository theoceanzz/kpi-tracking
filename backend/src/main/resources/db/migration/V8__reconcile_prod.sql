-- ====================================================================================
-- V8: Hoà giải schema prod về đúng V1 (baseline 2026-09-15) + index cho quy mô lớn
--
-- VÌ SAO LÀ V8: flyway_schema_history trên prod còn các dòng version 3..7 từ thời chưa gộp
-- V3–V7 vào V1/V2 (commit 12cf4b) — file không còn nhưng dòng history còn. Đặt V3 thì Flyway
-- coi là "đã chạy" và bỏ qua (đã xảy ra 2026-09-15 16:32). Số mới phải > 7; các dòng cũ được bỏ
-- qua bằng spring.flyway.ignore-migration-patterns=*:missing.
--
-- BỐI CẢNH: từ lần deploy đầu tiên, prod chỉ được Flyway repair() checksum, còn schema tiến
-- hoá bằng Hibernate ddl-auto=update. Hibernate tạo bảng/cột theo cách của nó (VARCHAR(255)
-- thay vì TEXT, FK tên hash, CHECK enum tự sinh, không index) và không bao giờ tạo index /
-- CHECK / default viết trong V1. Kết quả: prod ≠ V1 ở 83 cột, ~20 index, ~20 constraint
-- (đối chiếu bằng pg_dump --schema-only, xem docs/DATABASE_SCALING.md "Lộ trình V3+").
--
-- File này chạy trên CẢ dev (DB sạch V1+V2 → phải là no-op) lẫn prod (bù phần lệch), nên mọi
-- câu đều idempotent: IF NOT EXISTS / IF EXISTS / kiểm tra pg_catalog trước khi ALTER.
--
-- CHẠY NGOÀI TRANSACTION (V8__reconcile_prod.sql.conf: executeInTransaction=false) vì
-- CREATE/DROP INDEX CONCURRENTLY không chạy được trong transaction. Hệ quả: nếu lỗi giữa
-- chừng, phần đã chạy không rollback — nhưng chạy lại là an toàn nhờ idempotent; index
-- INVALID do bị ngắt được dọn ở bước 0.
--
-- KHOÁ & THỜI GIAN (prod hiện tại nhỏ, ước tính < 1 phút; ở 10 triệu dòng notifications ~1–2 phút):
--   - ALTER COLUMN TYPE varchar(255) -> text: chỉ đổi catalog, không rewrite, ACCESS EXCLUSIVE vài ms.
--   - SET/DROP DEFAULT, DROP NOT NULL, RENAME CONSTRAINT: catalog-only, vài ms.
--   - SET NOT NULL: quét bảng (nhỏ), ACCESS EXCLUSIVE trong lúc quét.
--   - ADD CHECK ... NOT VALID rồi VALIDATE: VALIDATE chỉ giữ SHARE UPDATE EXCLUSIVE.
--   - CREATE/DROP INDEX CONCURRENTLY: không chặn đọc/ghi.
-- CÁCH CHẠY TRÊN PROD: từ máy dev qua SSH tunnel, TRƯỚC khi deploy app (để healthcheck không
--   giết container giữa lúc tạo index):
--   ./mvnw flyway:migrate -Dflyway.url=jdbc:postgresql://localhost:5433/kpitracking ...
-- ROLLBACK: file này chỉ thêm/nới/đổi tên, không xoá cột, không xoá dữ liệu. Lùi lại = drop
--   các index mới + DELETE FROM flyway_schema_history WHERE version = '8'. Ba constraint bị drop
--   (2 CHECK enum của Hibernate, 1 FK RESTRICT) có ghi câu tạo lại ở chỗ tương ứng.
-- KHÔNG LÀM: thu hẹp kiểu cột (prod varchar(255) nơi V1 là varchar(20/50/100)) — không rewrite
--   nhưng phải quét kiểm tra và có thể fail nếu dữ liệu dài hơn; để nguyên, không ảnh hưởng app.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 0. Dọn index INVALID (tàn dư của CREATE INDEX CONCURRENTLY bị ngắt) — nếu để lại,
--    "IF NOT EXISTS" bên dưới sẽ tưởng index đã có và bỏ qua.
-- ------------------------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT i.indexrelid::regclass AS idx FROM pg_index i
              JOIN pg_class c ON c.oid = i.indexrelid
             WHERE NOT i.indisvalid AND c.relnamespace = 'public'::regnamespace
    LOOP
        EXECUTE format('DROP INDEX %s', r.idx);
        RAISE NOTICE 'V8: đã bỏ index INVALID %', r.idx;
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------------
-- 1. Cột từng chỉ có ở entity (Hibernate tự thêm trên prod) — no-op trên prod, có tác dụng
--    nếu DB được dựng từ V1 cũ hơn.
-- ------------------------------------------------------------------------------------
ALTER TABLE kpi_criteria            ADD COLUMN IF NOT EXISTS expected_submissions INTEGER;
ALTER TABLE kpi_submissions         ADD COLUMN IF NOT EXISTS manager_score DOUBLE PRECISION;
ALTER TABLE org_units               ADD COLUMN IF NOT EXISTS province_id UUID;
ALTER TABLE kpi_adjustment_requests ADD COLUMN IF NOT EXISTS previous_kpi_status VARCHAR(32);

-- ------------------------------------------------------------------------------------
-- 2. Nới kiểu cột: prod varchar(255) → text như V1. Đây là lỗi tiềm ẩn thật trên prod:
--    địa chỉ, URL tệp đính kèm, secret Lark mã hoá, nhận xét dài > 255 ký tự sẽ bị từ chối ở
--    prod trong khi dev nhận được. varchar → text không rewrite bảng (catalog-only).
--    Chỉ nới (an toàn), không bao giờ thu hẹp.
-- ------------------------------------------------------------------------------------
DO $$
DECLARE
    t TEXT; c TEXT;
    widen TEXT[][] := ARRAY[
        ['conduct_criteria','name'], ['conduct_criteria_sets','name'],
        ['conduct_evaluation_items','criteria_name'],
        ['cycle_unit_eval_events','comment'],
        ['cycle_unit_evaluations','comment'], ['cycle_unit_evaluations','override_reason'],
        ['cycle_user_evaluations','comment'],
        ['evaluation_levels','color'], ['evaluation_levels','name'],
        ['kpi_cycles','description'],
        ['notification_email_digest_items','title'],
        ['org_units','address'], ['org_units','logo_url'], ['org_units','name'], ['org_units','path'],
        ['organizations','code'], ['organizations','lark_app_secret_enc'],
        ['organizations','lark_tenant_avatar_url'], ['organizations','lark_tenant_key_enc'],
        ['organizations','name'], ['organizations','status'],
        ['permissions','action'], ['permissions','code'], ['permissions','description'], ['permissions','resource'],
        ['policies','effect'], ['policy_conditions','type'],
        ['qualitative_levels','color'], ['qualitative_levels','name'],
        ['scopes','code'],
        ['submission_attachments','file_url'], ['submission_attachments','storage_key'],
        ['users','avatar_url'], ['users','lark_union_id_enc']
    ];
BEGIN
    FOR i IN 1 .. array_length(widen, 1) LOOP
        t := widen[i][1]; c := widen[i][2];
        IF EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = t AND column_name = c
                      AND data_type = 'character varying') THEN
            EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE TEXT', t, c);
            RAISE NOTICE 'V8: %.% varchar -> text', t, c;
        END IF;
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------------
-- 3. NOT NULL / DEFAULT / FK khác V1
-- ------------------------------------------------------------------------------------
-- conduct_evaluations.conduct_criteria_set_id: V1 cho phép NULL và FK ON DELETE SET NULL
-- (xoá bộ tiêu chí thì bản đánh giá còn, chỉ mất liên kết); prod đang NOT NULL + RESTRICT.
ALTER TABLE conduct_evaluations ALTER COLUMN conduct_criteria_set_id DROP NOT NULL;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint
                WHERE conname = 'conduct_evaluations_conduct_criteria_set_id_fkey'
                  AND pg_get_constraintdef(oid) LIKE '%ON DELETE RESTRICT%') THEN
        -- rollback: ALTER TABLE conduct_evaluations ADD CONSTRAINT conduct_evaluations_conduct_criteria_set_id_fkey
        --   FOREIGN KEY (conduct_criteria_set_id) REFERENCES conduct_criteria_sets(id) ON DELETE RESTRICT;
        ALTER TABLE conduct_evaluations DROP CONSTRAINT conduct_evaluations_conduct_criteria_set_id_fkey;
        ALTER TABLE conduct_evaluations ADD CONSTRAINT conduct_evaluations_conduct_criteria_set_id_fkey
            FOREIGN KEY (conduct_criteria_set_id) REFERENCES conduct_criteria_sets(id) ON DELETE SET NULL;
    END IF;
END $$;
ALTER TABLE conduct_evaluations ALTER COLUMN max_score SET DEFAULT 4;

-- kpi_adjustment_requests: bảng do Hibernate tạo — thiếu default, thiếu NOT NULL, FK tên hash,
-- CHECK enum tự sinh (PENDING/APPROVED/REJECTED) sẽ làm INSERT lỗi khi enum Java thêm giá trị.
ALTER TABLE kpi_adjustment_requests ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE kpi_adjustment_requests ALTER COLUMN status SET DEFAULT 'PENDING';
ALTER TABLE kpi_adjustment_requests ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE kpi_adjustment_requests ALTER COLUMN updated_at SET DEFAULT now();
UPDATE kpi_adjustment_requests SET is_deactivation_request = FALSE WHERE is_deactivation_request IS NULL;
ALTER TABLE kpi_adjustment_requests ALTER COLUMN is_deactivation_request SET DEFAULT FALSE;
ALTER TABLE kpi_adjustment_requests ALTER COLUMN is_deactivation_request SET NOT NULL;
-- rollback: ALTER TABLE kpi_adjustment_requests ADD CONSTRAINT kpi_adjustment_requests_status_check
--   CHECK (status IN ('PENDING','APPROVED','REJECTED'));
ALTER TABLE kpi_adjustment_requests DROP CONSTRAINT IF EXISTS kpi_adjustment_requests_status_check;
-- rollback: ALTER TABLE conduct_evaluations ADD CONSTRAINT conduct_evaluations_scope_check CHECK (scope IN ('PERIOD','CYCLE'));
ALTER TABLE conduct_evaluations DROP CONSTRAINT IF EXISTS conduct_evaluations_scope_check;

-- reward_certificate_templates: V1 có NOT NULL cho preset/title và 5 CHECK; prod thiếu.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM reward_certificate_templates WHERE preset IS NULL OR title IS NULL) THEN
        ALTER TABLE reward_certificate_templates ALTER COLUMN preset SET NOT NULL;
        ALTER TABLE reward_certificate_templates ALTER COLUMN title  SET NOT NULL;
    ELSE
        RAISE WARNING 'V8: reward_certificate_templates có dòng preset/title NULL — bỏ qua SET NOT NULL, cần sửa dữ liệu tay';
    END IF;
END $$;

-- ------------------------------------------------------------------------------------
-- 4. Đổi tên constraint Hibernate sinh (tên hash) về tên trong V1; bổ sung constraint thiếu.
--    Mỗi khối: nếu tên cũ tồn tại → RENAME; nếu chưa có tên mới → ADD.
-- ------------------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
    renames TEXT[][] := ARRAY[
        -- [bảng, tên cũ trên prod, tên mới theo V1]
        ['kpi_adjustment_requests', 'fk24or756ko9po8pd4g7cv79kqq', 'kpi_adjustment_requests_requester_id_fkey'],
        ['kpi_adjustment_requests', 'fkrq52ktc7l3dspqoebtplscwvr', 'kpi_adjustment_requests_reviewer_id_fkey'],
        ['kpi_adjustment_requests', 'fkt7i2ox25q3p60iu7wc4vl02uy', 'kpi_adjustment_requests_kpi_criteria_id_fkey'],
        ['org_units',               'fk5q4oggsa7189sd9omlb8mfbdg', 'org_units_province_id_fkey'],
        ['organizations',           'organizations_lark_default_org_unit_id_fkey', 'fk_org_lark_default_org_unit'],
        ['organizations',           'organizations_lark_default_role_id_fkey',     'fk_org_lark_default_role'],
        ['reward_transactions',     'reward_transactions_reversal_of_fkey', 'reward_transactions_reversal_of_transaction_id_fkey']
    ];
BEGIN
    FOR i IN 1 .. array_length(renames, 1) LOOP
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = renames[i][2])
           AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = renames[i][3]) THEN
            EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', renames[i][1], renames[i][2], renames[i][3]);
            RAISE NOTICE 'V8: rename constraint % -> %', renames[i][2], renames[i][3];
        END IF;
    END LOOP;

    -- Tên hash Hibernate có thể khác nếu prod được tạo ở thời điểm khác: quét mọi FK tên hash
    -- còn lại trên 2 bảng này và bỏ nếu đã có FK cùng định nghĩa với tên chuẩn.
    FOR r IN SELECT conrelid::regclass AS tbl, conname, pg_get_constraintdef(oid) AS def
               FROM pg_constraint
              WHERE conname ~ '^fk[0-9a-z]{20,}$'
                AND conrelid IN ('kpi_adjustment_requests'::regclass, 'org_units'::regclass)
    LOOP
        IF EXISTS (SELECT 1 FROM pg_constraint p2 WHERE p2.conrelid = r.tbl::regclass
                    AND p2.conname <> r.conname AND pg_get_constraintdef(p2.oid) = r.def) THEN
            EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
            RAISE NOTICE 'V8: bỏ FK hash trùng %', r.conname;
        END IF;
    END LOOP;
END $$;

-- FK thiếu hẳn (DB không qua Hibernate lâu, hoặc tên hash không khớp danh sách trên)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kpi_adjustment_requests_kpi_criteria_id_fkey') THEN
        ALTER TABLE kpi_adjustment_requests ADD CONSTRAINT kpi_adjustment_requests_kpi_criteria_id_fkey FOREIGN KEY (kpi_criteria_id) REFERENCES kpi_criteria(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kpi_adjustment_requests_requester_id_fkey') THEN
        ALTER TABLE kpi_adjustment_requests ADD CONSTRAINT kpi_adjustment_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kpi_adjustment_requests_reviewer_id_fkey') THEN
        ALTER TABLE kpi_adjustment_requests ADD CONSTRAINT kpi_adjustment_requests_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_units_province_id_fkey') THEN
        ALTER TABLE org_units ADD CONSTRAINT org_units_province_id_fkey FOREIGN KEY (province_id) REFERENCES provinces(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_org_lark_default_org_unit') THEN
        ALTER TABLE organizations ADD CONSTRAINT fk_org_lark_default_org_unit FOREIGN KEY (lark_default_org_unit_id) REFERENCES org_units(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_org_lark_default_role') THEN
        ALTER TABLE organizations ADD CONSTRAINT fk_org_lark_default_role FOREIGN KEY (lark_default_role_id) REFERENCES roles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reward_transactions_reversal_of_transaction_id_fkey') THEN
        ALTER TABLE reward_transactions ADD CONSTRAINT reward_transactions_reversal_of_transaction_id_fkey FOREIGN KEY (reversal_of_transaction_id) REFERENCES reward_transactions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- messages: Hibernate từng sinh UNIQUE tên hash trùng messages_conversation_id_msg_index_key
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT conname FROM pg_constraint
              WHERE conrelid = 'messages'::regclass AND contype = 'u'
                AND conname ~ '^uk[0-9a-z]{20,}$'
    LOOP
        EXECUTE format('ALTER TABLE messages DROP CONSTRAINT %I', r.conname);
        RAISE NOTICE 'V8: bỏ unique trùng % trên messages', r.conname;
    END LOOP;
END $$;

-- CHECK của reward_certificate_templates (V1 có, prod thiếu). NOT VALID + VALIDATE để không
-- giữ ACCESS EXCLUSIVE trong lúc quét; nếu dữ liệu vi phạm thì VALIDATE báo lỗi rõ ràng.
DO $$
DECLARE
    checks TEXT[][] := ARRAY[
        ['reward_certificate_templates_accent_color_check',  $c$CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9A-Fa-f]{6}$')$c$],
        ['reward_certificate_templates_ink_color_check',     $c$CHECK (ink_color IS NULL OR ink_color ~ '^#[0-9A-Fa-f]{6}$')$c$],
        ['reward_certificate_templates_surface_color_check', $c$CHECK (surface_color IS NULL OR surface_color ~ '^#[0-9A-Fa-f]{6}$')$c$],
        ['reward_certificate_templates_orientation_check',   $c$CHECK (orientation IN ('LANDSCAPE','PORTRAIT'))$c$],
        ['reward_certificate_templates_status_check',        $c$CHECK (status IN ('ACTIVE','INACTIVE'))$c$]
    ];
BEGIN
    FOR i IN 1 .. array_length(checks, 1) LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = checks[i][1]) THEN
            EXECUTE format('ALTER TABLE reward_certificate_templates ADD CONSTRAINT %I %s NOT VALID', checks[i][1], checks[i][2]);
            EXECUTE format('ALTER TABLE reward_certificate_templates VALIDATE CONSTRAINT %I', checks[i][1]);
        END IF;
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------------
-- 5. INDEX. Tất cả CONCURRENTLY (ngoài transaction — xem .conf).
-- 5a. Index prod có nhưng V1 đã bỏ (trùng UNIQUE hoặc vô dụng)
-- ------------------------------------------------------------------------------------
DROP INDEX CONCURRENTLY IF EXISTS idx_users_email;              -- trùng users_email_key
DROP INDEX CONCURRENTLY IF EXISTS idx_refresh_tokens_token;     -- trùng refresh_tokens_token_key
DROP INDEX CONCURRENTLY IF EXISTS idx_messages_conversation_id; -- được UNIQUE(conversation_id, msg_index) bao phủ
DROP INDEX CONCURRENTLY IF EXISTS idx_notifications_is_read;    -- selectivity thấp, thay bằng partial
DROP INDEX CONCURRENTLY IF EXISTS idx_submissions_deleted_at;   -- thay bằng partial idx_submissions_alive

-- 5b. Index prod có nhưng định nghĩa khác V1 → tạo bản đúng dưới tên tạm, bỏ bản cũ, đổi tên.
--     (Không DROP trước CREATE để không có khoảng trống mất index trên bảng đang chạy.)
CREATE INDEX CONCURRENTLY IF NOT EXISTS v3_tmp_idx_conduct_criteria_org ON conduct_criteria (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS v3_tmp_idx_conduct_criteria_set ON conduct_criteria (conduct_criteria_set_id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS v3_tmp_idx_conduct_eval_org     ON conduct_evaluations (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS v3_tmp_idx_conduct_eval_user    ON conduct_evaluations (user_id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS v3_tmp_idx_conduct_set_org      ON conduct_criteria_sets (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS v3_tmp_idx_notif_digest_pending ON notification_email_digest_items (user_id, created_at) WHERE sent_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS v3_tmp_idx_reward_cert_templates_org ON reward_certificate_templates (organization_id, status, display_order) WHERE deleted_at IS NULL;
-- UNIQUE theo lower(name): nếu prod đã có 2 mẫu cùng tên khác hoa/thường trong 1 org thì câu này
-- lỗi và index để lại INVALID → chạy lại V3 sau khi sửa dữ liệu (bước 0 dọn INVALID).
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS v3_tmp_uq_reward_cert_templates_name ON reward_certificate_templates (organization_id, LOWER(name)) WHERE deleted_at IS NULL;

DO $$
DECLARE
    pairs TEXT[][] := ARRAY[
        ['idx_conduct_criteria_org',        'USING btree (organization_id) WHERE (deleted_at IS NULL)'],
        ['idx_conduct_criteria_set',        'USING btree (conduct_criteria_set_id) WHERE (deleted_at IS NULL)'],
        ['idx_conduct_eval_org',            'USING btree (organization_id) WHERE (deleted_at IS NULL)'],
        ['idx_conduct_eval_user',           'USING btree (user_id) WHERE (deleted_at IS NULL)'],
        ['idx_conduct_set_org',             'USING btree (organization_id) WHERE (deleted_at IS NULL)'],
        ['idx_notif_digest_pending',        'USING btree (user_id, created_at) WHERE (sent_at IS NULL)'],
        ['idx_reward_cert_templates_org',   'USING btree (organization_id, status, display_order) WHERE (deleted_at IS NULL)'],
        ['uq_reward_cert_templates_name',   'USING btree (organization_id, lower((name)::text)) WHERE (deleted_at IS NULL)']
    ];
    cur TEXT; tmp TEXT;
BEGIN
    FOR i IN 1 .. array_length(pairs, 1) LOOP
        tmp := 'v3_tmp_' || pairs[i][1];
        SELECT indexdef INTO cur FROM pg_indexes WHERE schemaname = 'public' AND indexname = pairs[i][1];
        IF cur IS NULL THEN
            -- chưa có tên chuẩn: chỉ cần đổi tên bản tạm
            IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = tmp) THEN
                EXECUTE format('ALTER INDEX %I RENAME TO %I', tmp, pairs[i][1]);
            END IF;
        ELSIF position(pairs[i][2] IN cur) = 0 THEN
            -- có nhưng sai định nghĩa: bỏ bản cũ (đang trong DO → không CONCURRENTLY được;
            -- bảng nhỏ, DROP giữ lock vài ms), đổi tên bản tạm.
            EXECUTE format('DROP INDEX %I', pairs[i][1]);
            EXECUTE format('ALTER INDEX %I RENAME TO %I', tmp, pairs[i][1]);
            RAISE NOTICE 'V8: thay index % bằng định nghĩa V1', pairs[i][1];
        ELSE
            -- đã đúng (DB dev): bỏ bản tạm
            EXECUTE format('DROP INDEX IF EXISTS %I', tmp);
        END IF;
    END LOOP;
END $$;

-- 5c. Index mới cho quy mô lớn (docs/DATABASE_SCALING.md H1, H4, M1, C1)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_created    ON notifications (user_id, created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread     ON notifications (user_id) WHERE is_read = false;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_tokens_expires        ON refresh_tokens (expires_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_alive             ON kpi_submissions (kpi_criteria_id, submitted_by) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_submitter_created ON kpi_submissions (submitted_by, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kpi_adj_requester             ON kpi_adjustment_requests (requester_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kpi_adj_criteria              ON kpi_adjustment_requests (kpi_criteria_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kpi_adj_status_created        ON kpi_adjustment_requests (status, created_at);

-- ------------------------------------------------------------------------------------
-- 6. Autovacuum theo bảng cho bảng ghi/UPDATE nhiều (docs/DATABASE_SCALING.md M4). Catalog-only.
-- ------------------------------------------------------------------------------------
ALTER TABLE notifications       SET (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.01);
ALTER TABLE refresh_tokens      SET (autovacuum_vacuum_scale_factor = 0.02, autovacuum_vacuum_cost_delay = 2);
ALTER TABLE security_audit_logs SET (autovacuum_vacuum_scale_factor = 0.01, autovacuum_analyze_scale_factor = 0.005);
ALTER TABLE kpi_submissions     SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE topup_orders        SET (autovacuum_vacuum_scale_factor = 0.05);

-- ------------------------------------------------------------------------------------
-- 7. Tàn dư đợt audit (bảng theo dõi script ops chạy tay — không còn dùng khi có V3+)
-- ------------------------------------------------------------------------------------
DROP TABLE IF EXISTS db_ops_log;

-- ------------------------------------------------------------------------------------
-- 8. Tự kiểm tra: không được còn index INVALID
-- ------------------------------------------------------------------------------------
DO $$
DECLARE n INT;
BEGIN
    SELECT count(*) INTO n FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
     WHERE NOT i.indisvalid AND c.relnamespace = 'public'::regnamespace;
    IF n > 0 THEN
        RAISE EXCEPTION 'V8: còn % index INVALID — xem NOTICE phía trên, sửa dữ liệu rồi chạy lại', n;
    END IF;
END $$;
