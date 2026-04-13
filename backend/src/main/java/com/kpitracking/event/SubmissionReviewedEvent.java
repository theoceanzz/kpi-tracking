package com.kpitracking.event;

import com.kpitracking.entity.KpiSubmission;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class SubmissionReviewedEvent extends ApplicationEvent {

    private final KpiSubmission submission;

    public SubmissionReviewedEvent(Object source, KpiSubmission submission) {
        super(source);
        this.submission = submission;
    }
}
