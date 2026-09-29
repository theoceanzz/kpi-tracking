package com.kpitracking.service.ai.review;

import com.kpitracking.dto.request.ai.AiCriteriaSetMetaRequest;
import com.kpitracking.dto.response.ai.AiCriteriaChangeRequestResponse;
import com.kpitracking.entity.AiCriteriaChangeRequest;
import com.kpitracking.entity.AiCriteriaSet;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.repository.AiCriteriaChangeRequestRepository;
import com.kpitracking.repository.AiCriteriaSetRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.notification.NotificationDispatcher;
import com.kpitracking.service.notification.NotificationRoutingService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Đề nghị đổi quy chế chấm đang áp cho một đơn vị. Cấp dưới không thay được tài liệu do cấp trên áp
 * ({@link AiCriteriaAuthority#lockedFor}) — họ gửi đề nghị kèm tài liệu của mình (bản nháp / đã ngừng); người đã
 * áp, hoặc ai cao hơn người đề nghị và thay được tài liệu đó, đồng ý thì đơn vị chuyển hẳn sang tài liệu đề nghị
 * (người đề nghị thành người áp). Hai bên đều nhận thông báo.
 */
@Service
@RequiredArgsConstructor
public class AiCriteriaChangeRequestService {

    static final String EVENT_REQUESTED = "ai_criteria_change_requested";
    static final String EVENT_DECIDED = "ai_criteria_change_decided";
    static final String TYPE = "AI_CRITERIA";

    private final AiCriteriaSetService sets;
    private final AiCriteriaSetRepository setRepository;
    private final AiCriteriaChangeRequestRepository requestRepository;
    private final AiCriteriaAuthority authority;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRepository userRepository;
    private final PermissionChecker permissions;
    private final NotificationRoutingService routing;
    private final NotificationDispatcher dispatcher;

    /** Gửi đề nghị áp tài liệu {@code setId} (bản nháp / đã ngừng) cho một đơn vị đang bị khoá. */
    @Transactional
    public AiCriteriaChangeRequestResponse create(UUID setId, AiCriteriaSetMetaRequest req) {
        AiCriteriaSet proposed = sets.manageableSet(setId);
        if (AiCriteriaSet.CONFIRMED.equals(proposed.getStatus())) {
            throw new BusinessException("Tài liệu này đang được áp dụng — nhân bản để đề nghị cho đơn vị khác.");
        }
        return send(proposed, req.getOrgUnitId(), req.getNote());
    }

    /** Nhân bản thành bản nháp cho đơn vị bị khoá rồi gửi đề nghị luôn (một bước trên giao diện). */
    @Transactional
    public AiCriteriaChangeRequestResponse cloneAndRequest(UUID setId, AiCriteriaSetMetaRequest req) {
        AiCriteriaSet copy = sets.cloneTo(setId, req, true);
        return send(copy, req.getOrgUnitId(), req.getNote());
    }

    private AiCriteriaChangeRequestResponse send(AiCriteriaSet proposed, UUID unitId, String note) {
        User me = sets.currentUser();
        UUID orgId = proposed.getOrganizationId();
        if (unitId == null) throw new BusinessException("Chọn đơn vị muốn áp tài liệu.");
        sets.requireUnitInOrg(unitId, orgId);
        if (!authority.canManageUnit(me.getId(), orgId, unitId)) {
            throw new ForbiddenException(sets.unitLabel(orgId, unitId) + " không thuộc các đơn vị bạn quản lý.");
        }
        AiCriteriaSet current = sets.activeAt(orgId, unitId, proposed.getId());
        if (current == null || !authority.lockedFor(me.getId(), current)) {
            throw new BusinessException(sets.unitLabel(orgId, unitId)
                    + " không bị khoá — bạn tự áp được tài liệu, không cần đề nghị.");
        }
        if (requestRepository.findByProposedSetIdAndStatus(proposed.getId(), AiCriteriaChangeRequest.PENDING).isPresent()) {
            throw new BusinessException("Tài liệu này đã có một đề nghị đang chờ duyệt.");
        }
        if (AiCriteriaSet.DRAFT.equals(proposed.getStatus())) {
            proposed.setOrgUnitId(unitId);
            setRepository.save(proposed);
        }
        OrgUnit unit = orgUnitRepository.findById(unitId).orElseThrow();
        User approver = approverFor(current, unit, me);
        AiCriteriaChangeRequest r = requestRepository.save(AiCriteriaChangeRequest.builder()
                .organizationId(orgId)
                .orgUnitId(unitId)
                .currentSetId(current.getId())
                .proposedSetId(proposed.getId())
                .requestedBy(me.getId())
                .approverId(approver == null ? null : approver.getId())
                .note(note == null || note.isBlank() ? null : note.strip())
                .build());
        if (approver != null) {
            String role = permissions.getBestRoleNameInOrgUnit(me.getId(), unitId);
            dispatcher.dispatch(orgId, EVENT_REQUESTED, approver, unit,
                    LocalizedText.of("notif.aiCriteria.requested.title"),
                    LocalizedText.of("notif.aiCriteria.requested.message", me.getFullName(),
                            role == null ? "" : LocalizedText.of("notif.aiCriteria.roleSuffix", role),
                            proposed.getTitle(), unit.getName(), current.getTitle(),
                            r.getNote() == null ? "" : LocalizedText.of("notif.aiCriteria.noteSuffix", r.getNote())),
                    TYPE, r.getId());
        }
        return toResponse(r);
    }

    /**
     * Người được báo: người đã áp tài liệu đang áp (nếu còn trong tổ chức), không thì cấp trên gần nhất có quyền
     * áp quy chế và cao hơn người đề nghị.
     */
    private User approverFor(AiCriteriaSet current, OrgUnit unit, User requester) {
        UUID applier = current.getConfirmedBy();
        if (applier != null && permissions.isMemberOfOrganization(applier, current.getOrganizationId())) {
            User u = userRepository.findById(applier).orElse(null);
            if (u != null) return u;
        }
        return routing.nearestWithPermission(unit, AiCriteriaAuthority.MANAGE, Set.of(requester.getId())).stream()
                .filter(u -> permissions.isSuperiorTo(u.getId(), requester.getId(), unit.getId()))
                .findFirst().orElse(null);
    }

    /** Đề nghị người này quyết được. */
    @Transactional(readOnly = true)
    public List<AiCriteriaChangeRequestResponse> pendingForMe() {
        User me = sets.currentUser();
        UUID orgId = sets.organizationOf(me).getId();
        return requestRepository.findByOrganizationIdAndStatusOrderByCreatedAtDesc(orgId, AiCriteriaChangeRequest.PENDING)
                .stream().filter(r -> canDecide(me, r)).map(this::toResponse).toList();
    }

    /**
     * Quyết được khi: không phải người gửi, quản lý đơn vị đó, cao hơn người gửi tại đơn vị đó, và thay được
     * tài liệu đang áp ở đó (không bị khoá).
     */
    private boolean canDecide(User me, AiCriteriaChangeRequest r) {
        if (me.getId().equals(r.getRequestedBy())) return false;
        if (!authority.canManageUnit(me.getId(), r.getOrganizationId(), r.getOrgUnitId())) return false;
        if (!permissions.isGlobalAdminIn(me.getId(), r.getOrgUnitId())
                && !permissions.isSuperiorTo(me.getId(), r.getRequestedBy(), r.getOrgUnitId())) return false;
        AiCriteriaSet current = sets.activeAt(r.getOrganizationId(), r.getOrgUnitId(), r.getProposedSetId());
        return current == null || !authority.lockedFor(me.getId(), current);
    }

    @Transactional
    public AiCriteriaChangeRequestResponse approve(UUID requestId, String note) {
        User me = sets.currentUser();
        AiCriteriaChangeRequest r = pendingDecidable(requestId, me);
        AiCriteriaSet proposed = setRepository.findById(r.getProposedSetId())
                .orElseThrow(() -> new BusinessException("Tài liệu đề nghị không còn nữa."));
        decide(r, me, AiCriteriaChangeRequest.APPROVED, note);
        // Đơn vị chuyển hẳn sang quy chế của người đề nghị: họ thành người áp.
        sets.applyTo(proposed, r.getOrgUnitId(), me, true, r.getRequestedBy());
        notifyRequester(r, proposed, true);
        return toResponse(r);
    }

    @Transactional
    public AiCriteriaChangeRequestResponse reject(UUID requestId, String note) {
        User me = sets.currentUser();
        AiCriteriaChangeRequest r = pendingDecidable(requestId, me);
        decide(r, me, AiCriteriaChangeRequest.REJECTED, note);
        setRepository.findById(r.getProposedSetId()).ifPresent(p -> notifyRequester(r, p, false));
        return toResponse(r);
    }

    /** Người gửi rút đề nghị. */
    @Transactional
    public void cancel(UUID requestId) {
        User me = sets.currentUser();
        AiCriteriaChangeRequest r = inOrg(requestId, me);
        if (!me.getId().equals(r.getRequestedBy())) throw new ForbiddenException("Chỉ người gửi mới rút được đề nghị.");
        if (!AiCriteriaChangeRequest.PENDING.equals(r.getStatus())) throw new BusinessException("Đề nghị đã được xử lý.");
        r.setStatus(AiCriteriaChangeRequest.CANCELLED);
        r.setDecidedAt(Instant.now());
        requestRepository.save(r);
    }

    private AiCriteriaChangeRequest pendingDecidable(UUID requestId, User me) {
        AiCriteriaChangeRequest r = inOrg(requestId, me);
        if (!AiCriteriaChangeRequest.PENDING.equals(r.getStatus())) throw new BusinessException("Đề nghị đã được xử lý.");
        if (!canDecide(me, r)) throw new ForbiddenException("Bạn không có quyền quyết đề nghị này.");
        return r;
    }

    private AiCriteriaChangeRequest inOrg(UUID requestId, User me) {
        UUID orgId = sets.organizationOf(me).getId();
        return requestRepository.findByIdAndOrganizationId(requestId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Đề nghị", "id", requestId));
    }

    private void decide(AiCriteriaChangeRequest r, User me, String status, String note) {
        r.setStatus(status);
        r.setDecidedBy(me.getId());
        r.setDecidedAt(Instant.now());
        r.setDecisionNote(note == null || note.isBlank() ? null : note.strip());
        requestRepository.save(r);
    }

    private void notifyRequester(AiCriteriaChangeRequest r, AiCriteriaSet proposed, boolean approved) {
        User requester = userRepository.findById(r.getRequestedBy()).orElse(null);
        OrgUnit unit = orgUnitRepository.findById(r.getOrgUnitId()).orElse(null);
        if (requester == null || unit == null) return;
        Object decider = r.getDecidedBy() == null ? null
                : userRepository.findById(r.getDecidedBy()).map(User::getFullName).orElse(null);
        if (decider == null) decider = LocalizedText.of("notif.aiCriteria.actor.superior");
        LocalizedText title = LocalizedText.of(approved ? "notif.aiCriteria.approved.title" : "notif.aiCriteria.rejected.title");
        LocalizedText message = approved
                ? LocalizedText.of("notif.aiCriteria.approved.message", decider, unit.getName(), proposed.getTitle())
                : LocalizedText.of("notif.aiCriteria.rejected.message", decider, proposed.getTitle(), unit.getName(),
                        r.getDecisionNote() == null ? "" : LocalizedText.of("notif.aiCriteria.reasonSuffix", r.getDecisionNote()));
        dispatcher.dispatch(r.getOrganizationId(), EVENT_DECIDED, requester, unit, title, message, TYPE, r.getId());
    }

    private AiCriteriaChangeRequestResponse toResponse(AiCriteriaChangeRequest r) {
        AiCriteriaSet proposed = setRepository.findById(r.getProposedSetId()).orElse(null);
        AiCriteriaSet current = r.getCurrentSetId() == null ? null : setRepository.findById(r.getCurrentSetId()).orElse(null);
        return AiCriteriaChangeRequestResponse.builder()
                .id(r.getId())
                .orgUnitId(r.getOrgUnitId())
                .orgUnitName(sets.unitLabel(r.getOrganizationId(), r.getOrgUnitId()))
                .proposedSetId(r.getProposedSetId())
                .proposedSetTitle(proposed == null ? null : proposed.getTitle())
                .currentSetId(current == null ? null : current.getId())
                .currentSetTitle(current == null ? null : current.getTitle())
                .requestedByName(userRepository.findById(r.getRequestedBy()).map(User::getFullName).orElse(null))
                .requestedByRole(permissions.getBestRoleNameInOrgUnit(r.getRequestedBy(), r.getOrgUnitId()))
                .approverName(r.getApproverId() == null ? null
                        : userRepository.findById(r.getApproverId()).map(User::getFullName).orElse(null))
                .note(r.getNote())
                .status(r.getStatus())
                .decisionNote(r.getDecisionNote())
                .createdAt(r.getCreatedAt())
                .build();
    }
}
