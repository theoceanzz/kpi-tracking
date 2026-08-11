package com.kpitracking.dto.response.admin;

import lombok.*;

import java.util.UUID;

/** Tiêu thụ token của một công ty trong một tháng — cho thống kê của quản trị nền tảng. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class OrgTokenUsageResponse {

    private UUID organizationId;
    private String organizationName;
    private String organizationCode;

    /** Ngân sách/tháng đã cấp. 0 nghĩa là chưa cấp. */
    private Long monthlyLimit;

    private Long usedTokens;

    /** Số lượt gọi AI trong tháng. */
    private Long requestCount;

    /** Phần trăm đã dùng so với ngân sách; null khi chưa cấp ngân sách. */
    private Double usagePercent;
}
