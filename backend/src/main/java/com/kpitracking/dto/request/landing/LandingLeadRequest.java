package com.kpitracking.dto.request.landing;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** Form "Đăng ký tư vấn" ở cuối trang giới thiệu. */
@Data
public class LandingLeadRequest {

    @NotBlank(message = "Vui lòng nhập họ tên")
    @Size(max = 120, message = "Họ tên tối đa 120 ký tự")
    private String fullName;

    @NotBlank(message = "Vui lòng nhập số điện thoại")
    @Pattern(regexp = "^(\\+84|0)[0-9\\s.-]{8,14}$", message = "Số điện thoại không hợp lệ")
    private String phone;

    @Email(message = "Email không hợp lệ")
    @Size(max = 160, message = "Email tối đa 160 ký tự")
    private String email;

    @Size(max = 200, message = "Tên công ty tối đa 200 ký tự")
    private String company;

    @Pattern(regexp = "^(<50|50-200|200-500|>500)?$", message = "Quy mô không hợp lệ")
    private String headcount;

    @Size(max = 1000, message = "Ghi chú tối đa 1000 ký tự")
    private String note;

    @Size(max = 60)
    private String source;

    /**
     * Bẫy bot (honeypot): ô này bị ẩn khỏi người thật bằng CSS, bot điền bừa thì có giá trị.
     * Có giá trị → trả về thành công giả để bot không dò ra, nhưng không lưu gì.
     */
    @Size(max = 200)
    private String website;
}
