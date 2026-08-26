-- Hồ sơ doanh nghiệp: định danh mở rộng, liên hệ và nhận diện thương hiệu.
-- Trước đây trang "Thông tin công ty" chỉ có tên + mã, nên phần lớn màn hình là chỗ trống.
-- Tất cả đều NULL-able: tổ chức cũ không bị buộc phải khai lại thứ họ chưa từng nhập.

ALTER TABLE organizations
  ADD COLUMN logo_url       TEXT,
  ADD COLUMN cover_url      TEXT,
  -- Lĩnh vực hoạt động lưu dạng chuỗi tự do thay vì enum: danh mục ngành nghề thay đổi
  -- theo thị trường, đổi danh mục không nên kéo theo migration.
  ADD COLUMN industry       VARCHAR(120),
  ADD COLUMN tax_code       VARCHAR(50),
  ADD COLUMN employee_count INT,
  ADD COLUMN address        TEXT,
  ADD COLUMN phone          VARCHAR(50),
  ADD COLUMN contact_email  VARCHAR(255),
  ADD COLUMN description    TEXT;

ALTER TABLE organizations
  ADD CONSTRAINT ck_organizations_employee_count CHECK (employee_count IS NULL OR employee_count >= 0);
