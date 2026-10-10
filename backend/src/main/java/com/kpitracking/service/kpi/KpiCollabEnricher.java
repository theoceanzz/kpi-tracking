package com.kpitracking.service.kpi;

import com.kpitracking.dto.response.kpi.KpiCriteriaResponse;
import com.kpitracking.enums.DiscussionTargetType;
import com.kpitracking.service.discussion.DiscussionService;
import com.kpitracking.service.task.KpiTaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Gắn số liệu cộng tác vào danh sách KPI cho người đang xem: số bình luận chưa đọc / tổng bình luận và tiến độ
 * công việc ("x/y việc", quá hạn). Một truy vấn gộp cho cả trang, không truy vấn theo từng dòng.
 */
@Component
@RequiredArgsConstructor
public class KpiCollabEnricher {

    private final DiscussionService discussionService;
    private final KpiTaskService taskService;

    public void enrich(List<KpiCriteriaResponse> list, UUID viewerId) {
        if (list == null || list.isEmpty()) return;
        List<UUID> ids = list.stream().map(KpiCriteriaResponse::getId).filter(Objects::nonNull).toList();
        Map<UUID, Long> unread = discussionService.unreadCounts(viewerId, DiscussionTargetType.KPI, ids);
        Map<UUID, Long> total = discussionService.commentCounts(DiscussionTargetType.KPI, ids);
        Map<UUID, long[]> progress = taskService.progress(viewerId, ids);
        for (KpiCriteriaResponse r : list) {
            r.setUnreadComments(unread.getOrDefault(r.getId(), 0L));
            r.setCommentCount(total.getOrDefault(r.getId(), 0L));
            long[] p = progress.get(r.getId());
            if (p != null && p[1] > 0) {
                r.setTaskProgress(KpiCriteriaResponse.TaskProgress.builder().done(p[0]).total(p[1]).overdue(p[2]).build());
            }
        }
    }
}
