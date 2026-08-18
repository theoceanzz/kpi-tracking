-- ============================================================================
-- ĐIỂM DANH HÀNG NGÀY (Daily check-in) — nhân viên tự bấm nhận điểm mỗi ngày
--
-- Quản trị viên cấu hình ở tab "Điểm danh" trong Quản lý thưởng điểm: bật/tắt,
-- số điểm mỗi ngày, chu kỳ chuỗi và các mốc thưởng chuỗi.
--
-- QUAN HỆ VỚI SỔ CÁI: một chiều. Mỗi lần điểm danh ghi ĐÚNG MỘT bút toán EARN qua
-- RewardWalletService.applyTransaction với source_type = 'CHECKIN' và khoá chống
-- ghi trùng checkin:{userId}:{date}. Không bảng nào ở đây được sổ cái đọc ngược lại.
--
-- BẢNG reward_checkins LÀ BẢNG CHỈ GHI THÊM, giống reward_transactions: không
-- updated_at, không deleted_at. Điểm danh nhầm thì ghi bút toán bù trừ ở sổ cái,
-- không sửa hay xoá dòng đã ghi — nếu xoá thì chuỗi của những ngày sau đó tính lại
-- ra kết quả khác với số điểm đã thực sự phát.
--
-- LƯU Ý: spring.jpa.hibernate.ddl-auto=update tự tạo cột còn thiếu nhưng KHÔNG tạo
-- CHECK / partial unique index. Mọi bảo đảm đúng đắn (chống điểm danh hai lần trong
-- ngày, chống cấu hình 0 điểm) chỉ tồn tại nếu file này viết ra.
-- ============================================================================


-- ── Mở rộng CHECK của sổ cái cho nguồn mới ──────────────────────────────────
-- Phải làm TRƯỚC khi có dòng nào ghi bằng nguồn 'CHECKIN', nếu không mọi lần
-- điểm danh đầu tiên đều bị PostgreSQL từ chối ở tầng ràng buộc.
--
-- Tìm ràng buộc theo NỘI DUNG chứ không theo tên. Ràng buộc cũ khai inline ở V1 nên
-- tên do PostgreSQL tự sinh; nếu đoán tên mà đoán trượt thì DROP lặng lẽ không làm gì,
-- ADD vẫn thành công với tên còn trống, và ràng buộc cũ vẫn ở đó tiếp tục chặn
-- 'CHECKIN' — hỏng mà migration vẫn báo xanh.
DO $$
DECLARE c RECORD;
BEGIN
    FOR c IN
        SELECT conname FROM pg_constraint
         WHERE conrelid = 'reward_transactions'::regclass
           AND contype = 'c'
           AND pg_get_constraintdef(oid) LIKE '%MANUAL_GRANT%'
    LOOP
        EXECUTE format('ALTER TABLE reward_transactions DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

ALTER TABLE reward_transactions ADD CONSTRAINT reward_transactions_source_type_check
    CHECK (source_type IN ('MANUAL_GRANT', 'AUTO_RANKING', 'REDEMPTION', 'SYSTEM', 'EXTERNAL', 'CHECKIN'));


-- ── Cấu hình điểm danh cấp tổ chức ──────────────────────────────────────────
-- Mỗi tổ chức tối đa MỘT cấu hình. Mặc định TẮT để không tổ chức nào bỗng dưng
-- thấy nút lạ trên màn hình nhân viên, giống enable_reward và enable_cash_wallet.
CREATE TABLE IF NOT EXISTS reward_checkin_configs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    enabled             BOOLEAN NOT NULL DEFAULT FALSE,

    -- Điểm cơ bản nhận được mỗi lần điểm danh, chưa tính thưởng chuỗi.
    points_per_day      INT     NOT NULL DEFAULT 10,

    -- Chuỗi đếm 1..streak_cycle_days rồi quay về 1, nên các mốc thưởng lặp lại theo
    -- chu kỳ. NULL = chuỗi đếm thẳng không giới hạn (mốc chỉ trúng đúng một lần).
    streak_cycle_days   INT,

    -- T7/CN không tính vào chuỗi: nghỉ cuối tuần KHÔNG làm đứt chuỗi, và cũng không
    -- điểm danh được vào hai ngày đó. Đặt FALSE nếu tổ chức muốn điểm danh cả tuần.
    skip_weekends       BOOLEAN NOT NULL DEFAULT TRUE,

    -- [{"day":3,"points":20},{"day":7,"points":100}] — thưởng thêm khi chuỗi chạm
    -- đúng ngày đó. Mảng rỗng = chỉ có điểm cơ bản.
    streak_bonuses      JSONB   NOT NULL DEFAULT '[]',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,

    CONSTRAINT ck_reward_checkin_configs_points CHECK (points_per_day > 0),
    -- Chu kỳ 1 ngày là vô nghĩa (chuỗi luôn bằng 1, mốc nào cũng trúng mỗi ngày).
    CONSTRAINT ck_reward_checkin_configs_cycle
        CHECK (streak_cycle_days IS NULL OR (streak_cycle_days >= 2 AND streak_cycle_days <= 366))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_checkin_configs_org
    ON reward_checkin_configs(organization_id) WHERE deleted_at IS NULL;


-- ── Nhật ký điểm danh ───────────────────────────────────────────────────────
-- CHỈ GHI THÊM. Các cột streak_*/points_* là ẢNH CHỤP tại thời điểm điểm danh, cố ý
-- không suy lại lúc đọc: sếp đổi cấu hình hôm nay không được làm sai lịch sử điểm đã
-- phát hôm qua, và số hiện trên màn hình phải khớp với bút toán trong sổ cái.
CREATE TABLE IF NOT EXISTS reward_checkins (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checkin_date        DATE NOT NULL,

    -- Tổng số ngày liên tiếp đã điểm danh, đếm thẳng không reset theo chu kỳ.
    streak_length       INT  NOT NULL,
    -- Vị trí trong chu kỳ (1..streak_cycle_days). Bằng streak_length khi không đặt chu kỳ.
    streak_day          INT  NOT NULL,

    base_points         INT  NOT NULL,
    bonus_points        INT  NOT NULL DEFAULT 0,
    total_points        INT  NOT NULL,

    transaction_id      UUID REFERENCES reward_transactions(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_reward_checkins_points CHECK (total_points = base_points + bonus_points),
    CONSTRAINT ck_reward_checkins_streak CHECK (streak_length >= 1 AND streak_day >= 1)
);

-- Lớp bảo vệ CUỐI chống điểm danh hai lần trong một ngày. Khoá chống ghi trùng ở sổ
-- cái đã chặn phần lớn, nhưng ràng buộc này mới là thứ bảo đảm nhật ký không có hai
-- dòng cùng ngày khi hai request chạy song song khít nhau.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_checkins_user_date
    ON reward_checkins(organization_id, user_id, checkin_date);

-- Truy vấn nóng nhất: lần điểm danh gần nhất của một người, để tính chuỗi.
CREATE INDEX IF NOT EXISTS idx_reward_checkins_user_date
    ON reward_checkins(user_id, checkin_date DESC);
