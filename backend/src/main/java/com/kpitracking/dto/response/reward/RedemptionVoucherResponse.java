package com.kpitracking.dto.response.reward;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Một mã quà đã xuất từ nhà cung cấp ngoài.
 *
 * <p>UrBox quy định sau khi đổi phải hiển thị: tên quà, mệnh giá, ảnh quà, mã code kèm
 * ảnh mã, PIN/serial nếu có, điều kiện sử dụng và hạn dùng. Mỗi trường ở đây là một mục
 * trong danh sách đó — bỏ bớt là vi phạm quy định hiển thị đã ký với UrBox và đẩy nhân
 * viên vào cảnh cầm mã ra cửa hàng mà không dùng được.
 *
 * <p>CHỈ trả cho chính người đã đổi. Màn hình quản trị không được thấy mã: ai cầm mã là
 * người tiêu được nó.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class RedemptionVoucherResponse {

    private String code;

    /** Mã kích hoạt. Có giá trị thì BẮT BUỘC hiển thị kèm {@link #code}. */
    private String pin;

    /** Số serial. Có giá trị thì BẮT BUỘC hiển thị kèm {@link #code}. */
    private String serial;

    /** Link trang quà của UrBox — nơi có đủ điều kiện sử dụng và hotline hỗ trợ. */
    private String link;

    /** Ảnh QR/Barcode do UrBox sinh sẵn. Dùng ảnh này thay vì tự vẽ mã. */
    private String codeImage;

    /** "QR code", "Barcode 128", "Text"… */
    private String codeDisplay;

    /** 1 QR, 2 Barcode, 3 vật lý, 4 text, 5 cả QR lẫn Barcode. */
    private Integer codeDisplayType;

    /** Hạn dùng nguyên văn của UrBox (dd/MM/yyyy). */
    private String expired;
}
