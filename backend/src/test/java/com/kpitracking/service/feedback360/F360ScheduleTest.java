package com.kpitracking.service.feedback360;

import com.kpitracking.exception.BusinessException;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class F360ScheduleTest {

    private static final Instant START = Instant.parse("2026-07-01T00:00:00Z");
    private static final Instant END = Instant.parse("2026-12-31T16:59:59Z");
    private static final Duration DAY = Duration.ofDays(1);

    @Test
    void scoringMayRunUpToThreeWeeksAfterCycleEnd() {
        assertThatCode(() -> F360Schedule.validate(true, START, END, END.minus(DAY.multipliedBy(21)), END.plus(DAY.multipliedBy(21))))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> F360Schedule.validate(true, START, END, END, END.plus(DAY.multipliedBy(22))))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void developmentMustStayInsideCycle() {
        Instant mid = START.plus(DAY.multipliedBy(90));
        assertThatCode(() -> F360Schedule.validate(false, START, END, mid, mid.plus(DAY.multipliedBy(14))))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> F360Schedule.validate(false, START, END, mid, END.plus(DAY)))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void startBeforeCycleOrAfterDueIsRejected() {
        assertThatThrownBy(() -> F360Schedule.validate(false, START, END, START.minus(DAY), START.plus(DAY)))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> F360Schedule.validate(false, null, null, START.plus(DAY), START))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void noCycleOnlyNeedsStartBeforeDue() {
        assertThatCode(() -> F360Schedule.validate(false, null, null, START, START.plus(DAY.multipliedBy(400))))
                .doesNotThrowAnyException();
        assertThatCode(() -> F360Schedule.validate(true, START, END, null, null)).doesNotThrowAnyException();
    }
}
