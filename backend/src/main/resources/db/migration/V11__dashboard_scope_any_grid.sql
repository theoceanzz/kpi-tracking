-- V11 — Bố cục lưới kéo thả dùng chung cho trang chủ VÀ các tab Thống kê.
--
-- `scope` là "khu vực lưới nào", không chỉ là vai trò: trang chủ (DIRECTOR/HEAD/DEPUTY/STAFF) và
-- các tab Thống kê (ANALYTICS_*) dùng chung bảng user_dashboard_layouts. Không liệt kê giá trị
-- trong CHECK vì mỗi khu vực lưới mới sẽ lại cần migration, trong khi enum DashboardScope phía Java
-- đã chặn giá trị lạ ngay ở bước deserialize; ràng buộc ở đây chỉ chặn rác: đúng dạng
-- CHỮ_HOA_GẠCH_DƯỚI. Cột mảng layout có thêm `s` (cài đặt riêng của ô), server lưu nguyên văn.
--
-- Trước đây sửa thẳng V1 trên nhánh nghianv; tách ra vì V1/V2 đã đóng băng (15/09/2026). Mọi câu
-- idempotent: DB dev đã ở hình dạng này chạy lại không lỗi.

ALTER TABLE user_dashboard_layouts DROP CONSTRAINT IF EXISTS user_dashboard_layouts_scope_check;
ALTER TABLE user_dashboard_layouts ALTER COLUMN scope TYPE VARCHAR(40);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_dashboard_layouts_scope_format'
          AND conrelid = 'user_dashboard_layouts'::regclass
    ) THEN
        ALTER TABLE user_dashboard_layouts
            ADD CONSTRAINT user_dashboard_layouts_scope_format CHECK (scope ~ '^[A-Z][A-Z_]*$');
    END IF;
END $$;

COMMENT ON COLUMN user_dashboard_layouts.scope IS
    'Khu vực lưới sở hữu bố cục này: vai trò ở trang chủ (DIRECTOR/HEAD/DEPUTY/STAFF) hoặc một tab Thống kê (ANALYTICS_*). Giá trị hợp lệ do enum DashboardScope phía Java quyết định.';
