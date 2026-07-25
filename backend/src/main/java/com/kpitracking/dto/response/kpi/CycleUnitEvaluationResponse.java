package com.kpitracking.dto.response.kpi;

import com.kpitracking.enums.CycleEvaluationMode;
import com.kpitracking.enums.CycleUnitEvalStatus;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Đánh giá tổng hợp của một PHÒNG BAN theo một KỲ, kèm danh sách thành viên. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CycleUnitEvaluationResponse {
    private UUID cycleId;
    private String cycleName;
    private UUID orgUnitId;
    private String orgUnitName;
    private CycleEvaluationMode mode;

    /** Điểm gộp toàn phòng (TB thành viên). */
    private Double selfScore;
    private Double managerScore;
    /** TB mức định tính (0..5) và TB xếp loại ma trận (1..5) của thành viên. */
    private Double qualScore;
    private Double matrixRating;
    private int memberCount;

    /** true khi các con số trên là snapshot lúc chốt, không phải tính lại. */
    private boolean fromSnapshot;

    /** Thông tin chốt (nếu đã lưu). */
    private CycleUnitEvalStatus status;
    private String comment;
    private String finalizedByName;
    private Instant finalizedAt;

    private List<CycleUserEvaluationResponse> members;
}
