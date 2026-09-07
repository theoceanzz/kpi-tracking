-- ====================================================
-- Luồng KPI cấu hình được
--
-- LƯU Ý: dự án dùng ddl-auto=update nên Hibernate cũng tự tạo được bảng/cột từ entity
-- (bảng kpi_adjustment_requests hiện có là ví dụ — nó không nằm trong V1). Vẫn khai báo tường
-- minh ở đây để lược đồ đọc được từ migration, và dùng IF NOT EXISTS để chạy được cả trên các
-- database dev mà Hibernate đã kịp tạo trước.
--
-- KHÔNG bao giờ sửa V1/V2: FlywayConfig gọi flyway.clean() khi validate() thất bại, nên sửa
-- migration cũ sẽ xoá sạch dữ liệu ở lần khởi động kế tiếp.
-- ====================================================

CREATE TABLE IF NOT EXISTS kpi_workflow_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    -- Cố ý KHÔNG đặt CHECK constraint theo enum lên cột này: xem report_widgets.widget_type để
    -- thấy cái giá của việc đó (enum Java + CHECK SQL + union TS phải sửa cùng lúc).
    definition      JSONB NOT NULL DEFAULT '{}'::jsonb,
    version         INT NOT NULL DEFAULT 1,
    updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ
);

-- Mỗi tổ chức nhiều nhất một cấu hình còn hiệu lực. Index từng phần để bản đã xoá mềm không chiếm chỗ.
CREATE UNIQUE INDEX IF NOT EXISTS ux_kpi_workflow_configs_org
    ON kpi_workflow_configs (organization_id) WHERE deleted_at IS NULL;

-- ====================================================
-- Memento cho yêu cầu điều chỉnh
--
-- Trước đây từ chối một yêu cầu điều chỉnh luôn đặt KPI về APPROVED cứng, nên trạng thái trước
-- khi vào EDIT bị mất. Cột này giữ lại trạng thái đó để trả về đúng chỗ cũ.
--
-- Bọc trong khối điều kiện vì bảng kpi_adjustment_requests KHÔNG nằm trong V1 — nó do Hibernate
-- tạo từ entity nhờ ddl-auto=update. Flyway chạy TRƯỚC Hibernate, nên trên một database sạch bảng
-- này chưa tồn tại ở thời điểm migration chạy. Trường hợp đó thì bỏ qua ở đây và để Hibernate tự
-- thêm cột từ mapping của entity; trên database đã có sẵn bảng thì cột được thêm ngay tại đây.
-- ====================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kpi_adjustment_requests') THEN
        ALTER TABLE kpi_adjustment_requests ADD COLUMN IF NOT EXISTS previous_kpi_status VARCHAR(32);
    END IF;
END $$;

-- ====================================================
-- Quyền cấu hình luồng KPI
-- ====================================================
INSERT INTO permissions (id, code, resource, action, description) VALUES
    ('00000000-0000-0000-0000-000000000501', 'WORKFLOW:MANAGE', 'WORKFLOW', 'MANAGE',
     'Cho phép bật/tắt các bước của luồng KPI, đổi luật duyệt và sắp xếp thứ tự hiển thị cho toàn tổ chức')
ON CONFLICT (code) DO NOTHING;

-- Gán theo thuộc tính vai trò thay vì liệt kê role_id, để đúng với mọi công ty đã có và công ty
-- thêm về sau. Cấu hình luồng là việc của người quản trị tổ chức, nên bám theo COMPANY:UPDATE.
INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, p.id
FROM role_permissions rp
JOIN permissions src ON src.id = rp.permission_id AND src.code = 'COMPANY:UPDATE'
CROSS JOIN permissions p
WHERE p.code = 'WORKFLOW:MANAGE'
ON CONFLICT DO NOTHING;

-- Không seed bản ghi kpi_workflow_configs nào: vắng bản ghi nghĩa là dùng luồng mặc định, vốn
-- tái hiện đúng hành vi hiện tại. Nhờ vậy triển khai bản này không đổi hành vi của tổ chức nào.
