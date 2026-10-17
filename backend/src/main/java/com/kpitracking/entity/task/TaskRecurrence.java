package com.kpitracking.entity.task;

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
 *   <li>{@code WEEKLY}: các thứ trong {@code byWeekday} (1 = thứ 2 … 7 = CN), mỗi {@code interval} tuần — "ngày làm việc"
 *       = WEEKLY T2–T6;</li>
 *   <li>{@code MONTHLY}: ngày {@code byMonthDay} (tháng thiếu ngày thì lấy ngày cuối tháng), HOẶC "thứ X tuần thứ n"
 *       ({@code byWeekday} một ngày + {@code bySetPos} 1..4, -1 = tuần cuối), mỗi {@code interval} tháng;</li>
 *   <li>{@code YEARLY}: tháng {@code byMonth} ngày {@code byMonthDay} (mặc định theo hạn hiện tại), mỗi {@code interval} năm.</li>
 * </ul>
 * {@code count}: tổng số lần (lần đầu là lần 1) — đủ thì dừng, như "ngày kết thúc". "Tuỳ chỉnh" của giao diện chính là
 * {@code interval} &gt; 1. {@link #template} là giá trị mà các lần SAU sẽ chép (sửa "chỉ lần này" không đổi nó; sửa "lần
 * này và các lần sau" đổi cả nó).
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@EqualsAndHashCode // Hibernate so cột JSON bằng equals — thiếu thì mỗi lần flush đều tưởng đã đổi và tăng version.
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class TaskRecurrence implements Serializable {

    public enum Freq { DAILY, WEEKLY, MONTHLY, YEARLY }

    private Freq freq;
    @Builder.Default
    private Integer interval = 1;
    private List<Integer> byWeekday;
    private Integer byMonthDay;
    /** MONTHLY: tuần thứ mấy của tháng (1..4, -1 = cuối) — dùng cùng một ngày trong {@link #byWeekday}. */
    private Integer bySetPos;
    /** YEARLY: tháng (1..12). */
    private Integer byMonth;
    /** Tổng số lần lặp (kể cả lần đầu); null = không giới hạn. */
    private Integer count;
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
            case MONTHLY -> nthWeekdayMode() ? nthWeekday(due.plusMonths(n)) : clampDay(due.plusMonths(n),
                    byMonthDay != null ? byMonthDay : due.getDayOfMonth());
            case YEARLY -> {
                LocalDate base = due.plusYears(n);
                if (byMonth != null && byMonth >= 1 && byMonth <= 12) base = base.withDayOfMonth(1).withMonth(byMonth);
                yield clampDay(base, byMonthDay != null ? byMonthDay : due.getDayOfMonth());
            }
        };
    }

    private boolean nthWeekdayMode() {
        return bySetPos != null && byWeekday != null && byWeekday.size() == 1;
    }

    /** "Thứ X tuần thứ n" của tháng chứa {@code monthAnchor}. */
    private LocalDate nthWeekday(LocalDate monthAnchor) {
        DayOfWeek dow = DayOfWeek.of(Math.min(Math.max(byWeekday.get(0), 1), 7));
        if (bySetPos < 0) return monthAnchor.with(TemporalAdjusters.lastInMonth(dow));
        int pos = Math.min(Math.max(bySetPos, 1), 4);
        return monthAnchor.with(TemporalAdjusters.dayOfWeekInMonth(pos, dow));
    }

    private static LocalDate clampDay(LocalDate base, int day) {
        return base.withDayOfMonth(Math.min(Math.max(day, 1), base.lengthOfMonth()));
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
