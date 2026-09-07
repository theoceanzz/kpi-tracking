package com.kpitracking.dto.response.bsc;

import lombok.*;

/** 1 trong 4 lĩnh vực BSC cố định — dùng cho FE hiển thị/chọn khi cấu hình hạng mục. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class FixedPerspectiveResponse {
    /** Mã enum (FINANCIAL, CUSTOMER, INTERNAL_PROCESS, LEARNING_GROWTH). */
    private String code;
    private String name;
    private String color;
    private int displayOrder;
}
