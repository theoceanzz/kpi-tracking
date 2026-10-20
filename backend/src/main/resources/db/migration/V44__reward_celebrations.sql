-- Ăn mừng lượt thưởng / đổi quà (hiệu ứng + âm thanh ở frontend, xem RewardCelebrationService).
--
-- celebrated_at = lúc người nhận đã được "ăn mừng" lượt này (hộp chúc mừng đã hiện ở MỘT tab / máy nào đó).
-- NULL = chưa. Máy chủ là nguồn sự thật: mở app lần sau (kể cả máy khác) vẫn ăn mừng bù đúng một lần.
--
-- Ba bảng nguồn: người nhận trong đề nghị thưởng, người nhận trong lần phát của chương trình tự động,
-- và đơn đổi quà (ăn mừng khi được duyệt / giao bởi người khác).

ALTER TABLE reward_grant_items       ADD COLUMN IF NOT EXISTS celebrated_at TIMESTAMPTZ;
ALTER TABLE reward_program_run_items ADD COLUMN IF NOT EXISTS celebrated_at TIMESTAMPTZ;
ALTER TABLE reward_redemptions       ADD COLUMN IF NOT EXISTS celebrated_at TIMESTAMPTZ;

-- BẮT BUỘC: mọi dòng có từ trước coi như đã ăn mừng. Thiếu bước này thì ngày triển khai ai đăng nhập
-- cũng bị pháo hoa cho toàn bộ lịch sử thưởng của mình.
UPDATE reward_grant_items       SET celebrated_at = NOW() WHERE celebrated_at IS NULL;
UPDATE reward_program_run_items SET celebrated_at = NOW() WHERE celebrated_at IS NULL;
UPDATE reward_redemptions       SET celebrated_at = NOW() WHERE celebrated_at IS NULL;

-- Truy vấn "lượt chưa ăn mừng của tôi" chạy mỗi lần mở app: chỉ index phần còn chờ (rất ít dòng).
-- Ba bảng này nhỏ (không thuộc danh sách bảng lớn phải CONCURRENTLY).
CREATE INDEX IF NOT EXISTS idx_reward_grant_items_uncelebrated
    ON reward_grant_items (user_id) WHERE celebrated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reward_run_items_uncelebrated
    ON reward_program_run_items (user_id) WHERE celebrated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_uncelebrated
    ON reward_redemptions (user_id) WHERE celebrated_at IS NULL;
