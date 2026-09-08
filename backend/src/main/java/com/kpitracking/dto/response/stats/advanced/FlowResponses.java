package com.kpitracking.dto.response.stats.advanced;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO cho nhóm biểu đồ LUỒNG (Sankey).
 *
 * <p>Shape khớp đúng thứ Recharts Sankey cần: một mảng nút và một mảng liên kết trỏ tới nút bằng
 * CHỈ SỐ trong mảng. Server dựng sẵn chỉ số để frontend không phải tự lập bản đồ tên đến vị trí —
 * việc đó rất dễ lệch khi có hai nút trùng tên ở hai tầng khác nhau.
 */
public class FlowResponses {

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SankeyResponse {
        private List<SankeyNode> nodes;
        private List<SankeyLink> links;
        /** Tiêu đề phụ mô tả đơn vị đo của độ dày dải (trọng số, số KPI...). */
        private String valueLabel;
        private Boolean empty;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SankeyNode {
        private String name;
        /** Tầng của nút, để frontend tô màu theo tầng. */
        private Integer depth;
        private String color;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SankeyLink {
        /** Chỉ số nút nguồn trong mảng nodes. */
        private Integer source;
        /** Chỉ số nút đích trong mảng nodes. */
        private Integer target;
        private Double value;
        /** Chú thích hiện trong tooltip (loại quan hệ, số KPI...). */
        private String note;
    }
}
