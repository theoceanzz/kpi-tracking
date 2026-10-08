package com.kpitracking.service.approvalprocess;

import com.kpitracking.entity.*;
import com.kpitracking.enums.ApprovalObjectType;
import com.kpitracking.enums.ApprovalSubjectType;
import com.kpitracking.repository.ApprovalProcessRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.approvalprocess.ProcessGraph.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;

/**
 * Lập các bước duyệt theo quy trình của tổ chức, lúc gửi duyệt.
 *
 * <ol>
 *   <li>Chọn quy trình: quy trình đang bật của đối tượng, ưu tiên quy trình liệt kê đúng đối tượng
 *       con; không có thì quy trình "Tất cả". Không có quy trình nào ⇒ rỗng, phía gọi đi chuỗi
 *       trưởng đơn vị mặc định.</li>
 *   <li>Đi sơ đồ từ Bắt đầu: điều kiện xét trên {@link ApprovalSubjectFacts} để rẽ nhánh, mỗi bước
 *       duyệt gặp trên đường thành một bước của chuỗi.</li>
 *   <li>Tìm người giữ từng bước theo các mục người duyệt; luôn bỏ người gửi và tài khoản đã dừng.
 *       Bước không còn ai ⇒ bước bỏ qua kèm lý do (giống đơn vị không có trưởng ở chuỗi mặc định).</li>
 * </ol>
 */
@Component
@RequiredArgsConstructor
public class ApprovalProcessPlanner {

    public static final String REASON_NO_APPROVER = "approval.skip.processNoApprover";

    private final ApprovalProcessRepository processRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final UserRepository userRepository;
    private final ProcessGraphCodec codec;

    public record Holder(UUID userId, String name) {}

    /** {@code skipReason != null}: bước không có ai giữ, bị bỏ qua. */
    public record PlannedStep(String nodeId, String code, String name, List<Holder> approvers, String skipReason) {
        public boolean actionable() {
            return skipReason == null;
        }
    }

    /** @param snapshot ghi vào {@code kpi_approval_flows.process_snapshot} */
    public record ProcessPlan(UUID processId, String title, List<PlannedStep> steps, Map<String, Object> snapshot) {
        public boolean hasActionableStep() {
            return steps.stream().anyMatch(PlannedStep::actionable);
        }
    }

    /** Đường đi qua sơ đồ: các node bước duyệt theo thứ tự, và mọi node đã đi qua. */
    public record Walk(List<Node> steps, List<String> pathNodeIds) {}

    public Optional<ProcessPlan> plan(ApprovalSubjectType type, KpiCriteria kpi, KpiAdjustmentRequest adjustment,
                                      User requester) {
        UUID orgId = PermissionChecker.organizationIdOf(kpi.getOrgUnit());
        if (orgId == null) return Optional.empty();
        ApprovalObjectType objectType = ApprovalObjectType.of(type);

        Set<UUID> requesterRoles = new HashSet<>();
        Instant now = Instant.now();
        for (UserRoleOrgUnit a : userRoleOrgUnitRepository.findByUserId(requester.getId())) {
            if (a.getExpiresAt() != null && !a.getExpiresAt().isAfter(now)) continue;
            if (a.getRole() != null && a.getRole().getDeletedAt() == null) requesterRoles.add(a.getRole().getId());
        }
        ApprovalSubjectFacts facts = ApprovalSubjectFacts.of(kpi,
                type == ApprovalSubjectType.ADJUSTMENT ? adjustment : null, requester, requesterRoles);

        Optional<ApprovalProcess> chosen = select(
                processRepository.findByOrganizationIdAndObjectTypeAndActiveTrue(orgId, objectType), facts.subObject());
        if (chosen.isEmpty()) return Optional.empty();
        ApprovalProcess process = chosen.get();
        Optional<ProcessGraph> graph = codec.tryRead(process.getDefinition());
        if (graph.isEmpty()) return Optional.empty();

        Walk walk = walk(graph.get(), facts);
        // Sơ đồ đã kiểm lúc lưu nên luôn có bước; phòng hờ dữ liệu cũ hỏng thì lui về chuỗi mặc định.
        if (walk.steps().isEmpty()) return Optional.empty();

        Map<String, String> codes = graph.get().stepCodes();
        Resolver resolver = new Resolver(kpi.getOrgUnit(), requester.getId());
        List<PlannedStep> steps = new ArrayList<>();
        for (Node n : walk.steps()) {
            List<Holder> holders = resolver.resolve(n.approversOrEmpty());
            steps.add(new PlannedStep(n.id(), codes.get(n.id()), n.name(), holders,
                    holders.isEmpty() ? REASON_NO_APPROVER : null));
        }

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("showInObject", process.isShowInObject());
        snapshot.put("pathNodeIds", walk.pathNodeIds());
        if (process.isShowInObject()) snapshot.put("graph", codec.toMap(graph.get()));
        return Optional.of(new ProcessPlan(process.getId(), process.getTitle(), steps, snapshot));
    }

