package com.kpitracking.dto.response.kpi;

import com.kpitracking.enums.CycleUnitEvalStatus;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Trạng thái chốt đánh giá kỳ của MỘT đơn vị, dùng cho danh sách toàn tổ chức.
 *
 * <p>Khác {@link CycleUnitEvaluationResponse} ở chỗ KHÔNG kèm danh sách thành viên:
 * bảng theo dõi tiến độ chốt kỳ chỉ cần biết đơn vị nào xong, đơn vị nào chưa. Trả kèm
 * members sẽ biến một request thành hàng nghìn dòng dữ liệu không ai đọc.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CycleUnitStatusResponse {

    private UUID orgUnitId;
    private String orgUnitName;
    /** Thứ tự cấp trong cây tổ chức — để giao diện thụt lề theo phân cấp. */
    private Integer levelOrder;

    private CycleUnitEvalStatus status;
    private int memberCount;

    private Double managerScore;
    private Double qualScore;
    private Double matrixRating;

    private String finalizedByName;
    private Instant finalizedAt;
}
