package com.kpitracking.dto.response.kpi.approval;

import com.kpitracking.enums.ApprovalOutcome;
import com.kpitracking.enums.ApprovalSubjectType;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Vị trí hiện tại của một đối tượng trong chuỗi duyệt, tính cho NGƯỜI ĐANG XEM: bảng danh sách
 * cần "Bước 2/3 · Trần B" và nút duyệt cần biết là "Duyệt cuối" hay "Duyệt và chuyển lên …".
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ApprovalSummaryResponse {
    private UUID flowId;
    private ApprovalSubjectType subjectType;
    private int round;
    private UUID stepId;
    /** Thứ tự của bước hiện tại trong các bước phải duyệt (bỏ qua bước SKIPPED_NO_HEAD). */
    private int stepNumber;
    private int totalSteps;
    private String currentUnitName;
    private List<UUID> holderIds;
    private List<String> holderNames;
    private Instant pendingSince;
    /** Người xem đang giữ bước hiện tại. */
    private boolean canAct;
    /** Chỉ có khi {@code canAct}: bấm duyệt sẽ chốt hay chuyển lên. */
    private ApprovalOutcome actionKind;
    /** Chỉ có khi {@code actionKind == FORWARDED}: người giữ bước kế tiếp. */
    private String nextHolderNames;
    private String nextUnitName;
    /** Người xem là admin tổ chức ⇒ được gán lại người duyệt (không được duyệt thay). */
    private boolean canReassign;
}
