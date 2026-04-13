package com.kpitracking.event;

import com.kpitracking.entity.KpiCriteria;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class KpiCriteriaApprovedEvent extends ApplicationEvent {

    private final KpiCriteria kpiCriteria;

    public KpiCriteriaApprovedEvent(Object source, KpiCriteria kpiCriteria) {
        super(source);
        this.kpiCriteria = kpiCriteria;
    }
}
