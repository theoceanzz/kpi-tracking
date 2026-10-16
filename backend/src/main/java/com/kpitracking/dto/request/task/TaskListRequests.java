package com.kpitracking.dto.request.task;

import com.kpitracking.enums.KpiTaskPriority;
import com.kpitracking.enums.KpiTaskStatus;
import com.kpitracking.enums.TaskFieldType;
import com.kpitracking.enums.TaskListRole;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Request của danh sách công việc (V42) — gom một chỗ vì đều nhỏ. */
public final class TaskListRequests {

    private TaskListRequests() {}

    /** Tạo / sửa danh sách. Tạo từ mẫu: {@code templateId} (mẫu tổ chức) hoặc {@code builtinTemplate} (mẫu có sẵn). */
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Upsert {
        @Size(max = 200)
        private String name;
        private String description;
        @Size(max = 20)
        private String color;
        /** Biểu tượng (emoji); chuỗi rỗng = bỏ. */
        @Size(max = 16)
        private String icon;
        private Long version;
        private UUID templateId;
        private String builtinTemplate;
        /** Tạo kèm việc mẫu của mẫu danh sách. */
        private boolean includeSampleTasks;
        /** Thành viên ban đầu (ngoài người tạo — luôn là chủ). */
        private List<Member> members;
    }

    /** Tuỳ chọn riêng của tôi với một danh sách: ghim, thư mục (chuỗi rỗng / clearFolder = bỏ khỏi thư mục). */
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class MyPrefs {
        private Boolean pinned;
        @Size(max = 100)
        private String folder;
        private boolean clearFolder;
    }

    /** Cấu hình bảng điều khiển của danh sách (giao diện định nghĩa). */
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Dashboard {
        private Object config;
    }

    /** Nhóm riêng trong "Việc của tôi". */
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class MySection {
        @Size(max = 120)
        private String name;
        private Double sortOrder;
    }

    /** Xếp một việc vào nhóm riêng của tôi (null = bỏ khỏi nhóm). */
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class MySectionAssign {
        private UUID sectionId;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Member {
        private UUID userId;
        private UUID orgUnitId;
        @NotNull
        private TaskListRole role;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Section {
        @Size(max = 120)
        private String name;
        private Double sortOrder;
    }

    /** Thêm / chuyển một việc trong danh sách: nhóm (null = Chưa phân nhóm) + thứ tự. */
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Item {
        @NotNull
        private UUID taskId;
        private UUID sectionId;
        private boolean clearSection;
        private Double sortOrder;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Field {
        @Size(max = 120)
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
    public static class FieldValue {
        /** null / rỗng = xoá giá trị. */
        private Object value;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SavedView {
        @Size(max = 120)
        private String name;
        private UUID listId;
        /** Cấu hình do giao diện định nghĩa (chế độ, nhóm, sắp xếp, bộ lọc, cột). */
        private Object config;
        private boolean shared;
        private Double sortOrder;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Template {
        @Size(max = 200)
        private String name;
        private String description;
        /** Chép cả việc (tên, nhóm, checklist, hạn tương đối) vào mẫu. */
        private boolean includeTasks;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Automation {
        @Size(max = 200)
        private String name;
        /** {"type": TASK_ADDED|SECTION_ENTERED|STATUS_CHANGED|COMPLETED|FIELD_CHANGED, "sectionId"?, "status"?, "fieldId"?, "optionId"?} */
        private Map<String, Object> trigger;
        /** {"type": SET_STATUS|MOVE_SECTION|ADD_ASSIGNEE|ADD_FOLLOWER|SET_PRIORITY|SET_FIELD|SET_DUE_IN_DAYS|NOTIFY, …} */
        private Map<String, Object> action;
        private Boolean enabled;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Tag {
        @Size(max = 60)
        private String name;
        @Size(max = 20)
        private String color;
    }

    /**
     * Thao tác hàng loạt. action: COMPLETE | REOPEN | SET_STATUS | SET_PRIORITY | SET_DUE | SHIFT_DUE | SET_START |
     * ADD_ASSIGNEE | ADD_TO_LIST | REMOVE_FROM_LIST | MOVE_SECTION | ADD_TAG | REMOVE_TAG | ADD_FOLLOWER | DELETE.
     */
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Batch {
        @NotNull
        private List<UUID> taskIds;
        @NotNull
        private String action;
        private KpiTaskStatus status;
        private KpiTaskPriority priority;
        private LocalDate date;
        private boolean clear;
        private Integer days;
        private UUID userId;
        private UUID listId;
        private UUID sectionId;
        private UUID tagId;
        /** Hoàn thành dù còn việc con / bị chặn. */
        private boolean force;
    }

    /** Một dòng nhập Excel đã xem trước (người dùng có thể sửa trước khi xác nhận). */
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ImportRow {
        private String title;
        private String description;
        private String assigneeEmails;
        private LocalDate startDate;
        private LocalDate dueDate;
        private KpiTaskPriority priority;
        private KpiTaskStatus status;
        private String section;
        private String tags;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ImportCommit {
        @NotNull
        private List<ImportRow> rows;
    }
}
