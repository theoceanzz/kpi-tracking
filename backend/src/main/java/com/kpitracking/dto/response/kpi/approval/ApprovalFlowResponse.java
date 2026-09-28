package com.kpitracking.dto.response.kpi.approval;

import com.kpitracking.enums.*;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Một lần gửi duyệt kèm đủ các bước (stepper) và lịch sử. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ApprovalFlowResponse {
    private UUID id;
    private ApprovalSubjectType subjectType;
    private UUID kpiCriteriaId;
    private UUID adjustmentRequestId;
    private int round;
    private ApprovalFlowStatus status;
    private UUID requesterId;
    private String requesterName;
    private Integer currentStepOrder;
    private Instant startedAt;
    private Instant finishedAt;
    private List<Step> steps;
    private List<Event> events;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Step {
        private UUID id;
        private int order;
        private ApprovalStepKind kind;
        private UUID orgUnitId;
        private String orgUnitName;
        private List<String> mergedUnitNames;
        private ApprovalStepStatus status;
        private String skipReason;
        private List<Person> approvers;
        private UUID actedById;
        private String actedByName;
        private Instant actedAt;
        private String reason;
        private Instant pendingSince;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Person {
        private UUID id;
        private String name;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Event {
        private UUID id;
        private ApprovalEventAction action;
        private Integer stepOrder;
        private UUID actorId;
        private String actorName;
        private String reason;
        private Map<String, Object> detail;
        private Instant createdAt;
    }
}
