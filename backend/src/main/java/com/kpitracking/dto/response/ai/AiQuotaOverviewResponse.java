package com.kpitracking.dto.response.ai;

import lombok.*;

/** Tổng quan phân bổ hạn mức của người đang đăng nhập. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AiQuotaOverviewResponse {

    /** Có được phép phân bổ không — quyết định việc hiện tab phân bổ. */
    private Boolean canAllocate;

    /** Quản lý cao nhất chia từ ngân sách công ty; cấp dưới chia từ hạn mức riêng. */
    private Boolean isTopManager;

    /** Công ty có cho phép quản lý cấp dưới tự phân bổ không. */
    private Boolean subDelegationEnabled;

    /** Ngân sách token/tháng của công ty do quản trị nền tảng cấp. */
    private Long companyMonthlyLimit;

    /** Túi mà người này được chia: ngân sách công ty, hoặc hạn mức riêng của họ. */
    private Long allocatablePool;

    private Long allocated;
    private Long remainingToAllocate;

    /**
     * Các vai trò có mặt trong phạm vi, để đổ vào ô lọc.
     * Trả kèm ở đây thay vì gọi endpoint /roles vì trưởng đơn vị không chắc có quyền ROLE:VIEW.
     */
    private String[] availableRoles;
}
