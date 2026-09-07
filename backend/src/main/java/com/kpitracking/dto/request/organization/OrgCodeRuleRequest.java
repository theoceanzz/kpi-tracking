package com.kpitracking.dto.request.organization;

import com.kpitracking.enums.CodeType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class OrgCodeRuleRequest {

    @NotNull(message = "Thiếu loại mã")
    private CodeType codeType;

    @Size(max = 100, message = "Mẫu mã tối đa 100 ký tự")
    private String pattern;

    private Boolean autoGenerate;

    private Boolean allowManualOverride;
}
