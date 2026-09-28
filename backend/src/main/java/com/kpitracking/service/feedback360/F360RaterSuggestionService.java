package com.kpitracking.service.feedback360;

import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.entity.*;
import com.kpitracking.enums.F360AssignmentStatus;
import com.kpitracking.enums.F360RaterSource;
import com.kpitracking.enums.F360Relationship;
import com.kpitracking.repository.F360AssignmentRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Đề xuất người chấm từ cây tổ chức (§5).
 *
 * <p>Nạp một lần toàn bộ phân công của tổ chức rồi làm việc trong bộ nhớ — chiến dịch toàn công ty
 * có hàng nghìn phiếu, hỏi DB theo từng người là N+1 ngay giữa thao tác của HR.
 *
 * <p>rank: 0 = trưởng, 1 = phó, ≥ 2 = nhân viên. Trưởng và phó cùng là lãnh đạo đơn vị (khớp
 * {@code ManagerContextResolver}), nhưng trong 360 phó vẫn có cấp trên trực tiếp là trưởng cùng đơn vị.
 */
@Service
@RequiredArgsConstructor
public class F360RaterSuggestionService {

    private static final int MAX_ANCESTOR_WALK = 10;

    private final OrgUnitRepository orgUnitRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final F360AssignmentRepository assignmentRepository;

    /** Một thành viên của một đơn vị. */
    public record Member(User user, int rank) {}

    /** Ảnh chụp cây tổ chức đủ cho việc chọn người chấm. */
    public static final class OrgSnapshot {
        final Map<UUID, OrgUnit> units = new HashMap<>();
        final Map<UUID, UUID> parentOf = new HashMap<>();
        final Map<UUID, List<UUID>> childrenOf = new HashMap<>();
        final Map<UUID, List<Member>> membersOf = new HashMap<>();
        /** Đơn vị chính + hạng của từng người: phân công có rank nhỏ nhất. */
        final Map<UUID, UUID> primaryUnitOf = new HashMap<>();
        final Map<UUID, Integer> primaryRankOf = new HashMap<>();
        final Map<UUID, User> users = new HashMap<>();

        public OrgUnit primaryUnit(UUID userId) {
            UUID id = primaryUnitOf.get(userId);
            return id == null ? null : units.get(id);
        }

        public Integer primaryRank(UUID userId) {
            return primaryRankOf.get(userId);
        }

        public User user(UUID userId) {
            return users.get(userId);
        }
    }

    /** Kết quả gợi ý cho một người: danh sách (người chấm, quan hệ) + cảnh báo. */
    public record Suggestion(List<Map.Entry<User, F360Relationship>> raters, List<String> warnings) {}

    public OrgSnapshot snapshot(UUID organizationId) {
        OrgSnapshot s = new OrgSnapshot();
        List<OrgUnit> units = orgUnitRepository.findByOrgHierarchyLevel_Organization_IdAndDeletedAtIsNull(organizationId);
        for (OrgUnit u : units) {
            s.units.put(u.getId(), u);
            if (u.getParent() != null) {
                s.parentOf.put(u.getId(), u.getParent().getId());
                s.childrenOf.computeIfAbsent(u.getParent().getId(), x -> new ArrayList<>()).add(u.getId());
            }
        }
        if (units.isEmpty()) return s;
        for (UserRoleOrgUnit a : userRoleOrgUnitRepository.findByOrgUnitIdIn(s.units.keySet())) {
            User user = a.getUser();
            if (user == null || a.getOrgUnit() == null || a.getRole() == null) continue;
            if (user.getDeletedAt() != null || user.isPausedAccount()) continue;
            int rank = a.getRole().getRank() == null ? 2 : a.getRole().getRank();
            UUID unitId = a.getOrgUnit().getId();
            s.membersOf.computeIfAbsent(unitId, x -> new ArrayList<>()).add(new Member(user, rank));
            s.users.put(user.getId(), user);
            Integer current = s.primaryRankOf.get(user.getId());
            if (current == null || rank < current) {
                s.primaryRankOf.put(user.getId(), rank);
                s.primaryUnitOf.put(user.getId(), unitId);
            }
        }
        return s;
    }

    /** Số phiếu PEER/DIRECT_REPORT/OTHER mỗi người chấm đang giữ trong chiến dịch (§5.3). */
    public Map<UUID, Integer> currentLoad(UUID campaignId) {
        Map<UUID, Integer> load = new HashMap<>();
        for (F360Assignment a : assignmentRepository.findByCampaignId(campaignId)) {
            if (a.getStatus() == F360AssignmentStatus.REMOVED || !countsTowardCap(a.getRelationship())) continue;
            load.merge(a.getRater().getId(), 1, Integer::sum);
        }
        return load;
    }

