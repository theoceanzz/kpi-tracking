package com.kpitracking.dto.request.reward;

import com.kpitracking.enums.CertificateOrientation;
import com.kpitracking.enums.CertificateTemplateStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Mẫu chứng nhận do tổ chức tự soạn.
 *
 * <p>Các trường chữ đều nhận chỗ giữ {@code {{ten}}}, {@code {{diem}}}, {@code {{lyDo}}},
 * {@code {{ngay}}}, {@code {{nguoiThuong}}}, {@code {{donVi}}}, {@code {{congTy}}} —
 * frontend thay lúc vẽ, backend lưu nguyên văn.
 */
@Data
public class CertificateTemplateRequest {

    @NotBlank(message = "Vui lòng đặt tên cho mẫu chứng nhận")
    @Size(max = 120, message = "Tên mẫu không được quá 120 ký tự")
    private String name;

    @NotBlank(message = "Vui lòng chọn kiểu thiết kế")
    @Size(max = 40)
    private String preset;

    private CertificateOrientation orientation;

    @Size(max = 120, message = "Dòng dẫn không được quá 120 ký tự")
    private String eyebrow;

    @NotBlank(message = "Vui lòng nhập tiêu đề chứng nhận")
    @Size(max = 160, message = "Tiêu đề không được quá 160 ký tự")
    private String title;

    @Size(max = 255, message = "Dòng phụ đề không được quá 255 ký tự")
    private String subtitle;

    private String body;

    @Size(max = 255, message = "Dòng chân trang không được quá 255 ký tự")
    private String footnote;

    @Size(max = 120)
    private String signerName;

    @Size(max = 120)
    private String signerTitle;

    private String signatureUrl;

    /** Để trống = dùng logo của tổ chức. */
    private String logoUrl;

    private String backgroundUrl;

    // Cùng ràng buộc với CHECK ở DB — bắt ở đây để người dùng nhận được câu tiếng Việt
    // thay vì lỗi ràng buộc của Postgres.
    @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "Màu nhấn phải ở dạng mã hex, ví dụ #C9A227")
    private String accentColor;

    @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "Màu chữ phải ở dạng mã hex, ví dụ #1F2937")
    private String inkColor;

    @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "Màu nền phải ở dạng mã hex, ví dụ #FFFBF2")
    private String surfaceColor;

    private Boolean showLogo;

    private Boolean showPoints;

    private Boolean showReason;

    private Boolean isDefault;

    private CertificateTemplateStatus status;

    private Integer displayOrder;
}
