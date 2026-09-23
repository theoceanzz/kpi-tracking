-- Bước HIỆU CHỈNH trong đánh giá kỳ: DRAFT → CALIBRATING → FINALIZED.
--
-- Trước đây "Chốt đánh giá phòng ban" vừa chụp số vừa khoá: nhìn thấy bell curve lệch thì
-- đã không sửa được ai. Giờ tách làm hai nhịp — "chốt dữ liệu kỳ" đóng đầu vào (đợt, hạnh
-- kiểm) và chụp ĐIỂM NỀN của từng người, rồi quản lý chấm phòng, soi khung, hiệu chỉnh điểm
-- kỳ cá nhân theo đề xuất, cuối cùng mới "khoá kết quả".

-- Điểm nền chụp lúc chốt dữ liệu: để mọi lần hiệu chỉnh sau đó hiện được "92.5 → 89.5 (−3)".
ALTER TABLE cycle_user_evaluations ADD COLUMN IF NOT EXISTS baseline_score  DOUBLE PRECISION;
ALTER TABLE cycle_user_evaluations ADD COLUMN IF NOT EXISTS baseline_rating INT;
-- Xếp loại ma trận được ĐẶT TAY (hiệu chỉnh) thay vì suy từ hai trục — hiệu chỉnh ở chế độ
-- ma trận không có trục nào để kéo nên phải đặt thẳng hạng.
ALTER TABLE cycle_user_evaluations ADD COLUMN IF NOT EXISTS rating_overridden BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE cycle_unit_evaluations ADD COLUMN IF NOT EXISTS calibrated_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE cycle_unit_evaluations ADD COLUMN IF NOT EXISTS calibrated_at TIMESTAMPTZ;

COMMENT ON COLUMN cycle_unit_evaluations.status IS 'DRAFT | CALIBRATING | FINALIZED';
COMMENT ON COLUMN cycle_unit_eval_events.action IS 'CALIBRATE | FINALIZE | REOPEN';
COMMENT ON COLUMN cycle_user_evaluations.baseline_score IS
    'Điểm chốt kỳ tự tính (TB QLTT các đợt) chụp lúc chốt dữ liệu kỳ — mốc để so với điểm đã hiệu chỉnh.';
COMMENT ON COLUMN cycle_user_evaluations.baseline_rating IS
    'Xếp loại ma trận tạm tính chụp lúc chốt dữ liệu kỳ.';
