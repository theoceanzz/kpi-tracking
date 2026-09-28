package com.kpitracking.dto.response.feedback360;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** Một dòng nhật ký chiến dịch. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360EventResponse {
    private UUID id;
    private String action;
    private String actorName;
    private String subjectName;
    private String detail;
    private Instant createdAt;
}
