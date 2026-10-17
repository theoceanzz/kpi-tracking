package com.kpitracking.service.task;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.kpitracking.enums.task.TaskFieldType;
import com.kpitracking.i18n.ErrorMessages;

import java.util.List;
import java.util.Map;

/**
 * Mẫu danh sách công việc: nhóm, trường tuỳ chỉnh, việc mẫu (hạn tương đối), luật tự động hoá — tham chiếu nhóm / trường
 * bằng TÊN để mẫu dùng được cho danh sách mới. Mẫu có sẵn nằm ở đây (chữ dịch lúc tạo theo ngôn ngữ người tạo — sau đó là
 * dữ liệu của danh sách, đổi tên được); mẫu tổ chức lưu ở {@code task_list_templates.payload} cùng định dạng.
 */
public final class TaskListTemplates {

    private TaskListTemplates() {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Payload(List<String> sections, List<FieldDef> fields, List<TaskDef> tasks, List<AutomationDef> automations) {

        public Payload {
            sections = sections == null ? List.of() : sections;
            fields = fields == null ? List.of() : fields;
            tasks = tasks == null ? List.of() : tasks;
            automations = automations == null ? List.of() : automations;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record FieldDef(String name, TaskFieldType type, List<TaskFieldCodec.Option> options) {}

    /** {@code dueInDays}: hạn = ngày tạo danh sách + N ngày (null = không hạn). {@code recurrence}: DAILY|WEEKLY|MONTHLY. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TaskDef(String title, String section, Integer dueInDays, List<String> checklist, String priority, String recurrence) {}

    /** Như luật tự động hoá thật nhưng nhóm / trường viết bằng tên: "section", "field", "option" (nhãn lựa chọn). */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AutomationDef(String name, Map<String, Object> trigger, Map<String, Object> action) {}

    public static final List<String> BUILTIN = List.of("project", "event", "recruiting", "recurring");

    private static String t(String key) {
        return ErrorMessages.text("taskTemplate." + key, key);
    }

    public static String name(String id) {
        return t(id + ".name");
    }

    public static String description(String id) {
        return t(id + ".description");
    }

    /** Mẫu có sẵn — chữ theo ngôn ngữ của request hiện tại. */
    public static Payload builtin(String id) {
        return switch (id) {
            case "project" -> {
                String todo = t("project.s.todo"), doing = t("project.s.doing"), review = t("project.s.review"), done = t("project.s.done");
                yield new Payload(List.of(todo, doing, review, done),
                        List.of(new FieldDef(t("project.f.phase"), TaskFieldType.SINGLE_SELECT, List.of(
                                        new TaskFieldCodec.Option("kickoff", t("project.o.kickoff"), "#3b82f6"),
                                        new TaskFieldCodec.Option("build", t("project.o.build"), "#f59e0b"),
                                        new TaskFieldCodec.Option("accept", t("project.o.accept"), "#10b981"))),
                                new FieldDef(t("project.f.estimate"), TaskFieldType.NUMBER, null)),
                        List.of(new TaskDef(t("project.t.kickoff"), todo, 1, List.of(t("project.c.goals"), t("project.c.team")), "HIGH", null),
                                new TaskDef(t("project.t.plan"), todo, 3, null, "MEDIUM", null),
                                new TaskDef(t("project.t.report"), todo, 7, null, "MEDIUM", "WEEKLY")),
                        List.of(new AutomationDef(t("project.a.done"),
                                Map.of("type", "SECTION_ENTERED", "section", done), Map.of("type", "SET_STATUS", "status", "DONE"))));
            }
            case "event" -> {
                String prep = t("event.s.prep"), comms = t("event.s.comms"), logistics = t("event.s.logistics"), after = t("event.s.after");
                yield new Payload(List.of(prep, comms, logistics, after),
                        List.of(new FieldDef(t("event.f.budget"), TaskFieldType.NUMBER, null),
                                new FieldDef(t("event.f.owner"), TaskFieldType.MEMBER, null)),
                        List.of(new TaskDef(t("event.t.venue"), prep, 3, null, "HIGH", null),
                                new TaskDef(t("event.t.invite"), comms, 7, null, "MEDIUM", null),
                                new TaskDef(t("event.t.wrapup"), after, 14, null, "LOW", null)),
                        List.of());
            }
            case "recruiting" -> {
                String fresh = t("recruiting.s.new"), interview = t("recruiting.s.interview"), offer = t("recruiting.s.offer"),
                        hired = t("recruiting.s.hired"), rejected = t("recruiting.s.rejected");
                yield new Payload(List.of(fresh, interview, offer, hired, rejected),
                        List.of(new FieldDef(t("recruiting.f.position"), TaskFieldType.TEXT, null),
                                new FieldDef(t("recruiting.f.source"), TaskFieldType.SINGLE_SELECT, List.of(
                                        new TaskFieldCodec.Option("web", t("recruiting.o.web"), "#3b82f6"),
                                        new TaskFieldCodec.Option("referral", t("recruiting.o.referral"), "#10b981"),
                                        new TaskFieldCodec.Option("social", t("recruiting.o.social"), "#8b5cf6"))),
                                new FieldDef(t("recruiting.f.interviewDate"), TaskFieldType.DATE, null)),
                        List.of(),
                        List.of(new AutomationDef(t("recruiting.a.hired"),
                                        Map.of("type", "SECTION_ENTERED", "section", hired), Map.of("type", "SET_STATUS", "status", "DONE")),
                                new AutomationDef(t("recruiting.a.rejected"),
                                        Map.of("type", "SECTION_ENTERED", "section", rejected), Map.of("type", "SET_STATUS", "status", "CANCELLED"))));
            }
            case "recurring" -> {
                String daily = t("recurring.s.daily"), weekly = t("recurring.s.weekly"), monthly = t("recurring.s.monthly");
                yield new Payload(List.of(daily, weekly, monthly), List.of(),
                        List.of(new TaskDef(t("recurring.t.daily"), daily, 0, null, "MEDIUM", "DAILY"),
                                new TaskDef(t("recurring.t.weekly"), weekly, 4, null, "MEDIUM", "WEEKLY"),
                                new TaskDef(t("recurring.t.monthly"), monthly, 25, null, "MEDIUM", "MONTHLY")),
                        List.of());
            }
            default -> new Payload(List.of(), List.of(), List.of(), List.of());
        };
    }
}
