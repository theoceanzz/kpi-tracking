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