    /** Chỉ các phiếu "tuỳ chọn" mới tính vào trần: SELF không đếm, MANAGER không ai thay được. */
    public static boolean countsTowardCap(F360Relationship r) {
        return r == F360Relationship.PEER || r == F360Relationship.DIRECT_REPORT || r == F360Relationship.OTHER;
    }

    /**
     * Gợi ý người chấm cho một người được đánh giá. {@code load} được CẬP NHẬT tại chỗ để các lượt
     * gợi ý tiếp theo trong cùng chiến dịch thấy tải đã giao.
     */
    public Suggestion suggest(OrgSnapshot org, User subject, boolean includeSelf, int threshold,
                              F360Settings.RaterRules rules, Map<UUID, Integer> load, Random random) {
        List<String> warnings = new ArrayList<>();
        Map<UUID, F360Relationship> chosen = new LinkedHashMap<>();
        UUID subjectId = subject.getId();
        UUID unitId = org.primaryUnitOf.get(subjectId);
        int rank = org.primaryRankOf.getOrDefault(subjectId, 2);

        if (includeSelf) chosen.put(subjectId, F360Relationship.SELF);
        if (unitId == null) {
            warnings.add(ErrorMessages.text("f360.suggest.noUnit", ""));
            return toSuggestion(org, chosen, warnings);
        }

        // ── Cấp trên ──
        User manager = findManager(org, unitId, rank, subjectId);
        if (manager != null) {
            chosen.putIfAbsent(manager.getId(), F360Relationship.MANAGER);
        } else {
            warnings.add(ErrorMessages.text("f360.suggest.noManager", ""));
        }

        // ── Cấp dưới: trưởng lấy đủ các phó trước, rồi lấy mẫu phần còn lại ──
        if (rank <= 1) {
            List<User> required = new ArrayList<>();
            List<User> pool = new ArrayList<>();
            for (Member m : org.membersOf.getOrDefault(unitId, List.of())) {
                if (m.user().getId().equals(subjectId)) continue;
                if (rank == 0 && m.rank() == 1) required.add(m.user());
                else if (m.rank() >= 2) pool.add(m.user());
            }
            if (rank == 0) {
                for (UUID child : org.childrenOf.getOrDefault(unitId, List.of())) {
                    org.membersOf.getOrDefault(child, List.of()).stream()
                            .filter(m -> m.rank() == 0).forEach(m -> pool.add(m.user()));
                }
            }
            int picked = pickInto(chosen, required, F360Relationship.DIRECT_REPORT, Integer.MAX_VALUE, rules, load, random, false);
            int remaining = Math.max(0, rules.maxDirectReports() - picked);
            picked += pickInto(chosen, pool, F360Relationship.DIRECT_REPORT, remaining, rules, load, random, true);
            if (picked > 0 && picked < threshold) {
                warnings.add(ErrorMessages.text("f360.suggest.fewReports", "", picked, threshold));
            }
        }

        // ── Đồng nghiệp ──
        List<User> peers = new ArrayList<>();
        if (rank == 0) {
            UUID parent = org.parentOf.get(unitId);
            if (parent != null) {
                for (UUID sibling : org.childrenOf.getOrDefault(parent, List.of())) {
                    if (sibling.equals(unitId)) continue;
                    org.membersOf.getOrDefault(sibling, List.of()).stream()
                            .filter(m -> m.rank() == 0).forEach(m -> peers.add(m.user()));
                }
            }
        } else {
            org.membersOf.getOrDefault(unitId, List.of()).stream()
                    .filter(m -> m.rank() == rank && !m.user().getId().equals(subjectId))
                    .forEach(m -> peers.add(m.user()));
        }
        int peerCount = pickInto(chosen, peers, F360Relationship.PEER, rules.maxPeers(), rules, load, random, true);
        if (peerCount == 0) {
            warnings.add(ErrorMessages.text("f360.suggest.noPeers", ""));
        } else if (peerCount < threshold) {
            warnings.add(ErrorMessages.text("f360.suggest.fewPeers", "", peerCount, threshold));
        }

        return toSuggestion(org, chosen, warnings);
    }

    /** Cấp trên trực tiếp của một người theo luật §5.2; null nếu không có (vd giám đốc cao nhất). */
    public User managerOf(OrgSnapshot org, UUID userId) {
        UUID unitId = org.primaryUnitOf.get(userId);
        if (unitId == null) return null;
        return findManager(org, unitId, org.primaryRankOf.getOrDefault(userId, 2), userId);
    }

