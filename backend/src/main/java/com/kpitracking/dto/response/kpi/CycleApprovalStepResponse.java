package com.kpitracking.dto.response.kpi;

import com.kpitracking.enums.CycleUnitEvalStatus;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Một bước trong chuỗi duyệt đánh giá kỳ: đơn vị đang xem, rồi lần lượt các
 * đơn vị CHA lên tới gốc (Tổ → Chi nhánh → Công ty).
 * Quyền chốt/mở khoá được tính sẵn ở server cho người dùng hiện tại, để FE
 * chỉ việc render chứ không phải đoán lại luật.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CycleApprovalStepResponse {
    private UUID orgUnitId;
    private String orgUnitName;
    /** Nhãn người đứng đầu đơn vị, VD "Trưởng phòng", "Giám đốc". */
    private String managerRoleLabel;
    /** Độ sâu trong cây đơn vị (0 = gốc). */
    private Integer levelOrder;
    /** true với đơn vị đang được xem trên trang. */
    private boolean current;

    private CycleUnitEvalStatus status;
    private Double managerScore;
    private Double qualScore;
    private Double matrixRating;
    private Integer memberCount;

    private String finalizedByName;
    private String finalizedByRoleName;
    private Instant finalizedAt;
    private String comment;

    /** Tiến độ chốt của các đơn vị con trực tiếp (0/0 nếu là đơn vị lá). */
    private int childTotal;
    private int childFinalized;

    private boolean canFinalize;
    private boolean canReopen;
    /** Lý do bị chặn, hiện lên tooltip của nút. Null khi không bị chặn. */
    private String blockedReason;

    private List<CycleUnitEvalEventResponse> events;
}