    /**
     * Quy trình áp dụng: đúng đối tượng con trước, rồi tới quy trình "Tất cả" (danh sách rỗng).
     * Lúc lưu đã chặn trùng nên mỗi nhóm nhiều nhất một quy trình; vẫn sắp theo thời điểm tạo để
     * kết quả ổn định nếu dữ liệu cũ lỡ trùng.
     */
    public static Optional<ApprovalProcess> select(List<ApprovalProcess> active, String subObject) {
        Comparator<ApprovalProcess> oldestFirst = Comparator.comparing(
                (ApprovalProcess p) -> p.getCreatedAt() == null ? Instant.EPOCH : p.getCreatedAt());
        Optional<ApprovalProcess> specific = active.stream()
                .filter(p -> subObject != null && p.subObjectsOrEmpty().contains(subObject))
                .min(oldestFirst);
        if (specific.isPresent()) return specific;
        return active.stream().filter(p -> p.subObjectsOrEmpty().isEmpty()).min(oldestFirst);
    }

    /** Đi sơ đồ từ Bắt đầu theo điều kiện. Dừng ở Đã duyệt, Không duyệt, hoặc bước không nối tiếp. */
    public static Walk walk(ProcessGraph graph, ApprovalSubjectFacts facts) {
        Map<String, Node> byId = graph.byId();
        List<Node> steps = new ArrayList<>();
        List<String> path = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        Node current = graph.start().orElse(null);
        while (current != null && seen.add(current.id())) {
            path.add(current.id());
            Optional<Edge> next = switch (current.type()) {
                case START -> graph.out(current.id(), Branch.NEXT);
                case CONDITION -> graph.out(current.id(),
                        ApprovalConditionEvaluator.matches(current.groupsOrEmpty(), facts) ? Branch.YES : Branch.NO);
                case STEP -> {
                    steps.add(current);
                    yield graph.out(current.id(), Branch.NEXT);
                }
                case APPROVED, REJECTED -> Optional.empty();
            };
            current = next.map(e -> byId.get(e.target())).orElse(null);
        }
        return new Walk(steps, path);
    }

    /** Tìm người giữ bước trong phạm vi MỘT lần lập chuỗi (nhớ tạm theo đơn vị). */
    private final class Resolver {
        private final List<OrgUnit> path = new ArrayList<>();
        private final UUID requesterId;
        private final Map<UUID, List<UserRoleOrgUnit>> assignmentsByUnit = new HashMap<>();
        private final Instant now = Instant.now();

        Resolver(OrgUnit unit, UUID requesterId) {
            this.requesterId = requesterId;
            Set<UUID> guard = new HashSet<>();
            for (OrgUnit u = unit; u != null && guard.add(u.getId()); u = u.getParent()) {
                if (u.getDeletedAt() == null) path.add(u);
            }
        }

