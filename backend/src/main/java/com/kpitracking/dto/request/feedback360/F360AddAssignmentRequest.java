package com.kpitracking.dto.request.feedback360;

import com.kpitracking.enums.F360Relationship;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

/** HR thêm một người chấm cho một người được đánh giá. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360AddAssignmentRequest {
    @NotNull(message = "{validation.revieweeMissing}")
    private UUID subjectId;
    @NotNull(message = "{validation.raterMissing}")
    private UUID raterId;
    @NotNull(message = "{validation.relationshipMissing}")
    private F360Relationship relationship;
}
