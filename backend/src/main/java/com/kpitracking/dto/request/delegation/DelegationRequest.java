package com.kpitracking.dto.request.delegation;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DelegationRequest {

    /** Người được nới quyền. */
    @NotNull(message = "Chọn người được uỷ quyền")
    private UUID delegateUserId;

    /** Đơn vị đích được quản lý. */
    @NotNull(message = "Chọn đơn vị được uỷ quyền quản lý")
    private UUID orgUnitId;

    /** Bỏ trống = suy ra từ đơn vị chính của người được uỷ quyền. */
    private UUID fromOrgUnitId;

    private Boolean includeSubtree;

    /** Cho phép ký thay vai trò trưởng đơn vị đích (chấm hạnh kiểm). */
    private Boolean canActAsLeader;

    private String reason;

    private Instant startsAt;

    /** Bỏ trống = không hết hạn. */
    private Instant expiresAt;
}
