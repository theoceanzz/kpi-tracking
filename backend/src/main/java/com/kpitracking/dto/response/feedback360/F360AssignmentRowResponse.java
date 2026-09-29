package com.kpitracking.dto.response.feedback360;

import com.kpitracking.enums.F360AssignmentStatus;
import com.kpitracking.enums.F360RaterSource;
import com.kpitracking.enums.F360Relationship;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** Một phiếu trong danh sách quản trị (chỉ HR có FEEDBACK360:MANAGE, và không bao giờ cho subject là chính mình). */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360AssignmentRowResponse {
    private UUID id;
    private UUID subjectId;
    private UUID raterId;
    private String raterName;
    private String raterEmail;
    private String raterAvatarUrl;
    private F360Relationship relationship;
    private F360RaterSource source;
    private F360AssignmentStatus status;
    private String declineReason;
    private Instant submittedAt;
    private Instant lastRemindedAt;
}
