package com.kpitracking.dto.response.conduct;

import com.kpitracking.enums.ConductScope;
import com.kpitracking.enums.ConductStatus;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Phiếu chấm hạnh kiểm của một người trong một đợt/kỳ.
 *
 * Phiếu chưa từng được chấm vẫn trả về đầy đủ dòng tiêu chí (dựng từ cấu hình, {@code id} null)
 * để UI mở ra là có bảng chấm ngay, không cần bước "tạo phiếu".
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ConductSheetResponse {
    private UUID id;
    private UUID userId;
    private String userName;
    private String userAvatarUrl;

    private ConductScope scope;
    private UUID kpiPeriodId;
    private UUID kpiCycleId;
    private String targetName;   // tên đợt/kỳ

    /** Bộ tiêu chí mà đợt/kỳ này dùng — hai kỳ khác bộ thì phiếu khác nhau, phải nói rõ. */
    private UUID criteriaSetId;
    private String criteriaSetName;

    private ConductStatus status;
    private Double maxScore;

    /** Σ(điểm tự chấm × trọng số) — "Điểm hành vi đã tính đến trọng số" phía CBNV. */
    private Double selfScore;
    /** Σ(điểm CBQLTT × trọng số). */
    private Double managerScore;

    private String comment;
    private String evaluatorName;
    private Instant selfSubmittedAt;
    private Instant evaluatedAt;

    /** Điểm dùng cho ma trận: ưu tiên điểm quản lý, chưa có thì lấy điểm tự chấm. */
    private Double effectiveScore;
    /** Điểm hạnh kiểm quy về thang hành vi 0..5 của ma trận. */
    private Double behaviorEquivalent;
    /** Điểm hạnh kiểm quy về % của trục cột ma trận. */
    private Double percentEquivalent;

    private List<ConductItemResponse> items;

    /**
     * Người đang xem có được sửa cột tự đánh giá / cột quản lý không.
     * Phiếu đã bị khoá thì cả hai đều false — điểm hạnh kiểm là đầu vào của kết quả kỳ.
     */
    private boolean canScoreSelf;
    private boolean canScoreManager;

    /** Kỳ chứa đợt/kỳ này đã chốt ở một đơn vị cấp trên hoặc chính đơn vị của nhân sự. */
    private boolean locked;
    private String lockedByUnitName;
}
