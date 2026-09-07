package com.kpitracking.dto.response.bsc;

import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Diễn giải đầy đủ điểm của MỘT cá nhân, đúng thứ tự ba bước của mục 5.3 rồi mới tới chặn.
 *
 * <p>Đây là màn hình quyết định nhân viên có chấp nhận kết quả hay không, nên mọi con số trung
 * gian đều phải có mặt: điểm gốc, trần, %đạt của phòng và công ty, dải rơi vào, hệ số suy ra.
 * Hạng mục chặn nằm TÁCH RIÊNG vì nó không đụng vào điểm.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BscWaterfallResponse {
    private UUID evaluationId;
    private UUID userId;
    private String userName;
    private String orgUnitName;
    private UUID kpiPeriodId;
    private String kpiPeriodName;

    // B1
    private Double rawBscScore;
    private Double recognizedCapPercent;
    private Double cappedScore;

    // B2 — phòng
    private Double unitAchievementPercent;
    private String unitBandLabel;
    private Double unitFactor;
    // B2 — công ty
    private Double companyAchievementPercent;
    private String companyBandLabel;
    private Double companyFactor;

    // B3
    private Double recognizedScore;

    // Ghi đè thủ công (QĐ-6)
    private Double overrideScore;
    private String overrideReasonCode;
    private String overrideComment;
    private String overriddenByName;
    private Instant overriddenAt;

    /** Điểm cuối = overrideScore ?? recognizedScore. */
    private Double finalScore;

    // Hạng mục chặn (QĐ-7) — KHÔNG tác động vào điểm ở trên
    private Boolean gatePassed;
    private Integer gateCapRating;
    private String gateFailedItems;
    private Integer matrixRating;

    /** Breakdown từng hạng mục, kèm kết quả chặn của từng dòng. */
    private List<PerspectiveScoreResponse> perspectives;

    /**
     * Chính sách xử lý hạng mục KHÔNG có KPI nào. Quyết định toàn bộ độ lớn của điểm gốc nên
     * màn hình diễn giải phải nói ra: RENORMALIZE loại hạng mục rỗng khỏi cả tử lẫn mẫu (một
     * hạng mục đạt 150% mà ba hạng mục kia rỗng ⇒ điểm vẫn là 150), ZERO_FILL tính chúng bằng 0.
     */
    private com.kpitracking.enums.BscEmptyPerspectivePolicy emptyPerspectivePolicy;

    /** Tỉ lệ trọng số KPI liên kết BSC (QĐ-8) và ngưỡng tối thiểu. */
    private Double linkedWeightPercent;
    private Double linkedWeightRequired;
    private Boolean linkedWeightSatisfied;
}
