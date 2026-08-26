package com.kpitracking.dto.request.organization;

import com.kpitracking.dto.request.auth.HierarchyLevelDTO;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.List;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UpdateOrganizationRequest {

    @Size(max = 255, message = "Organization name must not exceed 255 characters")
    private String name;

    @Size(max = 100, message = "Organization code must not exceed 100 characters")
    private String code;

    private String status;

    private List<HierarchyLevelDTO> hierarchyLevels;

    private Double evaluationMaxScore;
    private java.util.List<EvaluationLevelRequest> evaluationLevels;
    private java.util.List<QualitativeLevelRequest> qualitativeLevels;
    private String performanceMatrix;
    private String unitClassificationRules;

    private Integer kpiReminderPercentage;
    private Boolean enableOkr;
    private Boolean enableWaterfall;
    private Boolean enableQualitative;
    private Boolean enableBsc;
    private Boolean enableConduct;
    private Boolean enableReward;
    private Boolean enableCashWallet;

    // ===== Hồ sơ doanh nghiệp =====
    // Không có logoUrl/coverUrl ở đây: ảnh đi qua endpoint multipart riêng, client
    // không tự đặt URL được.

    @Size(max = 120, message = "Industry must not exceed 120 characters")
    private String industry;

    @Size(max = 50, message = "Tax code must not exceed 50 characters")
    private String taxCode;

    /**
     * Quy mô nhân sự. Cần phân biệt "không gửi khoá này" (cập nhật một phần — giữ nguyên)
     * với "gửi null" (người dùng xoá trắng ô — phải mất thật). Một Integer null không nói
     * được điều đó, nên setter tự ghi lại là khoá CÓ mặt trong JSON: Jackson chỉ gọi setter
     * khi khoá xuất hiện, kể cả khi giá trị là null.
     */
    @Min(value = 0, message = "Employee count must not be negative")
    @Setter(AccessLevel.NONE)
    private Integer employeeCount;

    @Getter(AccessLevel.NONE)
    @Setter(AccessLevel.NONE)
    private boolean employeeCountPresent;

    public void setEmployeeCount(Integer employeeCount) {
        this.employeeCount = employeeCount;
        this.employeeCountPresent = true;
    }

    public boolean isEmployeeCountPresent() {
        return employeeCountPresent;
    }

    @Size(max = 2000, message = "Description must not exceed 2000 characters")
    private String description;
}
