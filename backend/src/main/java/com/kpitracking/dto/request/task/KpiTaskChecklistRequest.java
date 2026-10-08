package com.kpitracking.dto.request.task;

import lombok.*;

/** Thêm / sửa một bước checklist. Trường null = không đổi. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiTaskChecklistRequest {

    private String title;
    private Boolean done;
    private Integer sortOrder;
}
