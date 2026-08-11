package com.kpitracking.dto.request.organization;

import com.kpitracking.enums.LarkConnectionMode;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UpdateLarkSettingsRequest {

    private LarkConnectionMode connectionMode;

    private String appId;

    /** Để trống nghĩa là giữ nguyên secret đang lưu, không phải xoá đi. */
    private String appSecret;

    private UUID defaultOrgUnitId;
    private UUID defaultRoleId;

    private Boolean larkEnabled;
}
