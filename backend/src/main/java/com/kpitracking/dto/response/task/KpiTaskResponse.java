package com.kpitracking.dto.response.task;

import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.KpiTaskPriority;
import com.kpitracking.enums.KpiTaskStatus;
import com.kpitracking.enums.KpiTaskVisibility;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/** Một công việc. {@code checklist}/{@code attachments} chỉ có ở màn chi tiết. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiTaskResponse {

    /** Vì sao người xem không sửa được (null = sửa được). */
    public enum ReadOnlyReason { NOT_OWNER, CYCLE_LOCKED, KPI_DELETED }

    /** Hạn theo nhóm hiển thị (tính ở máy chủ theo giờ VN để mọi màn hình khớp nhau). */
    public enum DueBucket { OVERDUE, TODAY, TOMORROW, THIS_WEEK, LATER, NONE }

    private UUID id;
    private UUID kpiId;
    private String kpiName;
    private KpiStatus kpiStatus;
    private boolean kpiDeleted;
    private UUID kpiPeriodId;
    private String kpiPeriodName;
    private String title;
    private String description;
    private LocalDate dueDate;
    private KpiTaskPriority priority;
    private KpiTaskStatus status;
    private KpiTaskVisibility visibility;
    private UUID ownerId;
    private String ownerName;
    private String ownerAvatarUrl;
    private boolean overdue;
    private int checklistDone;
    private int checklistTotal;
    private int attachmentCount;
    private long commentCount;
    private long unreadComments;
    private Double sortOrder;
    private Long version;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant completedAt;
    private boolean canEdit;
    private ReadOnlyReason readOnlyReason;
    private List<ChecklistItem> checklist;
    private List<Attachment> attachments;

    // ── Kiểu Lark ─────────────────────────────────────────────────────────────────────────────
    private LocalTime dueTime;
    private boolean dueToday;
    private DueBucket dueBucket;
    private String descriptionDoc;
    private UUID createdById;
    private String createdByName;
    private UUID parentTaskId;
    private String parentTitle;
    private int subtaskDone;
    private int subtaskTotal;
    private com.kpitracking.entity.TaskRecurrence recurrence;
    private LocalDate recurrenceEndDate;
    private UUID seriesId;
    private List<Person> followers;
    private List<Reminder> reminders;
    /** Chỉ ở màn chi tiết. */
    private List<KpiTaskResponse> subtasks;
    private boolean following;
    private boolean canReassign;
    private boolean canDelete;
    private boolean canManageFollowers;

    // ── V42 ───────────────────────────────────────────────────────────────────────────────────
    /** NONE | DELETED | ACTIVE — xem {@code TaskKpiLinks}. */
    private String kpiState;
    private LocalDate startDate;
    private LocalTime startTime;
    private com.kpitracking.enums.TaskCompletionMode completionMode;
    private UUID rootTaskId;
    private int depth;
    /** Việc mốc (Lark "Mark as Milestone"). */
    private boolean milestone;
    /** Mọi người thực hiện (người chính đứng đầu), kèm phần đã xong. */
    private List<Assignee> assignees;
    /** Người xem là người thực hiện và đã tích phần mình. */
    private boolean myPartDone;
    private List<ListRef> lists;
    private List<Tag> tags;
    /** Nhóm riêng của người xem trong "Việc của tôi" (null = chưa xếp). */
    private UUID mySectionId;
    /** Giá trị trường tuỳ chỉnh — chỉ của các danh sách người xem là thành viên. */
    private List<FieldValue> fieldValues;
    /** Số việc đứng trước chưa xong (phụ thuộc FS). */
    private int openBlockers;
    /** Id các việc đứng trước (mọi trạng thái) — Gantt vẽ mũi tên. */
    private List<UUID> blockedByIds;
    /** Chỉ ở màn chi tiết. */
    private List<DependencyRef> dependencies;
    private com.kpitracking.entity.TaskSourceRef sourceRef;
    private boolean canDecline;
    /** Gắn / đổi / gỡ KPI (việc gốc, người giao lại được). */
    private boolean canSetKpi;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Assignee {
        private UUID id;
        private String fullName;
        private String avatarUrl;
        private boolean primary;
        private Instant completedAt;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ListRef {
        private UUID listId;
        private String listName;
        private String color;
        private UUID sectionId;
        private String sectionName;
        private Double sortOrder;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Tag {
        private UUID id;
        private String name;
        private String color;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class FieldValue {
        private UUID fieldId;
        private UUID listId;
        private Object value;
    }

    /** Một phụ thuộc: {@code BLOCKED_BY} = việc này chờ việc kia; {@code BLOCKING} = việc kia chờ việc này. */
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DependencyRef {
        private UUID id;
        private String direction;
        private UUID taskId;
        private String title;
        private KpiTaskStatus status;
        private LocalDate dueDate;
        private boolean accessible;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Person {
        private UUID id;
        private String fullName;
        private String avatarUrl;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Reminder {
        private UUID id;
        private com.kpitracking.enums.KpiTaskReminderKind kind;
        private Integer offsetMinutes;
        private Instant customAt;
        private Instant remindAt;
        private Instant sentAt;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ChecklistItem {
        private UUID id;
        private String title;
        private boolean done;
        private int sortOrder;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Attachment {
        private UUID id;
        private String fileName;
        private String fileUrl;
        private Long fileSize;
        private String contentType;
        private boolean image;
        private Instant createdAt;
        /** Sao từ thư viện tài liệu (nhãn "Từ thư viện: …"). */
        private boolean fromLibrary;
        private String sourceDocumentTitle;
        /** Chỉ có khi tài liệu gốc còn và người xem mở được nó — link "Mở bản mới nhất". */
        private UUID sourceDocumentId;
    }
}
