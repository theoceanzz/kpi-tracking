package com.kpitracking.dto.response.stats;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * DTO cho "Xếp loại đơn vị theo phân bố % xếp loại thành viên" (tab Phân cấp).
 * Gộp: phân bố hiện tại + xếp loại đơn vị (áp luật) + xu hướng %/mức qua các kỳ + xếp loại đơn vị con.
 */
public class UnitClassificationResponses {

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class OverviewResponse {
        private UUID orgUnitId;
        private String orgUnitName;
        /** Bộ mức thành viên (cao → thấp): name + color. */
        private List<LevelInfo> levels;
        private int totalMembers;       // tổng nhân sự subtree
        private int evaluatedMembers;   // số người có đánh giá ở kỳ hiện tại
        private String currentPeriodName;
        /** Phân bố người theo mức ở kỳ hiện tại. */
        private List<Bucket> distribution;
        /** Xếp loại của đơn vị (áp luật lên phân bố hiện tại); null nếu chưa có dữ liệu. */
        private Classification classification;
        /** Tên hồ sơ luật đang áp cho đơn vị này (kế thừa từ cha nếu có); null nếu dùng preset. */
        private String appliedProfileName;
        /** Xu hướng: mỗi kỳ 1 điểm, percents[levelName] = % người ở mức đó. */
        private List<TrendPoint> trend;
        /** Xếp loại nhanh của các đơn vị con trực tiếp (kỳ hiện tại). */
        private List<ChildClassification> children;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class LevelInfo {
        private String name;
        private String color;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Bucket {
        private String level;
        private String color;
        private int count;
        private double percent;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Classification {
        private String level;
        private String color;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class TrendPoint {
        private String periodName;
        /** levelName → % người ở mức đó trong kỳ. */
        private Map<String, Double> percents;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ChildClassification {
        private UUID orgUnitId;
        private String orgUnitName;
        private String classification; // null nếu chưa có đánh giá
        private String color;
        /** Tên hồ sơ luật đang áp cho đơn vị con này (kế thừa nếu có); null nếu dùng preset. */
        private String appliedProfileName;
        private int evaluatedMembers;
    }
}
