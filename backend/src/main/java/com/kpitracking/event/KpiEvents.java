package com.kpitracking.event;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.entity.User;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

public final class KpiEvents {

    private KpiEvents() {}

    @Getter
    public static class KpiSubmittedEvent extends ApplicationEvent {
        private final KpiSubmission submission;

        public KpiSubmittedEvent(Object source, KpiSubmission submission) {
            super(source);
            this.submission = submission;
        }
    }

    @Getter
    public static class SubmissionReviewedEvent extends ApplicationEvent {
        private final KpiSubmission submission;

        public SubmissionReviewedEvent(Object source, KpiSubmission submission) {
            super(source);
            this.submission = submission;
        }
    }

    @Getter
    public static class KpiCriteriaApprovedEvent extends ApplicationEvent {
        private final KpiCriteria kpiCriteria;

        public KpiCriteriaApprovedEvent(Object source, KpiCriteria kpiCriteria) {
            super(source);
            this.kpiCriteria = kpiCriteria;
        }
    }

    @Getter
    public static class KpiCriteriaRejectedEvent extends ApplicationEvent {
        private final KpiCriteria kpiCriteria;

        public KpiCriteriaRejectedEvent(Object source, KpiCriteria kpiCriteria) {
            super(source);
            this.kpiCriteria = kpiCriteria;
        }
    }

    @Getter
    public static class KpiCriteriaApprovalRevertedEvent extends ApplicationEvent {
        private final KpiCriteria kpiCriteria;
        private final User revertedBy;

        public KpiCriteriaApprovalRevertedEvent(Object source, KpiCriteria kpiCriteria, User revertedBy) {
            super(source);
            this.kpiCriteria = kpiCriteria;
            this.revertedBy = revertedBy;
        }
    }

    @Getter
    public static class KpiCriteriaSubmittedForApprovalEvent extends ApplicationEvent {
        private final KpiCriteria kpiCriteria;

        public KpiCriteriaSubmittedForApprovalEvent(Object source, KpiCriteria kpiCriteria) {
            super(source);
            this.kpiCriteria = kpiCriteria;
        }
    }
}
