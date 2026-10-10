package com.kpitracking.entity;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Phép tính hạn của lần lặp kế tiếp. */
class TaskRecurrenceTest {

    private static TaskRecurrence rule(TaskRecurrence.Freq f, int interval, List<Integer> days, Integer monthDay) {
        return TaskRecurrence.builder().freq(f).interval(interval).byWeekday(days).byMonthDay(monthDay).build();
    }

    @Test
    void dailyEveryNDays() {
        assertThat(rule(TaskRecurrence.Freq.DAILY, 3, null, null).next(LocalDate.of(2099, 1, 30))).isEqualTo(LocalDate.of(2099, 2, 2));
    }

    @Test
    void weeklyOnSeveralWeekdays() {
        // Thứ 2 và thứ 5; từ thứ 2 05/01/2099 ⇒ thứ 5 08/01, rồi thứ 2 12/01.
        TaskRecurrence r = rule(TaskRecurrence.Freq.WEEKLY, 1, List.of(1, 4), null);
        LocalDate monday = LocalDate.of(2099, 1, 5);
        assertThat(monday.getDayOfWeek().getValue()).isEqualTo(1);
        assertThat(r.next(monday)).isEqualTo(LocalDate.of(2099, 1, 8));
        assertThat(r.next(LocalDate.of(2099, 1, 8))).isEqualTo(LocalDate.of(2099, 1, 12));
    }

    @Test
    void everyTwoWeeksSkipsTheOffWeek() {
        TaskRecurrence r = rule(TaskRecurrence.Freq.WEEKLY, 2, List.of(5), null);
        LocalDate friday = LocalDate.of(2099, 1, 2);
        assertThat(friday.getDayOfWeek().getValue()).isEqualTo(5);
        assertThat(r.next(friday)).isEqualTo(friday.plusWeeks(2));
    }

    @Test
    void monthlyOnDay31FallsBackToLastDayOfShortMonth() {
        TaskRecurrence r = rule(TaskRecurrence.Freq.MONTHLY, 1, null, 31);
        assertThat(r.next(LocalDate.of(2099, 1, 31))).isEqualTo(LocalDate.of(2099, 2, 28));
        assertThat(r.next(LocalDate.of(2099, 2, 28))).isEqualTo(LocalDate.of(2099, 3, 31));
    }
}
