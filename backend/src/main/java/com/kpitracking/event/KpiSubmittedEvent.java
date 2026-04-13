package com.kpitracking.event;

import com.kpitracking.entity.KpiSubmission;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class KpiSubmittedEvent extends ApplicationEvent {

    private final KpiSubmission submission;

    public KpiSubmittedEvent(Object source, KpiSubmission submission) {
        super(source);
        this.submission = submission;
    }
}
