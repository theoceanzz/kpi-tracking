package com.kpitracking.dto.request.task;

import com.kpitracking.enums.KpiTaskReminderKind;
import lombok.*;

import java.time.Instant;

/** Một mốc nhắc: AT_DUE; BEFORE + offsetMinutes (15, 60, 1440…); CUSTOM + customAt. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiTaskReminderInput {

    private KpiTaskReminderKind kind;
    private Integer offsetMinutes;
    private Instant customAt;
}
