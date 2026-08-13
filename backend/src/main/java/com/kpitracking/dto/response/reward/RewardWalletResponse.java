package com.kpitracking.dto.response.reward;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class RewardWalletResponse {

    private UUID id;
    private UUID userId;
    private String fullName;
    private String email;
    private String employeeCode;
    private String avatarUrl;

    private Integer balance;
    private Integer lifetimeEarned;
    private Integer lifetimeSpent;

    /**
     * Bật khi số dư âm — xảy ra khi thưởng bị thu hồi sau lúc người nhận đã tiêu điểm.
     * Giao diện hiện cảnh báo thay vì che giấu; số âm là dữ liệu thật, không phải lỗi.
     */
    private Boolean negative;
}
