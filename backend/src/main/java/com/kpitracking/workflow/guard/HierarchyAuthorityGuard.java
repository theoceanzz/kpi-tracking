package com.kpitracking.workflow.guard;

import com.kpitracking.entity.User;
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
 * hierarchyGuard.requiring("KPI:APPROVE_CRITERIA", "phê duyệt", "chỉ tiêu")
 * }</pre>
 */
@Component
@RequiredArgsConstructor
public class HierarchyAuthorityGuard {

    private final PermissionChecker permissionChecker;

    /**
     * @param permissionCode quyền cần có trong đơn vị của bản ghi
     * @param verb           động từ tiếng Việt của hành động ("phê duyệt", "từ chối", "hoàn duyệt")
     * @param noun           danh từ chỉ đối tượng ("chỉ tiêu", "bản nộp")
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
            if (actor == null) return GuardResult.forbidden("Không xác định được người thực hiện");

            UUID actorId = actor.getId();
            UUID orgUnitId = ctx.getOrgUnitId();

            // Quản trị toàn hệ thống đi thẳng, không vướng cấp bậc.
            if (permissionChecker.isGlobalAdmin(actorId)) return GuardResult.ok();

            if (orgUnitId == null || !permissionChecker.hasPermissionInOrgUnit(actorId, permissionCode, orgUnitId)) {
                return GuardResult.forbidden("Bạn không có quyền " + verb + " " + permissionNoun + " cho đơn vị này");
            }

            UUID ownerId = ctx.getTargetOwnerId();
            if (ownerId == null) return GuardResult.ok();

            if (permissionChecker.isSuperiorTo(actorId, ownerId, orgUnitId)) return GuardResult.ok();

            return GuardResult.forbidden(explain(actorId, ownerId, orgUnitId, verb, noun));
        };
    }

    /**
     * Nói rõ vì sao không đủ thẩm quyền. Giữ nguyên ba thông báo cũ để người dùng không thấy hệ
     * thống bỗng đổi giọng sau refactor.
     */
    private String explain(UUID actorId, UUID ownerId, UUID orgUnitId, String verb, String noun) {
        int ownerLevel = permissionChecker.getMinLevelInOrgUnit(ownerId, orgUnitId);
        int ownerRank = permissionChecker.getMinRankInOrgUnit(ownerId, orgUnitId);
        int actorLevel = permissionChecker.getMinLevelInOrgUnit(actorId, orgUnitId);
        int actorRank = permissionChecker.getMinRankInOrgUnit(actorId, orgUnitId);

        if (actorLevel > ownerLevel) {
            return "Bạn không thể " + verb + " " + noun + " của người có cấp bậc cao hơn bạn";
        }
        if (actorLevel == ownerLevel && actorRank == ownerRank) {
            return "Bạn không thể " + verb + " " + noun + " của người có cùng chức vụ";
        }
        return "Bạn không đủ thẩm quyền để " + verb + " " + noun + " này";
    }
}
