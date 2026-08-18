-- ============================================================================
-- KHO QUÀ eVOUCHER URBOX — đổi điểm thưởng lấy voucher thật
--
-- Quản trị viên duyệt kho quà UrBox rồi NHẬP món mình muốn vào danh mục quà của
-- tổ chức. Mỗi món nhập về là một dòng reward_gift_items bình thường
-- (type = 'EXTERNAL_VOUCHER', external_provider = 'URBOX'), nên toàn bộ luồng
-- cửa hàng / trừ điểm / hoàn điểm sẵn có dùng lại nguyên vẹn.
--
-- KHÔNG đồng bộ cả kho quà UrBox vào DB: giftset của họ hơn 1.000 món và đổi
-- liên tục. Chỉ chụp lại đúng những gì cần để HIỂN THỊ (tên, ảnh, mệnh giá, điều
-- kiện sử dụng) tại thời điểm nhập; giá và điều kiện thật luôn được UrBox chốt
-- lại lúc đặt đơn.
--
-- VÌ SAO CHỤP LẠI ĐIỀU KIỆN SỬ DỤNG: UrBox quy định phải hiện tên quà, mệnh giá
-- và điều kiện sử dụng TRƯỚC khi người dùng bấm đổi. Gọi API UrBox ngay trên
-- màn hình cửa hàng của nhân viên sẽ biến mọi lượt xem thành một request ra
-- ngoài — UrBox khuyến nghị đọc kho quà 1 lần/ngày.
--
-- LƯU Ý: spring.jpa.hibernate.ddl-auto=update tự thêm cột còn thiếu nhưng KHÔNG
-- sửa ràng buộc CHECK và KHÔNG tạo partial unique index. Mọi bảo đảm đúng đắn ở
-- dưới chỉ tồn tại nếu file này chạy.
-- ============================================================================


-- ── Thông tin quà ngoài, chụp lại lúc nhập ──────────────────────────────────
ALTER TABLE reward_gift_items
    -- Mệnh giá VNĐ bên UrBox. Giữ lại để quản trị viên đối chiếu "bao nhiêu điểm
    -- cho bao nhiêu tiền" và để gợi ý giá điểm theo tỉ giá của tổ chức.
    ADD COLUMN IF NOT EXISTS external_value        BIGINT,
    ADD COLUMN IF NOT EXISTS external_brand        VARCHAR(255),
    -- Điều kiện sử dụng (HTML của UrBox). BẮT BUỘC hiển thị trước khi đổi.
    ADD COLUMN IF NOT EXISTS external_terms        TEXT,
    -- Nguyên văn "Tối thiểu 30 ngày", "90 ngày"… Không parse thành ngày: đây là
    -- lời hứa của merchant, hạn thật chỉ có sau khi xuất code.
    ADD COLUMN IF NOT EXISTS external_expire_text  VARCHAR(255),
    -- QR code / Barcode 128 / Text — quyết định cách màn hình mã quà hiển thị.
    ADD COLUMN IF NOT EXISTS external_code_display VARCHAR(50),
    ADD COLUMN IF NOT EXISTS external_synced_at    TIMESTAMPTZ;

-- Một món quà UrBox chỉ được nhập MỘT lần cho mỗi tổ chức. Nhập trùng sẽ tạo hai
-- thẻ giống hệt nhau trong cửa hàng với hai giá điểm khác nhau — nhân viên không
-- có cách nào biết nên chọn cái nào.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_gift_items_external
    ON reward_gift_items(organization_id, external_provider, external_sku)
    WHERE deleted_at IS NULL AND external_provider IS NOT NULL;


-- ── Kết quả xuất quà từ hệ thống ngoài ──────────────────────────────────────
ALTER TABLE reward_redemptions
    -- Vì sao đơn hỏng, hiện nguyên văn cho người xử lý. Điểm đã được hoàn tự động
    -- nhưng người vận hành vẫn cần biết là do hết quà, sai cấu hình hay đứt mạng.
    ADD COLUMN IF NOT EXISTS fulfillment_error TEXT,
    ADD COLUMN IF NOT EXISTS fulfilled_at      TIMESTAMPTZ;

-- FAILED khác REJECTED: REJECTED là người quản lý từ chối, FAILED là hệ thống
-- ngoài không xuất được quà. Gộp chung sẽ khiến nhân viên đọc lịch sử tưởng công
-- ty từ chối mình, và người vận hành mất luôn con số "bao nhiêu đơn hỏng vì UrBox".
ALTER TABLE reward_redemptions DROP CONSTRAINT IF EXISTS reward_redemptions_status_check;
ALTER TABLE reward_redemptions ADD CONSTRAINT reward_redemptions_status_check
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'DELIVERED', 'CANCELLED', 'FAILED'));

-- Truy vết đơn theo mã UrBox khi đối soát. Chỉ index dòng thật sự có đơn ngoài.
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_external
    ON reward_redemptions(external_order_id)
    WHERE external_order_id IS NOT NULL;
