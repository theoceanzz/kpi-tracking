package com.kpitracking.dto.response.bsc;

import lombok.*;

import java.util.List;
import java.util.UUID;

/**
 * Dữ liệu bản đồ chiến lược: các viễn cảnh (lane), Objective trong từng viễn cảnh,
 * KeyResult + KPI dưới mỗi Objective, và các cạnh nhân-quả giữa Objective.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class StrategyMapResponse {
    private List<PerspectiveLane> perspectives;
    /** KPI gán trực tiếp viễn cảnh, KHÔNG qua OKR (nối thẳng từ viễn cảnh). */
    private List<KpiNode> directKpis;
    private List<RelationEdge> relations;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PerspectiveLane {
        private UUID perspectiveId;
        private String code;
        private String name;
        private String color;
        private Integer displayOrder;
        private List<ObjectiveNode> objectives;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ObjectiveNode {
        private UUID id;
        private String code;
        private String name;
        private List<KeyResultNode> keyResults;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class KeyResultNode {
        private UUID id;
        private String code;
        private String name;
        private List<KpiNode> kpis;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class KpiNode {
        private UUID id;
        private String name;
        /** true nếu viễn cảnh gán trực tiếp lệch với viễn cảnh của Objective cha (cảnh báo). */
        private boolean perspectiveMismatch;
        private UUID perspectiveId;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class RelationEdge {
        private UUID id;
        private UUID sourceObjectiveId;
        private UUID targetObjectiveId;
        private String label;
    }
}
