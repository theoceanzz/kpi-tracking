package com.kpitracking.dto.response.urbox;

import lombok.Builder;
import lombok.Data;

/**
 * Tình trạng kết nối UrBox của bản triển khai.
 *
 * <p>Giao diện dùng để quyết định có hiện tab "Kho quà UrBox" hay không. Ẩn hẳn khi chưa
 * bật, thay vì hiện một tab lúc nào cũng báo lỗi kết nối.
 */
@Data
@Builder
public class UrboxStatusResponse {

    /** Đã bật và có đủ app_id / app_secret để đọc kho quà. */
    private Boolean enabled;

    /** Có thêm campaign_code — thiếu thì xem được kho quà nhưng không đặt được đơn. */
    private Boolean canOrder;

    /**
     * Đang trỏ môi trường thử của UrBox. Hiện rõ trên giao diện: quà đổi ở sandbox là
     * mã giả, để quản trị viên không tưởng mình vừa mua voucher thật.
     */
    private Boolean sandbox;

    /** Có ký đơn bằng private key không. PROD bắt buộc; sandbox thì không kiểm. */
    private Boolean signed;
}
