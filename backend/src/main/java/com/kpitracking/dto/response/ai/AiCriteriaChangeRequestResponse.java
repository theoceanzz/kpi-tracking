package com.kpitracking.dto.response.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/** Một đề nghị đổi quy chế chấm đang áp cho đơn vị (cấp dưới gửi, người đã áp / cấp trên quyết). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiCriteriaChangeRequestResponse {
    private UUID id;
    private UUID orgUnitId;
    private String orgUnitName;
    private UUID proposedSetId;
    private String proposedSetTitle;
    /** Tài liệu đang áp cho đơn vị (null = đơn vị hiện không áp tài liệu nào). */
    private UUID currentSetId;
    private String currentSetTitle;
    private String requestedByName;
    private String requestedByRole;
    private String approverName;
    private String note;
    private String status;
    private String decisionNote;
    private Instant createdAt;
}
