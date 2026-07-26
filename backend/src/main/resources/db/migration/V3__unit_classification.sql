-- Luật xếp loại ĐƠN VỊ theo phân bố % xếp loại thành viên (tuỳ chỉnh theo org).
-- NULL ⇒ backend dùng preset mặc định theo enable_qualitative.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS unit_classification_rules jsonb;
