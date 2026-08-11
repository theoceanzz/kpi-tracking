package com.kpitracking.dto.response.admin;

import lombok.*;

import java.util.UUID;

/** Tiêu thụ token AI của một công ty trong một tháng — cho màn thống kê của quản trị nền tảng. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class OrgAiUsageResponse {

    private UUID organizationId;
    private String organizationName;
    private String organizationCode;

    /** Ngân sách token/tháng đã cấp. */
    private Long monthlyLimit;

    /** Đã tiêu trong tháng được hỏi. */
    private Long usedTokens;

    /** Số lượt gọi AI trong tháng. */
    private Long callCount;

    /** Phần trăm đã dùng so với ngân sách. Null khi chưa cấp ngân sách. */
    private Double usagePercent;
}
