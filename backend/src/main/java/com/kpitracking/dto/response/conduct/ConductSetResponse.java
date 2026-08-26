package com.kpitracking.dto.response.conduct;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.util.List;
import java.util.UUID;

/** Một bộ tiêu chí hạnh kiểm kèm các kỳ đang áp dụng nó. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ConductSetResponse {
    private UUID id;
    private String name;
    /**
     * Bộ áp cho mọi kỳ chưa được gán bộ riêng.
     * {@code @JsonProperty} vì getter Lombok của {@code boolean isDefault} là {@code isDefault()},
     * Jackson sẽ cắt tiền tố "is" và đặt tên trường JSON thành "default" nếu không chỉ định.
     */
    @JsonProperty("isDefault")
    private boolean isDefault;
    /** Thang điểm mỗi tiêu chí của riêng bộ này. */
    private Double maxScore;
    /** Kỳ áp dụng — rỗng ở bộ mặc định nghĩa là "mọi kỳ còn lại". */
    private List<UUID> kpiCycleIds;
    /** Tổng trọng số hiện tại — UI cảnh báo khi khác 100. */
    private Double totalWeight;
    private List<ConductCriteriaResponse> criteria;
}
