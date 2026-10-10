package com.kpitracking.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.io.Serializable;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;

/**
 * Quy tắc lặp của một công việc (cột {@code kpi_tasks.recurrence_rule}, JSONB).
 *
 * <ul>
 *   <li>{@code DAILY}: mỗi {@code interval} ngày;</li>
 *   <li>{@code WEEKLY}: các thứ trong {@code byWeekday} (1 = thứ 2 … 7 = CN), mỗi {@code interval} tuần;</li>
 *   <li>{@code MONTHLY}: ngày {@code byMonthDay} (tháng thiếu ngày thì lấy ngày cuối tháng), mỗi {@code interval} tháng.</li>
 * </ul>
 * "Tuỳ chỉnh" của giao diện chính là {@code interval} &gt; 1. {@link #template} là giá trị mà các lần SAU sẽ chép
 * (sửa "chỉ lần này" không đổi nó; sửa "lần này và các lần sau" đổi cả nó).
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@EqualsAndHashCode // Hibernate so cột JSON bằng equals — thiếu thì mỗi lần flush đều tưởng đã đổi và tăng version.
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class TaskRecurrence implements Serializable {

    public enum Freq { DAILY, WEEKLY, MONTHLY }

    private Freq freq;
    @Builder.Default
    private Integer interval = 1;
    private List<Integer> byWeekday;
    private Integer byMonthDay;
    private Template template;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    @EqualsAndHashCode
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Template implements Serializable {
        private String title;
        private String description;
        private String descriptionDoc;
        private String priority;
        private String visibility;
        private LocalTime dueTime;
    }

    public int safeInterval() {
        return interval == null || interval < 1 ? 1 : Math.min(interval, 365);
    }

    /** Hạn của lần kế tiếp, luôn SAU {@code due}. */
    public LocalDate next(LocalDate due) {
        int n = safeInterval();
        return switch (freq == null ? Freq.DAILY : freq) {
            case DAILY -> due.plusDays(n);
            case WEEKLY -> nextWeekly(due, n);
            case MONTHLY -> {
                LocalDate base = due.plusMonths(n);
                int day = byMonthDay != null ? byMonthDay : due.getDayOfMonth();
                yield base.withDayOfMonth(Math.min(Math.max(day, 1), base.lengthOfMonth()));
            }
        };
    }

    private LocalDate nextWeekly(LocalDate due, int n) {
        List<Integer> days = byWeekday == null || byWeekday.isEmpty()
                ? List.of(due.getDayOfWeek().getValue()) : new ArrayList<>(byWeekday);
        LocalDate weekStart = due.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        for (LocalDate d = due.plusDays(1); d.isBefore(due.plusWeeks(n).plusDays(8)); d = d.plusDays(1)) {
            long weeks = ChronoUnit.WEEKS.between(weekStart, d.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)));
            if (weeks % n == 0 && days.contains(d.getDayOfWeek().getValue())) return d;
        }
        return due.plusWeeks(n);
    }
}
