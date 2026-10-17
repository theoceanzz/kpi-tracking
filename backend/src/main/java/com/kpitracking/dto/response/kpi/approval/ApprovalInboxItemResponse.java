package com.kpitracking.dto.response.kpi.approval;

import com.kpitracking.enums.ApprovalSubjectType;
import lombok.*;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** Một việc trong hộp "Chờ tôi duyệt" chung — mọi loại đối tượng đi theo chuỗi duyệt. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ApprovalInboxItemResponse {
    private UUID flowId;
    private ApprovalSubjectType subjectType;
    private UUID subjectId;
    private String subjectName;
    private UUID orgUnitId;
    private String orgUnitName;
    private UUID requesterId;
    private String requesterName;
    private String processTitle;
    private Instant startedAt;
    /** Nội dung đề xuất (đánh giá, chốt kỳ) để người duyệt đọc ngay trong hộp. */
    private Map<String, Object> payload;
    /** Duyệt / từ chối được ngay trong hộp; {@code false} = mở màn riêng của đối tượng. */
    private boolean actionable;
    private ApprovalSummaryResponse approval;
}
