package com.kpitracking.service.kpi.approval;

import java.util.*;

/**
 * Lập chuỗi duyệt từ đường đi đơn vị (dưới lên gốc) — thuần logic, không đụng DB, để kiểm thử
 * từng luật một cách độc lập.
 *
 * <p>Luật:
 * <ol>
 *   <li>Người gửi là trưởng ở một đơn vị trên đường đi ⇒ chuỗi bắt đầu NGAY TRÊN đơn vị cao nhất
 *       mà họ làm trưởng. Nhờ vậy họ không bao giờ tự duyệt, và trưởng cấp dưới của họ cũng không
 *       lọt vào chuỗi duyệt việc của sếp mình.</li>
 *   <li>Mỗi đơn vị: người giữ bước là các trưởng (rank 0) còn hoạt động, có quyền duyệt, khác người
 *       gửi. Không có ai ⇒ bước {@code SKIPPED_NO_HEAD} kèm lý do, chuỗi đi tiếp lên cấp trên.</li>
 *   <li>Hai bước liền nhau có cùng nhóm người giữ (một người kiêm trưởng nhiều cấp) ⇒ gộp một bước.</li>
 *   <li>Người gửi là trưởng ở đơn vị GỐC ⇒ không còn cấp trên; các đồng trưởng ở gốc (nếu có) duyệt.
 *       Không còn ai thì chuỗi rỗng — phía gọi quyết định theo C3 (tự duyệt nếu có
 *       {@code KPI:APPROVE_OWN}, nếu không thì chuyển admin).</li>
 * </ol>
 */
public final class ApprovalChainPlanner {

    /** Key dịch của lý do bỏ qua bước (messages*.properties) — bước lưu key để hiển thị theo ngôn ngữ người xem. */
    public static final String REASON_NO_HEAD = "approval.skip.noHead";
    public static final String REASON_HEAD_INACTIVE = "approval.skip.headInactive";
    public static final String REASON_HEAD_NO_PERMISSION = "approval.skip.headNoPermission";

    private ApprovalChainPlanner() {}

    /** Một trưởng (rank 0) được gán trực tiếp tại đơn vị. */
    public record Head(UUID userId, String name, boolean active, boolean canApprove) {}

    /** Một đơn vị trên đường đi cùng các trưởng của nó. */
    public record UnitHeads(UUID unitId, String unitName, List<Head> heads) {}

    /**
     * Một bước đã lập. {@code skipReason != null} nghĩa là bước bỏ qua (không ai phải duyệt).
     * {@code mergedUnits} liệt kê các cấp PHÍA TRÊN đã gộp vào bước này.
     */
    public record PlannedStep(UUID unitId, String unitName, List<UnitHeads> mergedUnits,
                              List<Head> approvers, String skipReason) {
        public boolean actionable() {
            return skipReason == null;
        }

        Set<UUID> approverIds() {
            Set<UUID> ids = new HashSet<>();
            approvers.forEach(h -> ids.add(h.userId()));
            return ids;
        }
    }

    /**
     * @param requesterIsTopHead người gửi là trưởng ở đơn vị gốc (không còn cấp trên nào)
     */
    public record Plan(List<PlannedStep> steps, boolean requesterIsTopHead) {
        public boolean hasActionableStep() {
            return steps.stream().anyMatch(PlannedStep::actionable);
        }
    }

    /**
     * @param requesterId người gửi duyệt (người tạo chỉ tiêu, hoặc người xin điều chỉnh)
     * @param path        đơn vị của KPI rồi lần lượt các cấp cha tới gốc
     */
    public static Plan plan(UUID requesterId, List<UnitHeads> path) {
        int highestHeadIndex = -1;
        for (int i = 0; i < path.size(); i++) {
            if (path.get(i).heads().stream().anyMatch(h -> h.userId().equals(requesterId))) {
                highestHeadIndex = i;
            }
        }

        List<PlannedStep> steps = new ArrayList<>();
        int start = highestHeadIndex + 1;

        // Người gửi là trưởng ở gốc: chỉ còn đồng trưởng ở gốc (nếu có).
        if (!path.isEmpty() && start >= path.size()) {
            UnitHeads root = path.get(path.size() - 1);
            List<Head> peers = eligible(root, requesterId);
            if (!peers.isEmpty()) {
                steps.add(new PlannedStep(root.unitId(), root.unitName(), new ArrayList<>(), peers, null));
            }
            return new Plan(steps, true);
        }

        for (int i = start; i < path.size(); i++) {
            UnitHeads unit = path.get(i);
            List<Head> approvers = eligible(unit, requesterId);
            if (approvers.isEmpty()) {
                steps.add(new PlannedStep(unit.unitId(), unit.unitName(), List.of(), List.of(),
                        skipReason(unit, requesterId)));
                continue;
            }

            PlannedStep last = steps.isEmpty() ? null : steps.get(steps.size() - 1);
            Set<UUID> ids = new HashSet<>();
            approvers.forEach(h -> ids.add(h.userId()));
            if (last != null && last.actionable() && last.approverIds().equals(ids)) {
                last.mergedUnits().add(unit);
                continue;
            }
            steps.add(new PlannedStep(unit.unitId(), unit.unitName(), new ArrayList<>(), approvers, null));
        }
        return new Plan(steps, false);
    }

    private static List<Head> eligible(UnitHeads unit, UUID requesterId) {
        return unit.heads().stream()
                .filter(h -> !h.userId().equals(requesterId))
                .filter(Head::active)
                .filter(Head::canApprove)
                .toList();
    }

    private static String skipReason(UnitHeads unit, UUID requesterId) {
        List<Head> others = unit.heads().stream().filter(h -> !h.userId().equals(requesterId)).toList();
        if (others.isEmpty()) return REASON_NO_HEAD;
        if (others.stream().noneMatch(Head::active)) return REASON_HEAD_INACTIVE;
        return REASON_HEAD_NO_PERMISSION;
    }
}
