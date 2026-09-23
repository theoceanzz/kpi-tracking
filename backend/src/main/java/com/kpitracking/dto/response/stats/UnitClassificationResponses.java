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
        private int evaluatedMembers;   // số người có đánh giá ở đợt/kỳ đang xét
        /** Tên đợt gần nhất trong phạm vi — chỉ có khi xem theo ĐỢT. */
        private String currentPeriodName;
        /** Kỳ đang xét — chỉ có khi xem theo KỲ (phân bố lấy từ số chốt kỳ, không phải đợt gần nhất). */
        private UUID cycleId;
        private String cycleName;
        /** Phân bố người theo mức ở đợt/kỳ đang xét. */
        private List<Bucket> distribution;
        /** Xếp loại của đơn vị (áp luật lên phân bố hiện tại); null nếu chưa có dữ liệu. */
        private Classification classification;
        /**
         * Phân bố thực tế đặt cạnh khung bell curve của hồ sơ đang áp (đợt gần nhất có đánh giá, hoặc
         * cả kỳ). {@code configured=false} khi hồ sơ chưa bật khung — vẫn có {@code buckets} để vẽ
         * phân bố. Null khi chưa có đợt nào để xét.
         */
        private CycleCurveResponse bellCurve;
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

    /**
     * Một mức trên biểu đồ bell curve của kỳ: số THỰC TẾ của đơn vị đặt cạnh hạn mức đã cấu hình.
     * Các trường {@code target*}/{@code min*}/{@code max*} là null khi đơn vị không áp khung nào.
     */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CurveBucket {
        private String level;
        private String color;
        private int count;
        private double percent;      // % trên TỔNG nhân sự (cùng mẫu số với hạn mức)
        private Double targetPercent;
        private Double minPercent;
        private Double maxPercent;
        private Integer minCount;
        private Integer maxCount;
        private boolean over;        // vượt trần
        private boolean under;       // dưới sàn
    }

    /**
     * Phân bố mức của một đơn vị trong KỲ, đối chiếu khung bell curve đang áp — dữ liệu vẽ biểu
     * đồ ngay trên màn đánh giá kỳ để người chấm thấy phòng mình đang lệch chỗ nào.
     */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CycleCurveResponse {
        /** false = hồ sơ của đơn vị không bật khung; biểu đồ chỉ còn phân bố thực tế. */
        private boolean configured;
        private String profileName;
        /** warn | block — chế độ khi chấm vượt trần ở đánh giá đợt. */
        private String mode;
        private double tolerance;
        private int headcount;       // tổng nhân sự (mẫu số của hạn mức)
        private int evaluated;       // số người đã có điểm kỳ
        private List<CurveBucket> buckets;  // cao → thấp
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