        List<Holder> resolve(List<ApproverSpec> specs) {
            Map<UUID, Holder> out = new LinkedHashMap<>();
            for (ApproverSpec spec : specs) {
                if (spec == null || spec.type() == null) continue;
                List<User> users = switch (spec.type()) {
                    case USER -> userOf(spec.userId());
                    case ROLE -> nearestHoldersOfRole(spec.roleId());
                    case ORG_UNIT_HEAD -> headsOf(spec.orgUnitId());
                    case REQUESTER_MANAGER -> manager(spec.levelsUp() == null ? 0 : spec.levelsUp());
                };
                for (User u : users) out.putIfAbsent(u.getId(), new Holder(u.getId(), u.getFullName()));
            }
            return new ArrayList<>(out.values());
        }

        private boolean eligible(User u) {
            return u != null && u.getDeletedAt() == null && !u.isPausedAccount() && !u.getId().equals(requesterId);
        }

        private List<UserRoleOrgUnit> activeAssignments(UUID unitId) {
            return assignmentsByUnit.computeIfAbsent(unitId, id -> userRoleOrgUnitRepository.findByOrgUnitId(id).stream()
                    .filter(a -> a.getExpiresAt() == null || a.getExpiresAt().isAfter(now))
                    .filter(a -> a.getRole() != null && a.getRole().getDeletedAt() == null)
                    .filter(a -> a.getUser() != null)
                    .toList());
        }

        private List<User> distinctEligible(List<UserRoleOrgUnit> assignments) {
            Map<UUID, User> out = new LinkedHashMap<>();
            for (UserRoleOrgUnit a : assignments) {
                if (eligible(a.getUser())) out.putIfAbsent(a.getUser().getId(), a.getUser());
            }
            return new ArrayList<>(out.values());
        }

        private List<User> userOf(UUID userId) {
            if (userId == null) return List.of();
            return userRepository.findById(userId).filter(this::eligible).map(List::of).orElse(List.of());
        }

        /** Người giữ chức vụ ở đơn vị gần nhất (từ đơn vị của KPI lên gốc) còn người hợp lệ. */
        private List<User> nearestHoldersOfRole(UUID roleId) {
            if (roleId == null) return List.of();
            for (OrgUnit u : path) {
                List<User> holders = distinctEligible(activeAssignments(u.getId()).stream()
                        .filter(a -> roleId.equals(a.getRole().getId())).toList());
                if (!holders.isEmpty()) return holders;
            }
            return List.of();
        }

        private List<User> headsOf(UUID unitId) {
            if (unitId == null) return List.of();
            return distinctEligible(activeAssignments(unitId).stream()
                    .filter(a -> Objects.equals(a.getRole().getRank(), 0)).toList());
        }

        private boolean isHeadAt(OrgUnit u, UUID userId) {
            return activeAssignments(u.getId()).stream()
                    .anyMatch(a -> Objects.equals(a.getRole().getRank(), 0) && a.getUser().getId().equals(userId));
        }

        /**
         * Trưởng trực tiếp ({@code levelsUp = 0}) hoặc cấp trên n bậc, cùng luật với chuỗi mặc định:
         * bắt đầu ngay trên đơn vị cao nhất mà người gửi làm trưởng, bỏ qua đơn vị không có trưởng,
         * và một người kiêm trưởng nhiều cấp liền nhau chỉ tính một bậc.
         */
        private List<User> manager(int levelsUp) {
            int highestHead = -1;
            for (int i = 0; i < path.size(); i++) {
                if (isHeadAt(path.get(i), requesterId)) highestHead = i;
            }
            int found = -1;
            Set<UUID> previous = Set.of();
            for (int i = highestHead + 1; i < path.size(); i++) {
                List<User> heads = headsOf(path.get(i).getId());
                if (heads.isEmpty()) continue;
                Set<UUID> ids = new HashSet<>();
                heads.forEach(h -> ids.add(h.getId()));
                if (ids.equals(previous)) continue;
                previous = ids;
                if (++found == levelsUp) return heads;
            }
            return List.of();
        }
    }
}
