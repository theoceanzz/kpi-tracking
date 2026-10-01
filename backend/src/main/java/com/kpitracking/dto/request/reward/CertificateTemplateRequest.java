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

    @NotBlank(message = "{validation.nameCertificateTemplate}")
    @Size(max = 120, message = "{validation.templateNameCanMost120Characters}")
    private String name;

    @NotBlank(message = "{validation.chooseDesignStyle}")
    @Size(max = 40)
    private String preset;

    private CertificateOrientation orientation;

    @Size(max = 120, message = "{validation.leadLineCanMost120Characters}")
    private String eyebrow;

    @NotBlank(message = "{validation.enterCertificateTitle}")
    @Size(max = 160, message = "{validation.titleCanMost160Characters}")
    private String title;

    @Size(max = 255, message = "{validation.subtitleLineCanMost255Characters}")
    private String subtitle;

    private String body;

    @Size(max = 255, message = "{validation.footerLineCanMost255Characters}")
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
    @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "{validation.accentColorMustHexCodeExampleC9a227}")
    private String accentColor;

    @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "{validation.textColorMustHexCodeExample1f2937}")
    private String inkColor;

    @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "{validation.backgroundColorMustHexCodeExampleFffbf2}")
    private String surfaceColor;

    private Boolean showLogo;

    private Boolean showOrgName;

    private Boolean showPoints;

    private Boolean showReason;

    private Boolean isDefault;

    private CertificateTemplateStatus status;

    private Integer displayOrder;
}
