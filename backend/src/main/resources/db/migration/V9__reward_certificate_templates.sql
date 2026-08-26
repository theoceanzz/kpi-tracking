-- Mẫu chứng nhận khen thưởng của tổ chức.
--
-- Bản THIẾT KẾ (khung viền, hoa văn, cách xếp chữ) nằm ở frontend dưới dạng "preset";
-- bảng này chỉ lưu phần tổ chức tự đặt: chọn preset nào, viết lời gì, ký tên ai, màu
-- thương hiệu ra sao. Vẽ chứng nhận là việc của trình duyệt — nhồi cả layout xuống DB
-- thì mỗi lần chỉnh một khoảng cách lại phải chạy migration.
--
-- Vì vậy `preset` KHÔNG có CHECK liệt kê giá trị: danh mục thiết kế thuộc về frontend
-- và sẽ dài thêm theo thời gian. Frontend tự lùi về preset đầu tiên khi gặp khoá lạ.

CREATE TABLE reward_certificate_templates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    name              VARCHAR(120) NOT NULL,
    preset            VARCHAR(40)  NOT NULL,
    orientation       VARCHAR(10)  NOT NULL DEFAULT 'LANDSCAPE'
        CHECK (orientation IN ('LANDSCAPE', 'PORTRAIT')),

    -- ----- Nội dung in trên chứng nhận -----
    -- Đều cho phép chỗ giữ {{ten}}, {{diem}}, {{lyDo}}, {{ngay}}, {{nguoiThuong}},
    -- {{donVi}}, {{congTy}} — frontend thay lúc vẽ. Không thay ở backend: cùng một mẫu
    -- phải xem trước được với dữ liệu giả trước khi có lượt thưởng nào.
    eyebrow           VARCHAR(120),
    title             VARCHAR(160) NOT NULL,
    subtitle          VARCHAR(255),
    body              TEXT,
    footnote          VARCHAR(255),

    signer_name       VARCHAR(120),
    signer_title      VARCHAR(120),
    signature_url     TEXT,

    -- NULL = dùng logo của tổ chức. Cột riêng để phòng công ty muốn con dấu khác cho
    -- chứng nhận nội bộ, không bắt họ đổi logo chung.
    logo_url          TEXT,
    background_url    TEXT,

    -- NULL = giữ màu gốc của preset. Lưu rỗng thay vì chép màu preset xuống: sau này
    -- chỉnh lại bảng màu của preset thì mẫu chưa tuỳ biến được hưởng luôn.
    accent_color      VARCHAR(9) CHECK (accent_color  IS NULL OR accent_color  ~ '^#[0-9A-Fa-f]{6}$'),
    ink_color         VARCHAR(9) CHECK (ink_color     IS NULL OR ink_color     ~ '^#[0-9A-Fa-f]{6}$'),
    surface_color     VARCHAR(9) CHECK (surface_color IS NULL OR surface_color ~ '^#[0-9A-Fa-f]{6}$'),

    show_logo         BOOLEAN      NOT NULL DEFAULT TRUE,
    show_points       BOOLEAN      NOT NULL DEFAULT TRUE,
    show_reason       BOOLEAN      NOT NULL DEFAULT TRUE,

    -- Mẫu được chọn sẵn khi mở màn hình in. Ràng buộc "mỗi tổ chức nhiều nhất một mẫu"
    -- nằm ở unique index bên dưới.
    is_default        BOOLEAN      NOT NULL DEFAULT FALSE,

    status            VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    display_order     INT          NOT NULL DEFAULT 0,

    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ  DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_reward_cert_templates_org
    ON reward_certificate_templates(organization_id, status, display_order)
    WHERE deleted_at IS NULL;

-- Hai mẫu cùng nhận là "mặc định" thì màn hình in chọn cái nào là do thứ tự truy vấn —
-- người dùng thấy mẫu nhảy lung tung giữa các lần mở mà không hiểu vì sao.
CREATE UNIQUE INDEX uq_reward_cert_templates_default
    ON reward_certificate_templates(organization_id)
    WHERE deleted_at IS NULL AND is_default;

-- Trùng tên mẫu trong cùng tổ chức làm danh sách chọn thành một dãy chữ giống hệt nhau.
CREATE UNIQUE INDEX uq_reward_cert_templates_name
    ON reward_certificate_templates(organization_id, LOWER(name))
    WHERE deleted_at IS NULL;
