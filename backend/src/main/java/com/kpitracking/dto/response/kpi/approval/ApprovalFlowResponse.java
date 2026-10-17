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
    private UUID subjectId;
    private String subjectName;
    private UUID kpiCriteriaId;
    private UUID adjustmentRequestId;
    private int round;
    private ApprovalFlowStatus status;
    private UUID requesterId;
    private String requesterName;
    private Integer currentStepOrder;
    private Instant startedAt;
    private Instant finishedAt;
    /** Có khi flow lập theo quy trình duyệt. */
    private Process process;
    private List<Step> steps;
    private List<Event> events;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Step {
        private UUID id;
        private int order;
        private ApprovalStepKind kind;
        private UUID orgUnitId;
        private String orgUnitName;
        /** Bước của quy trình duyệt ({@code kind = PROCESS_STEP}): tên + mã "1", "1.1"… */
        private String stepName;
        private String stepCode;
        private String processNodeId;
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

    /**
     * Quy trình đã lập ra flow. {@code graph} chỉ có khi quy trình bật "hiển thị trong đối tượng" lúc
     * gửi: sơ đồ chụp lại khi đó, {@code pathNodeIds} là đường đã đi qua nó.
     */
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Process {
        private UUID id;
        private String title;
        private boolean showDiagram;
        private Object graph;
        private List<String> pathNodeIds;
        private String currentNodeId;
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
