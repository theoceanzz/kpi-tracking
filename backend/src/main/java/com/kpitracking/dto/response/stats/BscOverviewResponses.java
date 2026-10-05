package com.kpitracking.dto.response.stats;

import com.kpitracking.enums.BscScorecardLevel;
import com.kpitracking.enums.BscScorecardStatus;
import com.kpitracking.enums.BscScoringMode;
import com.kpitracking.enums.BscUnitResultStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Số liệu tổng quan BSC cho tab "Hạng mục BSC" ở Thống kê — dựng trên mô hình THẺ ĐIỂM (cây
 * Công ty → Đơn vị, kết quả đợt, phân rã, hạng mục chặn), không phải trên điểm đánh giá cá nhân.
 *
 * <p>Mọi con số ở đây đọc từ {@code bsc_unit_results} ĐÃ TÍNH (recompute/finalize ở màn Quản lý
 * BSC), không tính lại: người quản lý nhìn thấy đúng con số họ đã chốt.
 */
public final class BscOverviewResponses {
    private BscOverviewResponses() {}

    /** Một lĩnh vực cố định (4 trục BSC), tên/màu theo bản của tổ chức. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PerspectiveRef {
        private String code;
        private String name;
        private String color;
    }

    /** Đếm độ phủ phân rã của các chỉ tiêu thẻ điểm gốc. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CoverageCounts {
        private int total;
        private int notCascaded;
        private int under;
        private int ok;
        private int over;
    }

    /** Thẻ số liệu đầu tab: sức khoẻ BSC của một đợt. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class OverviewResponse {
        private UUID periodId;
        private String periodName;
        /** Thẻ điểm gốc của phạm vi (công ty, hoặc thẻ của đơn vị được chọn). Null = chưa có thẻ nào cho đợt. */
        private UUID scorecardId;
        private String scorecardName;
        private String orgUnitName;
        private BscScorecardLevel level;
        private BscScorecardStatus status;
        private BscScoringMode scoringMode;
        /** %đạt của thẻ gốc trong đợt (null nếu chưa tính). */
        private Double achievementPercent;
        private BscUnitResultStatus resultStatus;
        private Boolean gatePassed;
        private String gateFailedItems;
        private int itemCount;
        /** Thẻ điểm đơn vị nằm dưới thẻ gốc (toàn cây con). */
        private int unitScorecardCount;
        private Map<String, Integer> unitStatusCounts;
        /** Chỉ đếm kết quả ĐÃ CHỐT — kết quả nháp nằm ở {@link #unitsProvisional}. */
        private int unitsWithResult;
        private int unitsGatePassed;
        private int unitsGateFailed;
        /**
         * Thẻ có cổng chặn nhưng chưa kết luận được (mọi hạng mục chặn đều chưa có %đạt).
         * Trước đây gộp vào "đạt", làm số đơn vị qua cổng cao hơn sự thật.
         */
        private int unitsGateUnknown;
        /** Thẻ đã có kết quả nhưng còn DRAFT — hiện riêng, không cộng vào số tổng hợp. */
        private int unitsProvisional;
        /** Kết quả của chính thẻ gốc còn là nháp (DRAFT) hay đã chốt. */
        private boolean provisional;
        private CoverageCounts coverage;
    }

    /** Một thẻ điểm trong cây (đã trải phẳng) kèm kết quả đợt. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UnitAttainmentRow {
        private UUID scorecardId;
        private String name;
        private String orgUnitName;
        private BscScorecardLevel level;
        private BscScorecardStatus status;
        /** 0 = thẻ gốc của phạm vi. */
        private int depth;
        private String parentScorecardName;
        private Double achievementPercent;
        private BscUnitResultStatus resultStatus;
        private Boolean gatePassed;
        private String gateFailedItems;
        private int itemCount;
        private int assignedCount;
        private int gateCount;
        private Double totalWeight;
        /** Kết quả đợt còn DRAFT — số liệu có thể đổi sau khi "Tính lại". */
        private boolean provisional;
    }

    /** Một chỉ tiêu của thẻ điểm với kết quả đợt — đủ để vẽ bullet thực tế / mục tiêu / sàn. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ItemRow {
        private UUID scorecardPerspectiveId;
        private String name;
        private String color;
        private String fixedPerspective;
        private String fixedPerspectiveName;
        private String fixedPerspectiveColor;
        private Double actualValue;
        private Double targetValue;
        private Double minimumValue;
        private String unit;
        private Double achievementPercent;
        private Double weightPercentage;
        private Double weightedScore;
        private Integer kpiCount;
        private boolean isGate;
        private Double gateMinPercent;
        private Boolean gatePassed;
        private String measurementSource;
        /** ASSIGNED = cấp trên giao xuống, SELF = đơn vị tự thêm. */
        private String origin;
        private String parentScorecardName;
        /** Đã có dòng kết quả cho đợt này chưa (false = chỉ có mục tiêu, chưa recompute). */
        private boolean hasResult;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ItemAttainmentResponse {
        private UUID scorecardId;
        private String scorecardName;
        private String orgUnitName;
        private UUID periodId;
        private String periodName;
        private Double achievementPercent;
        private Boolean gatePassed;
        private BscUnitResultStatus resultStatus;
        private List<ItemRow> items;
    }

    /** Khoá rổ "chưa phân loại lĩnh vực" trong {@link TrendPoint#byPerspective}. */
    public static final String UNCLASSIFIED = "UNCLASSIFIED";

    /** Một mốc đợt trên đường xu hướng %đạt. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class TrendPoint {
        private UUID periodId;
        private String label;
        private UUID scorecardId;
        private boolean hasResult;
        /** Kết quả đợt còn DRAFT — mốc này vẽ nhạt/đứt để không bị đọc như số đã chốt. */
        private boolean provisional;
        private Double achievementPercent;
        private Boolean gatePassed;
        /**
         * Mã lĩnh vực cố định → %đạt bình quân theo trọng số của các chỉ tiêu thuộc lĩnh vực đó.
         * Chỉ tiêu không gắn lĩnh vực nào nằm ở khoá {@link #UNCLASSIFIED} — bỏ hẳn chúng đi thì
         * tổng các lĩnh vực không bao giờ khớp đường tổng.
         */
        private Map<String, Double> byPerspective;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class AttainmentTrendResponse {
        private List<PerspectiveRef> perspectives;
        private List<TrendPoint> points;
    }
}
