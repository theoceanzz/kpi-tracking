package com.kpitracking.dto.response.stats;

import com.kpitracking.enums.bsc.BscScorecardLevel;
import com.kpitracking.enums.bsc.BscUnitResultStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Đồ thị mục tiêu BSC — MỘT nguồn cho cả ba cách xem của BRD (bản đồ chiến lược, cây liên kết,
 * xương cá). BRD bắt ba view dùng chung một nguồn: một thay đổi ở BSC phải hiện ra ở cả ba.
 *
 * <p>Không có số nào tính ở đây. Mọi %đạt đọc từ {@code bsc_unit_results} đã tính, mọi tỉ lệ KPI
 * đi qua {@code AnalyticsKpiMetrics} → {@code KpiAchievementCalculator}.
 */
public final class BscGoalGraphResponses {

    private BscGoalGraphResponses() {}

    /** Trạng thái màu của một mục tiêu. Ngưỡng do server cấp (xem {@link Thresholds}), client không tự đặt. */
    public enum GoalStatus { GOOD, WARN, BEHIND, NO_DATA }

    /** Loại cạnh. Hiện chỉ có quan hệ phân rã/đóng góp — xem ghi chú ở {@link GraphEdge}. */
    public enum EdgeKind { CASCADE, CONTRIBUTION }

    /**
     * Ngưỡng màu, cấp từ server để chỉ còn MỘT bản.
     *
     * <p>BRD đòi ngưỡng đọc từ cấu hình chứ không hard-code. Hiện tổ chức chưa có chỗ đặt ngưỡng,
     * nên server phát đúng một bộ hằng; khi nào có cấu hình thì chỉ đổi ở đây, client không sửa.
     */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Thresholds {
        /** Từ mức này trở lên là "tốt". */
        private double good;
        /** Dưới mức này là "chậm"; ở giữa là "cảnh báo". */
        private double warn;
    }

    /** Một lĩnh vực (khía cạnh) BSC — tên/màu/thứ tự theo cấu hình của tổ chức. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class GraphPerspective {
        private String code;
        private String name;
        private String color;
        private int displayOrder;
        /** Tổng trọng số các chỉ tiêu thuộc lĩnh vực này trên thẻ gốc. */
        private Double weightPercentage;
        /** %đạt bình quân theo trọng số — cùng phép gộp với ô xu hướng. */
        private Double achievementPercent;
        private List<UUID> objectiveIds;
    }

    /** Xu hướng so với đợt liền trước. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class GoalTrend {
        /** Chênh lệch điểm phần trăm; null khi đợt trước chưa có kết quả. */
        private Double deltaPercent;
        /** UP · DOWN · FLAT · NEW */
        private String direction;
    }

    /** Một mục tiêu = một dòng chỉ tiêu trên thẻ điểm. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class GraphObjective {
        private UUID id;
        /**
         * Mã hiển thị kiểu "F1", "C2" — SUY RA từ chữ cái lĩnh vực + thứ tự, vì bảng chỉ tiêu
         * không có cột mã. Chỉ để đọc cho nhanh, không phải khoá.
         */
        private String derivedCode;
        private String name;
        private String perspectiveCode;
        private String perspectiveName;
        private String color;

        private UUID scorecardId;
        private String scorecardName;
        private String orgUnitName;
        private BscScorecardLevel level;

        /** Chỉ tiêu cha trên thẻ CẤP TRÊN (quan hệ phân rã), nếu có. */
        private UUID parentId;
        private String linkType;
        private Double contributionValue;
        private Double contributionPercent;

        private Double weightPercentage;
        private Double targetValue;
        private Double minimumValue;
        private String unit;
        private Double actualValue;
        private Double achievementPercent;
        private Double weightedScore;
        private String measurementSource;

        private boolean isGate;
        private Double gateMinPercent;
        private Boolean gatePassed;

        /** ASSIGNED = cấp trên giao xuống · SELF = đơn vị tự đặt. Đủ để gắn nhãn top-down/bottom-up. */
        private String origin;

        private boolean hasResult;
        /** Kết quả đợt còn DRAFT — số có thể đổi sau "Tính lại". */
        private boolean provisional;
        private GoalStatus status;
        private GoalTrend trend;

        private int kpiCount;
        /** Số đơn vị con nhận phân rã chỉ tiêu này. */
        private int childCount;
        /** OK · UNDER · OVER · NOT_CASCADED — lấy thẳng từ {@code BscTreeService.coverage}. */
        private String coverageStatus;
        private Double coverageGap;
        /** Còn cấp dưới chưa nạp — cây bung tới đâu gọi tới đó. */
        private boolean hasMoreChildren;
    }

    /**
     * Cạnh giữa hai mục tiêu.
     *
     * <p>CHỈ có quan hệ phân rã/đóng góp, vì mô hình dữ liệu chỉ có {@code parentItemId} +
     * {@code linkType} (SUM/SHARED/SUPPORT/CUSTOM) — đều là ngữ nghĩa cộng dồn. Không có cạnh
     * "nhân quả" giữa các lĩnh vực như bản đồ chiến lược kinh điển; muốn có thì phải thêm bảng
     * quan hệ nhiều-nhiều ở lõi BSC.
     */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class GraphEdge {
        private String id;
        private UUID sourceId;
        private UUID targetId;
        private EdgeKind kind;
        private String linkType;
        private Double contributionPercent;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class BscGoalGraphResponse {
        private UUID periodId;
        private String periodName;
        private UUID scorecardId;
        private String scorecardName;
        private String orgUnitName;
        private BscScorecardLevel level;
        private String scoringMode;
        private BscUnitResultStatus resultStatus;
        private boolean provisional;
        /** RENORMALIZE hay ZERO_FILL — để giao diện gọi đúng tên mẫu số. */
        private String emptyPerspectivePolicy;
        private Double achievementPercent;
        private Boolean gatePassed;
        private Thresholds thresholds;
        private List<GraphPerspective> perspectives;
        private List<GraphObjective> objectives;
        private List<GraphEdge> edges;
        /** Mục tiêu bị cắt bớt vì {@code limit} — nói ra để không ai tưởng đã thấy hết. */
        private int hiddenObjectiveCount;
        /** Đơn vị ngoài phạm vi quyền — đếm, KHÔNG gộp số liệu. */
        private int hiddenUnitCount;
    }

    /* ── Drill-down của một mục tiêu ──────────────────────────────────────── */

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ContributorUnit {
        private UUID orgUnitId;
        private String orgUnitName;
        private UUID scorecardId;
        private String scorecardName;
        private String linkType;
        private Double contributionValue;
        private Double contributionPercent;
        private Double targetValue;
        private Double achievementPercent;
        private Boolean gatePassed;
        private int kpiCount;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ContributorPerson {
        private UUID userId;
        private String fullName;
        private String avatarUrl;
        private String orgUnitName;
        private int kpiCount;
        /** Bình quân có trọng số %đạt các KPI của người này trong chỉ tiêu — qua lõi. */
        private Double attainmentPercent;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ContributorKpi {
        private UUID kpiId;
        private String name;
        private String kpiType;
        private String unit;
        private Double weight;
        private Double targetValue;
        private Double actualValue;
        /** null = KPI không tham gia tính điểm, hoặc định tính chưa chấm. */
        private Double attainmentPercent;
        private String assigneeNames;
        private String periodName;
        private String status;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class BscObjectiveContributorsResponse {
        private GraphObjective objective;
        private List<ContributorUnit> units;
        private List<ContributorPerson> people;
        private List<ContributorKpi> kpis;
        private int hiddenUnitCount;
        private int hiddenPersonCount;
    }
}
