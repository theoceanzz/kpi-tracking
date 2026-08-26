-- Chứng nhận khen thưởng là một quyết định RIÊNG của người trao, không phải hệ quả tự
-- động của việc thưởng điểm.
--
-- Trước đây mọi lượt thưởng đã duyệt đều hiện ra thành một tờ giấy khen ở trang của nhân
-- viên. Nghĩa là thưởng 10 điểm vì "đi họp đúng giờ" cũng sinh ra tờ "CỐNG HIẾN XUẤT SẮC"
-- y hệt lượt thưởng 5.000 điểm cho một dự án lớn — giấy khen mất hết giá trị. Từ đây,
-- người trao phải chủ động tick "kèm chứng nhận" ngay lúc thưởng.

ALTER TABLE reward_grants
  -- Mặc định FALSE, áp cho cả dữ liệu cũ: những lượt thưởng trước đây được tạo mà người
  -- trao KHÔNG hề có ý định trao giấy khen, nên bật sẵn cho chúng là suy diễn hộ họ.
  ADD COLUMN certificate_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  -- NULL = "để hệ thống chọn mẫu mặc định của công ty lúc in". KHÔNG chốt cứng mẫu vào
  -- đây lúc thưởng: công ty đổi mẫu mặc định thì các lượt chưa in nên theo mẫu mới.
  --
  -- ON DELETE SET NULL chỉ là lưới an toàn cuối — mẫu bị xoá là xoá MỀM (deleted_at), FK
  -- không nổ, nên tầng hiển thị vẫn phải tự lùi về mẫu mặc định khi tra không ra mẫu.
  ADD COLUMN certificate_template_id UUID
      REFERENCES reward_certificate_templates(id) ON DELETE SET NULL;

-- Chọn mẫu mà quên bật cờ (hoặc ngược lại) là hai trạng thái vô nghĩa: một bên chỉ định
-- mẫu cho tờ giấy không tồn tại, một bên là rác dữ liệu gây nhầm khi đọc lại sau này.
ALTER TABLE reward_grants
  ADD CONSTRAINT ck_reward_grants_certificate
      CHECK (certificate_enabled OR certificate_template_id IS NULL);

-- Trang "Chứng nhận của tôi" lọc đúng theo hai điều kiện này.
CREATE INDEX idx_reward_grants_certificate
    ON reward_grants(organization_id, status)
    WHERE deleted_at IS NULL AND certificate_enabled;