    /** Quan hệ suy ra cho người được ĐỀ CỬ: cùng đơn vị chính và cùng hạng ⇒ đồng nghiệp, còn lại là phối hợp. */
    public F360Relationship inferNominee(OrgSnapshot org, UUID subjectId, UUID nomineeId) {
        UUID su = org.primaryUnitOf.get(subjectId);
        UUID nu = org.primaryUnitOf.get(nomineeId);
        if (su != null && su.equals(nu)
                && Objects.equals(org.primaryRankOf.get(subjectId), org.primaryRankOf.get(nomineeId))) {
            return F360Relationship.PEER;
        }
        return F360Relationship.OTHER;
    }

    /**
     * Cấp trên trực tiếp:
     * nhân viên → trưởng đơn vị, không có thì phó; phó → trưởng cùng đơn vị; trưởng → lên đơn vị cha.
     * Không có ai ở đơn vị thì leo tiếp lên cha (trưởng, rồi phó).
     */
    User findManager(OrgSnapshot org, UUID unitId, int rank, UUID subjectId) {
        UUID current = unitId;
        boolean firstLevel = true;
        for (int i = 0; current != null && i < MAX_ANCESTOR_WALK; i++) {
            List<Member> members = org.membersOf.getOrDefault(current, List.of());
            if (!(firstLevel && rank == 0)) {
                Optional<User> head = leader(members, 0, subjectId);
                if (head.isPresent()) return head.get();
                // Phó chỉ làm cấp trên cho NHÂN VIÊN cùng đơn vị, hoặc khi leo lên cha mà cha trống trưởng.
                if (!(firstLevel && rank == 1)) {
                    Optional<User> deputy = leader(members, 1, subjectId);
                    if (deputy.isPresent()) return deputy.get();
                }
            }
            firstLevel = false;
            current = org.parentOf.get(current);
        }
        return null;
    }

    private Optional<User> leader(List<Member> members, int rank, UUID exclude) {
        return members.stream()
                .filter(m -> m.rank() == rank && !m.user().getId().equals(exclude))
                .map(Member::user)
                .min(Comparator.comparing(u -> u.getFullName() == null ? "" : u.getFullName()));
    }

    /**
     * Chọn tối đa {@code max} người từ {@code candidates} chưa được chọn. Người tải thấp đi trước,
     * cùng tải thì ngẫu nhiên. {@code respectCap} = bỏ qua người đã chạm trần phiếu.
     */
    private int pickInto(Map<UUID, F360Relationship> chosen, List<User> candidates, F360Relationship rel,
                         int max, F360Settings.RaterRules rules, Map<UUID, Integer> load, Random random,
                         boolean respectCap) {
        List<User> pool = candidates.stream()
                .filter(u -> !chosen.containsKey(u.getId()))
                .collect(Collectors.toMap(User::getId, u -> u, (a, b) -> a, LinkedHashMap::new))
                .values().stream().collect(Collectors.toCollection(ArrayList::new));
        Collections.shuffle(pool, random);
        pool.sort(Comparator.comparingInt(u -> load.getOrDefault(u.getId(), 0)));
        int picked = 0;
        for (User u : pool) {
            if (picked >= max) break;
            int current = load.getOrDefault(u.getId(), 0);
            if (respectCap && countsTowardCap(rel) && current >= rules.maxAssignmentsPerRater()) continue;
            chosen.put(u.getId(), rel);
            if (countsTowardCap(rel)) load.put(u.getId(), current + 1);
            picked++;
        }
        return picked;
    }

    private Suggestion toSuggestion(OrgSnapshot org, Map<UUID, F360Relationship> chosen, List<String> warnings) {
        List<Map.Entry<User, F360Relationship>> raters = new ArrayList<>();
        chosen.forEach((id, rel) -> {
            User u = org.users.get(id);
            if (u != null) raters.add(Map.entry(u, rel));
        });
        return new Suggestion(raters, warnings);
    }

    /** Tạo phiếu AUTO từ một gợi ý. */
    public List<F360Assignment> toAssignments(F360Subject subject, Suggestion suggestion) {
        List<F360Assignment> out = new ArrayList<>();
        for (Map.Entry<User, F360Relationship> e : suggestion.raters()) {
            out.add(F360Assignment.builder()
                    .subject(subject)
                    .rater(e.getKey())
                    .relationship(e.getValue())
                    .source(F360RaterSource.AUTO)
                    .status(F360AssignmentStatus.PENDING)
                    .build());
        }
        return out;
    }
}
