package com.kpitracking.dto.request.conduct;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.util.List;
import java.util.UUID;

/**
 * Tạo hoặc lưu MỘT bộ tiêu chí hạnh kiểm.
 *
 * Các trường để trống mang nghĩa "giữ nguyên" khi cập nhật, và "lấy mặc định" khi tạo mới —
 * nhờ vậy giao diện gửi đúng phần vừa sửa mà không cần gửi lại cả bộ.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ConductSetRequest {

    @NotBlank(message = "{validation.criteriaSetNameCannotEmpty}")
    private String name;

    /** Thang điểm mỗi tiêu chí của riêng bộ này. */
    @DecimalMin(value = "0.0", inclusive = false, message = "{validation.scaleMustGreaterThan0}")
    private Double maxScore;

    /**
     * Kỳ áp dụng bộ này. Rỗng = bộ không gán kỳ nào (chỉ bộ mặc định mới có tác dụng khi rỗng).
     * Một kỳ chỉ thuộc một bộ — gán lại cho bộ khác thì bộ cũ tự mất kỳ đó.
     */
    private List<UUID> kpiCycleIds;

    /** Danh sách tiêu chí thay THẾ toàn bộ bộ hiện có; tổng trọng số phải bằng 100%. */
    @Valid
    private List<ConductCriteriaRequest> criteria;
    /**
     * Bộ chia NHÓM: có phần tử thì thay thế toàn bộ bằng các nhóm này và bỏ qua {@code criteria}.
     * Gửi rỗng cùng {@code criteria} = chuyển về bộ không nhóm. Trọng số nhóm cộng 100%, trọng số
     * tiêu chí trong mỗi nhóm cộng 100%.
     */
    @Valid
    private List<ConductGroupRequest> groups;

    /**
     * Chỉ dùng khi TẠO: chép tiêu chí và thang điểm từ bộ này sang bộ mới. Bỏ trống thì chép
     * từ bộ mặc định — tạo bộ cho kỳ mới gần như luôn bắt đầu từ bộ đang dùng, không phải từ
     * một bảng trắng.
     */
    private UUID copyFromSetId;
}
