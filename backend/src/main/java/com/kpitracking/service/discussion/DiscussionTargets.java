package com.kpitracking.service.discussion;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiTask;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.enums.DiscussionTargetType;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.Terms;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiTaskRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.kpi.KpiAccessPolicy;
import com.kpitracking.service.task.KpiTaskAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Nạp đối tượng mà một khung thảo luận gắn vào (KPI hoặc công việc) và trả lời các câu hỏi quyền trên nó.
 * Mọi quyền thảo luận đi qua đây — controller, WebSocket SUBSCRIBE, và người nhận thông báo.
 *
 * <p>Quyền: xem = xem được đối tượng (KPI: {@link KpiAccessPolicy}; task: {@link KpiTaskAccess}) + {@code KPI_COMMENT:VIEW};
 * bình luận = xem được + {@code KPI_COMMENT:CREATE}; xoá bình luận người khác = xem được + {@code KPI_COMMENT:MODERATE}
 * ở đơn vị của KPI. Khoá kỳ KHÔNG chặn bình luận (bình luận không đổi dữ liệu KPI — phương án (a)).
 */
@Component
@RequiredArgsConstructor
public class DiscussionTargets {

    public static final String PERM_VIEW = "KPI_COMMENT:VIEW";
    public static final String PERM_CREATE = "KPI_COMMENT:CREATE";
    public static final String PERM_MODERATE = "KPI_COMMENT:MODERATE";

    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KpiTaskRepository taskRepository;
    private final KpiAccessPolicy kpiAccessPolicy;
    private final KpiTaskAccess taskAccess;
    private final PermissionChecker permissionChecker;
    private final com.kpitracking.repository.KpiTaskFollowerRepository followerRepository;

    /** Đối tượng đã nạp. {@code kpi} là KPI của chính nó (KPI) hoặc của task; có thể null khi KPI của task đã xoá. */
    public record Target(DiscussionTargetType type, UUID id, UUID organizationId, String title,
                         KpiCriteria kpi, KpiTask task) {

        public OrgUnit orgUnit() {
            return kpi == null ? null : kpi.getOrgUnit();
        }

        public UUID kpiId() {
            return kpi != null ? kpi.getId() : task != null ? task.getKpiCriteriaId() : null;
        }
    }

    public Target load(DiscussionTargetType type, UUID id) {
        if (type == DiscussionTargetType.KPI) {
            KpiCriteria kpi = kpiCriteriaRepository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.kpi"), "id", id));
            return new Target(type, id, KpiAccessPolicy.organizationIdOf(kpi), kpi.getName(), kpi, null);
        }
        KpiTask task = taskRepository.findById(id)
                .orElseThrow(() -> new ForbiddenException(ErrorCode.TASK_NOT_FOUND));
        KpiCriteria kpi = kpiCriteriaRepository.findById(task.getKpiCriteriaId()).orElse(null);
        return new Target(type, id, task.getOrganizationId(), task.getTitle(), kpi, task);
    }

    /** Xem được đối tượng (chưa xét quyền KPI_COMMENT). */
    public boolean canSee(UUID userId, Target t) {
        return t.type() == DiscussionTargetType.KPI
                ? kpiAccessPolicy.canView(userId, t.kpi())
                : taskAccess.canView(userId, t.task());
    }

    public boolean canView(UUID userId, Target t) {
        return permissionChecker.hasPermission(userId, PERM_VIEW) && canSee(userId, t);
    }

    public boolean canComment(UUID userId, Target t) {
        return permissionChecker.hasPermission(userId, PERM_CREATE) && canSee(userId, t);
    }

    public boolean canModerate(UUID userId, Target t) {
        OrgUnit unit = t.orgUnit();
        return unit != null && permissionChecker.hasPermissionInOrgUnit(userId, PERM_MODERATE, unit.getId())
                && canSee(userId, t);
    }

    public void assertCanView(UUID userId, Target t) {
        if (!canView(userId, t)) throw new ForbiddenException(ErrorCode.DISCUSSION_NO_PERMISSION_VIEW);
    }

    public void assertCanComment(UUID userId, Target t) {
        if (!canComment(userId, t)) throw new ForbiddenException(ErrorCode.DISCUSSION_NO_PERMISSION_COMMENT);
    }

    /** Có thể được @tag: xem được đối tượng và có KPI_COMMENT:VIEW. */
    public boolean canBeMentioned(UUID userId, Target t) {
        return canView(userId, t);
    }

    /**
     * Gợi ý @tag. KPI: tìm thẳng bằng SQL theo luật xem KPI. Task: người thực hiện + (task công khai) người xem
     * được KPI có TASK:VIEW_TEAM.
     */
    public List<UUID> mentionCandidates(Target t, String query, int limit) {
        if (t.type() == DiscussionTargetType.KPI) {
            return kpiAccessPolicy.viewerIds(t.id(), PERM_VIEW, query, limit);
        }
        Set<UUID> ids = new LinkedHashSet<>();
        ids.add(t.task().getOwner().getId());
        if (t.task().getCreatedBy() != null) ids.add(t.task().getCreatedBy());
        ids.addAll(followerRepository.findUserIds(t.task().getId()));
        if (t.task().getVisibility() == com.kpitracking.enums.KpiTaskVisibility.KPI_SCOPE && t.kpi() != null) {
            ids.addAll(kpiAccessPolicy.viewerIds(t.kpi().getId(), KpiTaskAccess.VIEW_TEAM, query, limit));
        }
        return ids.stream().filter(id -> canView(id, t)).limit(limit).toList();
    }
}
