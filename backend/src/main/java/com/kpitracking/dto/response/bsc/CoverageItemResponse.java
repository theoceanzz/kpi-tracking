package com.kpitracking.dto.response.bsc;

import lombok.*;

import java.util.List;
import java.util.UUID;

/** Độ phủ của MỘT chỉ tiêu: tổng đóng góp của các đơn vị con so với mục tiêu của chính nó. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CoverageItemResponse {
    private UUID scorecardPerspectiveId;
    private UUID perspectiveId;
    private String name;
    private String color;
    private Double targetValue;
    private String unit;
    /** Tổng đóng góp của các dòng con loại SUM. SHARED/SUPPORT không tính vào (FR-016). */
    private Double cascadedValue;
    /** NOT_CASCADED | UNDER | OK | OVER */
    private String status;
    /** Thiếu bao nhiêu so với mục tiêu (âm = vượt). Null khi chỉ tiêu chưa đặt mục tiêu. */
    private Double gap;
    private List<CoverageChildResponse> children;
}
