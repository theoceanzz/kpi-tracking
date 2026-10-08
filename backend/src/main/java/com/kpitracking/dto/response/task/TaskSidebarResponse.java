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
    private boolean canViewTeam;
    private boolean canAssign;
    /** Việc tôi phụ trách đã quá hạn hoặc tới hạn hôm nay (huy hiệu menu). */
    private long badge;
    private List<KpiCount> kpis;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class KpiCount {
        private UUID kpiId;
        private String kpiName;
        private long open;
    }
}
