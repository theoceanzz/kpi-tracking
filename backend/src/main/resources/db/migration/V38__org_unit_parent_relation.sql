-- Quan hệ của đơn vị với đơn vị cha, CHỈ để vẽ sơ đồ cơ cấu (nét liền / nét đứt):
--   DIRECT      trực tuyến — cấp trên chỉ đạo trực tiếp (nét liền)
--   ADVISORY    tham mưu – tư vấn (nét đứt)
--   SUPERVISORY giám sát độc lập (nét đứt)
-- Chuỗi duyệt, quyền xem KPI, quyền theo path, phân rã BSC/OKR vẫn đi theo parent_id — không đọc cột này.
-- Mọi đơn vị đang có nhận DEFAULT 'DIRECT'. Không thêm dữ liệu mẫu (migration chạy cả prod).

ALTER TABLE org_units ADD COLUMN IF NOT EXISTS parent_relation VARCHAR(20) NOT NULL DEFAULT 'DIRECT';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_org_units_parent_relation') THEN
    ALTER TABLE org_units ADD CONSTRAINT chk_org_units_parent_relation
      CHECK (parent_relation IN ('DIRECT', 'ADVISORY', 'SUPERVISORY'));
  END IF;
END $$;
