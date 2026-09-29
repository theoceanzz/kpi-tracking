package com.kpitracking.dto.request.landing;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** Form "Đăng ký tư vấn" ở cuối trang giới thiệu. */
@Data
public class LandingLeadRequest {

    @NotBlank(message = "{validation.enterFullName}")
    @Size(max = 120, message = "{validation.fullNameCanMost120Characters}")
    private String fullName;

    @NotBlank(message = "{validation.enterPhoneNumber}")
    @Pattern(regexp = "^(\\+84|0)[0-9\\s.-]{8,14}$", message = "{validation.invalidPhoneNumber}")
    private String phone;

    // Bắt buộc: tài khoản demo chỉ được gửi riêng qua email này
    @NotBlank(message = "{validation.enterEmailReceiveTrialAccount}")
    @Email(message = "{validation.invalidEmail}")
    @Size(max = 160, message = "{validation.emailCanMost160Characters}")
    private String email;

    @Size(max = 200, message = "{validation.companyNameCanMost200Characters}")
    private String company;

    @Pattern(regexp = "^(<50|50-200|200-500|>500)?$", message = "{validation.invalidCompanySize}")
    private String headcount;

    @Size(max = 1000, message = "{validation.notesCanMost1000Characters}")
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
