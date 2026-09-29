package com.kpitracking.dto.response.feedback360;

import com.kpitracking.enums.F360AssignmentStatus;
import com.kpitracking.enums.F360Relationship;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** Một phiếu trong hộp "Cần đánh giá" của người chấm. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360TaskResponse {
    private UUID assignmentId;
    private UUID campaignId;
    private String campaignName;
    private Instant dueAt;
    private UUID subjectUserId;
    private String subjectName;
    private String subjectAvatarUrl;
    private F360Relationship relationship;
    private F360AssignmentStatus status;
    /** Phiếu này có được ẩn danh khi hiển thị cho người được đánh giá không. */
    private Boolean anonymous;
    private Instant submittedAt;
}
