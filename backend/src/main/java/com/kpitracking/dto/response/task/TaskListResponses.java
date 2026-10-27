package com.kpitracking.dto.response.task;

import com.kpitracking.enums.task.KpiTaskPriority;
import com.kpitracking.enums.task.KpiTaskStatus;
import com.kpitracking.enums.task.TaskFieldType;
import com.kpitracking.enums.task.TaskListRole;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Phản hồi của danh sách công việc (V42) — gom một chỗ vì đều nhỏ. */
public final class TaskListResponses {

    private TaskListResponses() {}

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class TaskListDetail {
        private UUID id;
        private String name;
        private String description;
        private String color;
        private String icon;
        /** Cấu hình bảng điều khiển (null = mặc định). */
        private Object dashboard;
        private boolean archived;
        /** Vai trò của người xem. */
        private TaskListRole role;
        private UUID createdBy;
        private Instant createdAt;
        private Long version;
        private List<Member> members;
        private List<Section> sections;
        private List<Field> fields;
        private long openCount;
        private long totalCount;
    }

    /** Nhóm riêng trong "Việc của tôi". */
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class MySection {
        private UUID id;
        private String name;
        private double sortOrder;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Member {
        private UUID id;
        private UUID userId;
        private String userName;
        private String avatarUrl;
        private UUID orgUnitId;
        private String orgUnitName;
        private TaskListRole role;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Section {
        private UUID id;
        private String name;
        private Double sortOrder;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Field {
        private UUID id;
        private UUID listId;
        private String name;
        private TaskFieldType type;
        private List<Option> options;
        private Double sortOrder;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Option {
        private String id;
        private String label;
        private String color;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SavedView {
        private UUID id;
        private String name;
        private UUID listId;
        private Object config;
        private boolean shared;
        /** Của người xem (sửa / xoá được). */
        private boolean mine;
        private Double sortOrder;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Template {
        private String id;
        private String name;
        private String description;
        private boolean builtin;
        private List<String> sections;
        private int fieldCount;
        private int taskCount;
        private boolean canDelete;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Automation {
        private UUID id;
        private String name;
        private Map<String, Object> trigger;
        private Map<String, Object> action;
        private boolean enabled;
        private int runCount;
        private Instant lastRunAt;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Tag {
        private UUID id;
        private String name;
        private String color;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class BatchResult {
        private int total;
        private int succeeded;
        private List<BatchRow> results;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class BatchRow {
        private UUID taskId;
        private boolean ok;
        private String code;
        private String message;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Stats {
        private long total;
        private long open;
        private long done;
        private long cancelled;
        private long overdue;
        private long noDue;
        private Map<KpiTaskStatus, Long> byStatus;
        private List<AssigneeStat> byAssignee;
        private List<SectionStat> bySection;
        private List<WeekStat> weekly;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class AssigneeStat {
        private UUID userId;
        private String name;
        private String avatarUrl;
        private long open;
        private long done;
        private long overdue;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SectionStat {
        private UUID sectionId;
        private String name;
        private long open;
        private long done;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class WeekStat {
        private LocalDate weekStart;
        private long created;
        private long completed;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ImportPreview {
        private int validCount;
        private int errorCount;
        private List<ImportPreviewRow> rows;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ImportPreviewRow {
        private int rowNumber;
        private String title;
        private String description;
        private String assigneeEmails;
        private LocalDate startDate;
        private LocalDate dueDate;
        private KpiTaskPriority priority;
        private KpiTaskStatus status;
        private String section;
        private String tags;
        /** Câu lỗi đã dịch theo ngôn ngữ người gọi. */
        private List<String> errors;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ImportResult {
        private int created;
        private List<ImportPreviewRow> failed;
    }
}
