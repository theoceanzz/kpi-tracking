-- Cho phép tắt tên công ty ở đầu chứng nhận: nhiều tổ chức dùng logo đã có sẵn tên
-- công ty, in thêm dòng tên nữa thành lặp chữ.
ALTER TABLE reward_certificate_templates
    ADD COLUMN IF NOT EXISTS show_org_name BOOLEAN NOT NULL DEFAULT TRUE;
