package com.kpitracking.dto.response.task;

import lombok.*;

import java.util.List;
import java.util.UUID;

/** Số việc CHƯA XONG cho cột trái của trang Công việc. {@code team} null = không có quyền xem việc của đơn vị. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TaskSidebarResponse {

    private long assigned;
    private long following;
    private long created;
    private long delegated;
    private long all;
    /** Việc không gắn KPI mà tôi liên quan, chưa xong. */
    private long noKpi;
    private boolean canViewTeam;
    private boolean canAssign;
    /** Cờ nhiều người thực hiện (app.tasks.multi-assignee). */
    private boolean multiAssignee;
    /** Việc tôi thực hiện đã quá hạn hoặc tới hạn hôm nay (huy hiệu menu). */
    private long badge;
    private List<KpiCount> kpis;
    /** Danh sách công việc tôi là thành viên (đang dùng trước, đã lưu trữ sau). */
    private List<ListCount> lists;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class KpiCount {
        private UUID kpiId;
        private String kpiName;
        private long open;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ListCount {
        private UUID listId;
        private String name;
        private String color;
        private String icon;
        private String role;
        private boolean archived;
        private long open;
        /** Riêng của người xem: ghim lên đầu, thư mục ở cột trái. */
        private boolean pinned;
        private String folder;
    }
}
