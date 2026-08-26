-- Bỏ khối "Địa chỉ và liên hệ" khỏi hồ sơ doanh nghiệp.
-- Ba cột này vừa được thêm ở V7 để phục vụ một thẻ trên trang hồ sơ; thẻ đó bị gỡ khỏi
-- thiết kế nên cột cũng đi theo, không để lại cột chết mà không màn hình nào ghi vào.
-- Không sửa thẳng V7 vì V7 đã chạy trên máy đang phát triển — sửa file cũ là vỡ checksum.

ALTER TABLE organizations
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS contact_email;
