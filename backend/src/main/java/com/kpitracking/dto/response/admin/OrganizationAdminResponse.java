package com.kpitracking.dto.response.admin;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class OrganizationAdminResponse {

    private UUID id;
    private String name;
    private String code;
    private String status;
    private Boolean enableAi;
    private Boolean enableOkr;
    private Boolean enableWaterfall;
    private Boolean enableQualitative;
    private Boolean enableBsc;
    private long userCount;
    /** Ngân sách token AI/tháng do quản trị nền tảng cấp cho công ty. */
    private Long aiMonthlyTokenLimit;
    private Instant createdAt;
    private Instant updatedAt;
}
