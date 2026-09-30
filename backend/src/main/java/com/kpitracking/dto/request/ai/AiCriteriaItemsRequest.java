package com.kpitracking.dto.request.ai;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/** Các dòng bộ tiêu chí sau khi người quản trị đối chiếu và sửa — thay toàn bộ dòng của bản nháp. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiCriteriaItemsRequest {

    /** Trần = số dòng máy bóc tối đa (CriteriaExtractor.MAX_ROWS 200) + chỗ cho dòng thêm tay. */
    @NotNull
    @Size(max = 300)
    @Valid
    private List<Item> items;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Item {
        @NotBlank
        @Size(max = 255)
        private String name;
        private String description;
        private BigDecimal weight;
        private String scaleLevels;
        private String scope;
        private String sourceExcerpt;
        /** Vai trò trong bộ nhóm của loại tài liệu — trống / lạ thì vai trò dự phòng của loại đó. */
        private String kind;
        private String section;
        private String topic;
        /** Người duyệt xác nhận dòng đúng dù đoạn gốc không khớp nguyên văn. */
        private Boolean reviewerConfirmed;
    }
}
