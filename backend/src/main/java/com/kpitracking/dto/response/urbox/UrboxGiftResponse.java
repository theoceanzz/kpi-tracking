package com.kpitracking.dto.response.urbox;

import lombok.Builder;
import lombok.Data;

/** Một món quà trong kho UrBox, đã lọc bớt cho màn hình chọn quà của quản trị viên. */
@Data
@Builder
public class UrboxGiftResponse {

    /** Mã quà UrBox — chính là {@code priceId} khi đặt đơn. */
    private String urboxGiftId;

    private String name;
    private String imageUrl;
    private String brandName;
    private String brandImageUrl;
    private String categoryName;

    /** Mệnh giá VNĐ. */
    private Long value;

    /** Nguyên văn "Tối thiểu 30 ngày" — không parse thành ngày. */
    private String expireText;

    /** QR code / Barcode 128 / Text. */
    private String codeDisplay;

    /** Mô tả quà (HTML của UrBox). */
    private String content;

    /** Điều kiện sử dụng (HTML) — bắt buộc hiển thị trước khi nhân viên đổi. */
    private String terms;

    /** UrBox còn hàng hay không. Hiện xám thay vì ẩn: quà hết hôm nay có thể về ngày mai. */
    private Boolean inStock;

    /**
     * Đã có trong danh mục quà của tổ chức chưa.
     *
     * <p>Tính ở backend để nút "Nhập" không mời quản trị viên làm một việc chắc chắn bị
     * chặn — mỗi món UrBox chỉ được nhập một lần cho mỗi tổ chức.
     */
    private Boolean imported;

    /**
     * Giá điểm gợi ý = mệnh giá chia tỉ giá quy đổi của tổ chức, làm tròn LÊN.
     *
     * <p>Làm tròn lên vì làm tròn xuống nghĩa là bán quà rẻ hơn số tiền thật đã bỏ ra.
     */
    private Integer suggestedPointCost;
}
