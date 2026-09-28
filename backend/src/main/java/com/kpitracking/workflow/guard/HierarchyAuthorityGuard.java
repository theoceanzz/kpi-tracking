package com.kpitracking.workflow.guard;

import com.kpitracking.entity.User;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.i18n.Terms;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.workflow.engine.GuardResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Chốt chặn thẩm quyền: có quyền TRONG ĐƠN VỊ đó, và đứng cao hơn người sở hữu việc.
 *
 * <p>Đây là nơi duy nhất còn giữ luật từng bị chép nguyên văn năm lần. Trước đây mỗi bản chép lại
 * kèm một bộ thông báo riêng chỉ khác nhau ở động từ, nên sửa luật phải nhớ sửa đủ năm chỗ — kiểu
 * lỗi mà không ai phát hiện cho tới khi hai chỗ đã lệch nhau.
 *
 * <p>Dùng như một nhà máy sinh guard đã gắn sẵn tham số, để mỗi lời gọi tự đọc được:
 * <pre>{@code
 * hierarchyGuard.requiring("KPI:APPROVE_CRITERIA", "verb.approve", "noun.kpi")
 * }</pre>
 */
@Component
@RequiredArgsConstructor
public class HierarchyAuthorityGuard {

    private final PermissionChecker permissionChecker;

    /**
     * @param permissionCode quyền cần có trong đơn vị của bản ghi
     * @param verb           key dịch của động từ ({@code verb.approve}, {@code verb.reject}, {@code verb.revertApproval})
     * @param noun           key dịch của danh từ chỉ đối tượng ({@code noun.kpi})
     */
    public TransitionGuard requiring(String permissionCode, String verb, String noun) {
        return requiring(permissionCode, verb, noun, noun);
    }

    /**
     * Bản đầy đủ cho những chỗ mà thông báo thiếu quyền dùng danh từ khác thông báo thiếu cấp bậc.
     * Chỉ tiêu là ví dụ: thông báo cũ viết "chỉ tiêu KPI" ở vế quyền nhưng chỉ "chỉ tiêu" ở vế cấp
     * bậc, và giữ đúng như vậy để giao diện không đổi chữ sau refactor.
     */
    public TransitionGuard requiring(String permissionCode, String verb, String noun, String permissionNoun) {
        return ctx -> {
            User actor = ctx.getActor();
            if (actor == null) return GuardResult.forbidden(ErrorCode.GUARD_ACTOR_UNKNOWN);

            UUID actorId = actor.getId();
            UUID orgUnitId = ctx.getOrgUnitId();

            // Quản trị toàn hệ thống đi thẳng, không vướng cấp bậc.
            if (orgUnitId != null && permissionChecker.isGlobalAdminIn(actorId, orgUnitId)) return GuardResult.ok();

            if (orgUnitId == null || !permissionChecker.hasPermissionInOrgUnit(actorId, permissionCode, orgUnitId)) {
                return GuardResult.forbidden(ErrorCode.GUARD_NO_PERMISSION_IN_UNIT, Terms.of(verb), Terms.of(permissionNoun));
            }

            UUID ownerId = ctx.getTargetOwnerId();
            if (ownerId == null) return GuardResult.ok();

            if (permissionChecker.isSuperiorTo(actorId, ownerId, orgUnitId)) return GuardResult.ok();

            return GuardResult.forbidden(explain(actorId, ownerId, orgUnitId), Terms.of(verb), Terms.of(noun));
        };
    }

    /** Nói rõ vì sao không đủ thẩm quyền: cấp bậc thấp hơn, cùng chức vụ, hay không phải cấp trên. */
    private ErrorCode explain(UUID actorId, UUID ownerId, UUID orgUnitId) {
        int ownerLevel = permissionChecker.getMinLevelInOrgUnit(ownerId, orgUnitId);
        int ownerRank = permissionChecker.getMinRankInOrgUnit(ownerId, orgUnitId);
        int actorLevel = permissionChecker.getMinLevelInOrgUnit(actorId, orgUnitId);
        int actorRank = permissionChecker.getMinRankInOrgUnit(actorId, orgUnitId);

        if (actorLevel > ownerLevel) {
            return ErrorCode.GUARD_OWNER_HIGHER_LEVEL;
        }
        if (actorLevel == ownerLevel && actorRank == ownerRank) {
            return ErrorCode.GUARD_OWNER_SAME_POSITION;
        }
        return ErrorCode.GUARD_NOT_SUPERIOR;
    }
}
