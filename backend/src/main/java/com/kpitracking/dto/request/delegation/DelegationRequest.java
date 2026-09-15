package com.kpitracking.dto.request.delegation;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DelegationRequest {

    /** Người được nới quyền. */
    @NotNull(message = "Chọn người được uỷ quyền")
    private UUID delegateUserId;

    /**
     * Các đơn vị đích được giao quản lý. Nhận danh sách vì một người thường được giao vài
     * đơn vị cùng lúc (sáp nhập tạm, kiêm nhiệm lúc ai đó đi vắng) — gửi từng cái một thì
     * hỏng giữa chừng sẽ để lại một nửa số uỷ quyền đã tạo.
     */
    @NotEmpty(message = "Chọn ít nhất một đơn vị được uỷ quyền quản lý")
    private List<UUID> orgUnitIds;

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
