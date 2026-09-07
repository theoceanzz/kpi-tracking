package com.kpitracking.service;

import com.kpitracking.constant.ConductConstants;
import com.kpitracking.dto.request.conduct.ConductCriteriaRequest;
import com.kpitracking.dto.request.conduct.ConductScoreRequest;
import com.kpitracking.dto.request.conduct.ConductSetRequest;
import com.kpitracking.dto.response.conduct.*;
import com.kpitracking.entity.*;
import com.kpitracking.enums.ConductScope;
import com.kpitracking.enums.ConductStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.*;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.util.ConductAxisResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/**
 * Chấm hạnh kiểm ("Đánh giá xếp loại hành vi theo triết lý giáo dục").
 *
 * Mỗi tổ chức có NHIỀU bộ tiêu chí kèm trọng số (bộ đầu tiên: 4 tiêu chí × 25%), mỗi bộ
 * gán cho một số KỲ — kỳ không được gán thì dùng bộ mặc định. Cùng khuôn với hồ sơ luật
 * của "xếp loại đơn vị". Mỗi người, trong mỗi ĐỢT hoặc mỗi KỲ, có một phiếu: tự chấm +
 * nêu dẫn chứng, cán bộ quản lý trực tiếp chấm + nhận xét. Điểm tổng = Σ(điểm × trọng số/100).
 *
 * Điểm này lấp trục còn thiếu của ma trận xếp loại hiệu quả — xem {@link ConductAxisResolver}.
 */
@Service
@RequiredArgsConstructor
public class ConductService {

    private final ConductCriteriaRepository conductCriteriaRepository;
    private final ConductCriteriaSetRepository conductCriteriaSetRepository;
    private final ConductEvaluationRepository conductEvaluationRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final KpiCycleRepository kpiCycleRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final PermissionChecker permissionChecker;
    private final com.kpitracking.service.kpi.CycleLockChecker cycleLockChecker;

    // ============================================================
    // CẤU HÌNH BỘ TIÊU CHÍ
    // ============================================================

    @Transactional(readOnly = true)
    public ConductConfigResponse getConfig(UUID organizationId) {
        Organization org = requireOrg(organizationId);
        return toConfigResponse(org, listSets(org));
    }

    /**
     * Tạo một bộ mới. Không gửi {@code criteria} thì CHÉP từ {@code copyFromSetId} (mặc
     * định là bộ mặc định): dựng bộ cho kỳ mới gần như luôn bắt đầu từ bộ đang dùng chứ
     * không phải từ bảng trắng.
     */
    @Transactional
    public ConductConfigResponse createSet(UUID organizationId, ConductSetRequest request) {
        Organization org = requireOrg(organizationId);
        List<ConductCriteriaSet> sets = listSets(org);

        ConductCriteriaSet source = request.getCopyFromSetId() != null
                ? requireSet(org, request.getCopyFromSetId())
                : sets.stream().filter(s -> Boolean.TRUE.equals(s.getIsDefault())).findFirst().orElse(null);

        Double maxScore = firstNonNull(request.getMaxScore(),
                source != null ? source.getMaxScore() : null,
                ConductConstants.DEFAULT_MAX_SCORE);

        ConductCriteriaSet set = conductCriteriaSetRepository.save(ConductCriteriaSet.builder()
                .organization(org)
                .name(uniqueName(sets, request.getName(), null))
                // Bộ đầu tiên của tổ chức phải là mặc định, nếu không mọi kỳ chưa gán sẽ không có bộ nào.
                .isDefault(sets.isEmpty())
                .maxScore(maxScore)
                .kpiCycleIds(new LinkedHashSet<>())
                .build());

        List<ConductCriteriaRequest> criteria = request.getCriteria() != null && !request.getCriteria().isEmpty()
                ? request.getCriteria()
                : copyOf(source);
        replaceCriteria(org, set, criteria);
        assignCycles(org, set, request.getKpiCycleIds());

        return toConfigResponse(org, listSets(org));
    }

    /**
     * Sửa một bộ. Trường để trống = giữ nguyên, nên giao diện gửi đúng phần vừa sửa.
     *
     * Tiêu chí cũ bị XOÁ MỀM chứ không xoá hẳn: các phiếu đã chấm còn trỏ vào chúng, và
     * bản chụp trong phiếu mới là thứ quyết định điểm — xoá cứng sẽ làm mất dấu vết.
     */
    @Transactional
    public ConductConfigResponse updateSet(UUID organizationId, UUID setId, ConductSetRequest request) {
        Organization org = requireOrg(organizationId);
        ConductCriteriaSet set = requireSet(org, setId);

        if (request.getName() != null && !request.getName().isBlank()) {
            set.setName(uniqueName(listSets(org), request.getName(), set.getId()));
        }
        if (request.getMaxScore() != null) set.setMaxScore(request.getMaxScore());
        conductCriteriaSetRepository.save(set);

        if (request.getCriteria() != null) replaceCriteria(org, set, request.getCriteria());
        if (request.getKpiCycleIds() != null) assignCycles(org, set, request.getKpiCycleIds());

        return toConfigResponse(org, listSets(org));
    }

    /**
     * Xoá mềm một bộ. Bộ mặc định không xoá được — các kỳ chưa gán sẽ không còn chỗ rơi về.
     * Kỳ của bộ bị xoá tự động quay về bộ mặc định (bảng nối xoá theo).
     */
    @Transactional
    public ConductConfigResponse deleteSet(UUID organizationId, UUID setId) {
        Organization org = requireOrg(organizationId);
        ConductCriteriaSet set = requireSet(org, setId);
        if (Boolean.TRUE.equals(set.getIsDefault())) {
            throw new BusinessException("Không thể xoá bộ mặc định. Hãy đặt một bộ khác làm mặc định trước.");
        }
        set.getKpiCycleIds().clear();
        set.setDeletedAt(Instant.now());
        conductCriteriaSetRepository.save(set);
        return toConfigResponse(org, listSets(org));
    }

    /** Đặt bộ này làm mặc định; bộ mặc định cũ thôi giữ vai trò đó (mỗi tổ chức đúng một bộ). */
    @Transactional
    public ConductConfigResponse markDefault(UUID organizationId, UUID setId) {
        Organization org = requireOrg(organizationId);
        ConductCriteriaSet target = requireSet(org, setId);
        List<ConductCriteriaSet> sets = listSets(org);
        // Gỡ cờ ở bộ cũ TRƯỚC rồi mới gắn cho bộ mới: unique index chỉ cho một bộ mặc định
        // còn sống, đảo thứ tự là vi phạm ngay khi flush.
        sets.stream()
                .filter(s -> Boolean.TRUE.equals(s.getIsDefault()) && !s.getId().equals(target.getId()))
                .forEach(s -> s.setIsDefault(false));
        conductCriteriaSetRepository.saveAll(sets);
        conductCriteriaSetRepository.flush();

        target.setIsDefault(true);
        // Bộ mặc định áp cho MỌI kỳ chưa gán riêng — giữ thêm danh sách kỳ chỉ gây hiểu nhầm
        // là nó chỉ có hiệu lực trong mấy kỳ đó.
        target.getKpiCycleIds().clear();
        conductCriteriaSetRepository.save(target);

        return toConfigResponse(org, listSets(org));
    }

    /**
     * Dựng bộ mặc định 4 tiêu chí NẾU tổ chức chưa có bộ nào. Bật/tắt tính năng nhiều lần
     * không được ghi đè bộ mà tổ chức đã tự sửa.
     */
    @Transactional
    public void ensureDefaultSet(Organization org) {
        // Xét theo TIÊU CHÍ chứ không theo số bộ: di cư dữ liệu có thể để lại một bộ mặc định
        // rỗng, mà bộ rỗng thì không mở được phiếu nào — đúng cảnh cần seed.
        boolean configured = listSets(org).stream().anyMatch(
                s -> !conductCriteriaRepository.findByCriteriaSetIdOrderByPositionAsc(s.getId()).isEmpty());
        if (configured) return;
        seedDefaultCriteria(org);
    }

    /** Bộ 4 tiêu chí mặc định — dùng khi tạo tổ chức và khi người dùng bấm "đặt lại". */
    @Transactional
    public List<ConductCriteria> seedDefaultCriteria(Organization org) {
        ConductCriteriaSet set = conductCriteriaSetRepository
                .findByOrganizationIdAndIsDefaultTrue(org.getId())
                .orElseGet(() -> conductCriteriaSetRepository.save(ConductCriteriaSet.builder()
                        .organization(org)
                        .name("Bộ mặc định")
                        .isDefault(true)
                        .maxScore(conductMaxScore(org))
                        .kpiCycleIds(new LinkedHashSet<>())
                        .build()));
        return seedDefaultCriteria(org, set);
    }

    private List<ConductCriteria> seedDefaultCriteria(Organization org, ConductCriteriaSet set) {
        List<ConductCriteria> defaults = ConductConstants.DEFAULT_CRITERIA.stream()
                .map(d -> ConductCriteria.builder()
                        .organization(org)
                        .criteriaSet(set)
                        .name(d.getName())
                        .description(d.getDescription())
                        .weight(d.getWeight())
                        .position(d.getPosition())
                        .build())
                .toList();
        return conductCriteriaRepository.saveAll(defaults);
    }

    /** Đặt lại MỘT bộ về 4 tiêu chí mặc định; bỏ trống setId thì đặt lại bộ mặc định. */
    @Transactional
    public ConductConfigResponse resetToDefault(UUID organizationId, UUID setId) {
        Organization org = requireOrg(organizationId);
        ConductCriteriaSet set = setId != null
                ? requireSet(org, setId)
                : conductCriteriaSetRepository.findByOrganizationIdAndIsDefaultTrue(org.getId()).orElse(null);
        if (set == null) {
            seedDefaultCriteria(org);
            return toConfigResponse(org, listSets(org));
        }

        softDeleteCriteria(set);
        set.setMaxScore(ConductConstants.DEFAULT_MAX_SCORE);
        conductCriteriaSetRepository.save(set);
        seedDefaultCriteria(org, set);
        return toConfigResponse(org, listSets(org));
    }

    // ── Nội bộ: bộ tiêu chí ─────────────────────────────────────────────────

    private List<ConductCriteriaSet> listSets(Organization org) {
        return new ArrayList<>(conductCriteriaSetRepository
                .findByOrganizationIdOrderByIsDefaultDescCreatedAtAsc(org.getId()));
    }

    private ConductCriteriaSet requireSet(Organization org, UUID setId) {
        ConductCriteriaSet set = conductCriteriaSetRepository.findById(setId)
                .orElseThrow(() -> new ResourceNotFoundException("Bộ tiêu chí hạnh kiểm", "id", setId));
        if (set.getOrganization() == null || !set.getOrganization().getId().equals(org.getId())) {
            throw new ForbiddenException("Bộ tiêu chí này không thuộc tổ chức của bạn");
        }
        return set;
    }

    /** Tên bộ phải phân biệt được — hai bộ trùng tên thì không ai biết kỳ đang chấm theo bộ nào. */
    private String uniqueName(List<ConductCriteriaSet> sets, String rawName, UUID selfId) {
        String name = rawName == null ? "" : rawName.trim();
        if (name.isEmpty()) throw new BusinessException("Tên bộ tiêu chí không được để trống");
        boolean taken = sets.stream()
                .anyMatch(s -> !s.getId().equals(selfId) && s.getName().equalsIgnoreCase(name));
        if (taken) throw new BusinessException("Đã có bộ tiêu chí tên \"" + name + "\"");
        return name;
    }

    private List<ConductCriteriaRequest> copyOf(ConductCriteriaSet source) {
        if (source == null) {
            return ConductConstants.DEFAULT_CRITERIA.stream()
                    .map(d -> ConductCriteriaRequest.builder()
                            .name(d.getName()).description(d.getDescription()).weight(d.getWeight()).build())
                    .toList();
        }
        return conductCriteriaRepository.findByCriteriaSetIdOrderByPositionAsc(source.getId()).stream()
                .map(c -> ConductCriteriaRequest.builder()
                        .name(c.getName()).description(c.getDescription()).weight(c.getWeight()).build())
                .toList();
    }

    /** Thay THẾ toàn bộ tiêu chí của một bộ; tổng trọng số phải bằng 100%. */
    private void replaceCriteria(Organization org, ConductCriteriaSet set, List<ConductCriteriaRequest> criteria) {
        if (criteria == null || criteria.isEmpty()) {
            throw new BusinessException("Bộ \"" + set.getName() + "\" cần ít nhất một tiêu chí");
        }
        double total = criteria.stream()
                .mapToDouble(c -> c.getWeight() != null ? c.getWeight() : 0.0).sum();
        if (Math.abs(total - 100.0) > 0.01) {
            throw new BusinessException("Tổng trọng số của bộ \"" + set.getName()
                    + "\" phải bằng 100% (hiện tại " + Math.round(total * 100.0) / 100.0 + "%)");
        }

        softDeleteCriteria(set);
        int position = 1;
        for (ConductCriteriaRequest req : criteria) {
            conductCriteriaRepository.save(ConductCriteria.builder()
                    .organization(org)
                    .criteriaSet(set)
                    .name(req.getName().trim())
                    .description(req.getDescription())
                    .weight(req.getWeight())
                    .position(position++)
                    .build());
        }
    }

    private void softDeleteCriteria(ConductCriteriaSet set) {
        List<ConductCriteria> existing = conductCriteriaRepository
                .findByCriteriaSetIdOrderByPositionAsc(set.getId());
        Instant now = Instant.now();
        existing.forEach(c -> c.setDeletedAt(now));
        conductCriteriaRepository.saveAll(existing);
        conductCriteriaRepository.flush();
    }

    /**
     * Gán kỳ cho bộ. Một kỳ chỉ thuộc MỘT bộ nên gán lại sẽ GỠ kỳ đó khỏi bộ đang giữ —
     * bắt người dùng tự đi bỏ gán ở bộ cũ chỉ tạo ra một bước thừa và trạng thái nửa vời.
     */
    private void assignCycles(Organization org, ConductCriteriaSet set, List<UUID> cycleIds) {
        if (Boolean.TRUE.equals(set.getIsDefault())) {
            if (cycleIds != null && !cycleIds.isEmpty()) {
                throw new BusinessException("Bộ mặc định đã áp cho mọi kỳ chưa gán, không cần chọn kỳ riêng");
            }
            set.getKpiCycleIds().clear();
            conductCriteriaSetRepository.save(set);
            return;
        }

        LinkedHashSet<UUID> wanted = new LinkedHashSet<>(cycleIds == null ? List.of() : cycleIds);
        for (UUID cycleId : wanted) {
            KpiCycle cycle = kpiCycleRepository.findById(cycleId)
                    .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá", "id", cycleId));
            if (cycle.getOrganization() == null || !cycle.getOrganization().getId().equals(org.getId())) {
                throw new ForbiddenException("Kỳ \"" + cycle.getName() + "\" không thuộc tổ chức của bạn");
            }
        }

        List<ConductCriteriaSet> stripped = new ArrayList<>();
        for (ConductCriteriaSet other : listSets(org)) {
            if (other.getId().equals(set.getId())) continue;
            if (other.getKpiCycleIds().removeAll(wanted)) stripped.add(other);
        }
        if (!stripped.isEmpty()) {
            conductCriteriaSetRepository.saveAll(stripped);
            // Bảng nối khoá chính trên kpi_cycle_id: chưa xoá hàng cũ mà đã chèn hàng mới
            // cho cùng một kỳ là đụng khoá ngay lúc flush.
            conductCriteriaSetRepository.flush();
        }

        set.getKpiCycleIds().clear();
        set.getKpiCycleIds().addAll(wanted);
        conductCriteriaSetRepository.save(set);
    }

    /**
     * Bộ tiêu chí dùng cho một đợt/kỳ: bộ được gán cho kỳ đó, không có thì bộ mặc định.
     * Phiếu theo ĐỢT lấy bộ của kỳ chứa đợt — đợt là một phần của kỳ, không có bộ riêng.
     */
    private ConductCriteriaSet resolveSet(Target t) {
        KpiCycle cycle = t.cycle() != null ? t.cycle()
                : (t.period() != null ? t.period().getKpiCycle() : null);
        UUID orgId = t.organization().getId();
        if (cycle != null) {
            var assigned = conductCriteriaSetRepository.findByCycle(orgId, cycle.getId());
            if (assigned.isPresent()) return assigned.get();
        }
        return conductCriteriaSetRepository.findByOrganizationIdAndIsDefaultTrue(orgId).orElse(null);
    }

    private static Double firstNonNull(Double... values) {
        for (Double v : values) if (v != null) return v;
        return ConductConstants.DEFAULT_MAX_SCORE;
    }

    // ============================================================
    // PHIẾU CHẤM
    // ============================================================

    /**
     * Phiếu của một người trong một đợt/kỳ. Chưa từng chấm thì vẫn trả về đủ dòng tiêu chí
     * dựng từ cấu hình (không ghi DB) — UI mở ra là chấm được ngay.
     */
    @Transactional(readOnly = true)
    public ConductSheetResponse getSheet(UUID userId, ConductScope scope, UUID kpiPeriodId, UUID kpiCycleId) {
        User current = getCurrentUser();
        UUID targetUserId = userId != null ? userId : current.getId();
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "id", targetUserId));

        Target t = resolveTarget(scope, kpiPeriodId, kpiCycleId);
        if (!targetUserId.equals(current.getId()) && !canEvaluate(current, target)) {
            throw new ForbiddenException("Bạn không có quyền xem phiếu hạnh kiểm của nhân sự này");
        }

        ConductEvaluation entity = findSheet(targetUserId, t);
        return entity != null
                ? toSheetResponse(entity, target, t, current)
                : blankSheet(target, t, current);
    }

    /** Nhân viên tự chấm: ghi cột điểm tự đánh giá và dẫn chứng. */
    @Transactional
    public ConductSheetResponse saveSelfScores(ConductScoreRequest request) {
        User current = getCurrentUser();
        UUID targetUserId = request.getUserId() != null ? request.getUserId() : current.getId();
        if (!targetUserId.equals(current.getId())) {
            throw new ForbiddenException("Chỉ chính chủ mới được nhập cột tự đánh giá");
        }
        Target t = resolveTarget(request.getScope(), request.getKpiPeriodId(), request.getKpiCycleId());
        assertNotLocked(current, t);

        ConductEvaluation entity = openSheet(current, t);
        applyScores(entity, request, true);
        entity.setSelfSubmittedAt(Instant.now());
        if (entity.getStatus() == ConductStatus.DRAFT) entity.setStatus(ConductStatus.SELF_SUBMITTED);
        conductEvaluationRepository.save(entity);

        return toSheetResponse(entity, current, t, current);
    }

    /** Cán bộ quản lý trực tiếp chấm: ghi cột điểm CBQLTT và nhận xét. */
    @Transactional
    public ConductSheetResponse saveManagerScores(ConductScoreRequest request) {
        User current = getCurrentUser();
        if (request.getUserId() == null) {
            throw new BusinessException("Thiếu nhân sự được chấm hạnh kiểm");
        }
        User target = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "id", request.getUserId()));
        if (!canScoreConduct(current, target)) {
            throw new ForbiddenException("Chỉ trưởng đơn vị mới được chấm hạnh kiểm cho nhân sự này");
        }
        Target t = resolveTarget(request.getScope(), request.getKpiPeriodId(), request.getKpiCycleId());
        assertNotLocked(target, t);

        ConductEvaluation entity = openSheet(target, t);
        applyScores(entity, request, false);
        if (request.getComment() != null) entity.setComment(request.getComment());
        entity.setEvaluator(current);
        entity.setEvaluatedAt(Instant.now());
        entity.setStatus(ConductStatus.REVIEWED);
        conductEvaluationRepository.save(entity);

        return toSheetResponse(entity, target, t, current);
    }

    /** Danh sách chấm của một đơn vị (gồm cả đơn vị con) trong một đợt/kỳ. */
    @Transactional(readOnly = true)
    public List<ConductSummaryResponse> listUnitSummary(UUID orgUnitId, ConductScope scope,
                                                        UUID kpiPeriodId, UUID kpiCycleId) {
        Target t = resolveTarget(scope, kpiPeriodId, kpiCycleId);
        OrgUnit unit = orgUnitRepository.findById(orgUnitId)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", orgUnitId));

        User current = getCurrentUser();
        if (!permissionChecker.hasPermissionInOrgUnit(current.getId(), "EVALUATION:VIEW", orgUnitId)
                && !permissionChecker.hasPermissionInOrgUnit(current.getId(), "EVALUATION:CREATE", orgUnitId)) {
            throw new ForbiddenException("Bạn không có quyền xem hạnh kiểm của đơn vị này");
        }

        List<UserRoleOrgUnit> assignments = subtreeAssignments(unit);
        List<UUID> userIds = assignments.stream()
                .map(a -> a.getUser().getId()).distinct().toList();
        if (userIds.isEmpty()) return List.of();

        Map<UUID, ConductEvaluation> sheets = new HashMap<>();
        List<ConductEvaluation> found = t.scope() == ConductScope.PERIOD
                ? conductEvaluationRepository.findByKpiPeriodIdAndUserIdIn(t.periodId(), userIds)
                : conductEvaluationRepository.findByKpiCycleIdAndUserIdIn(t.cycleId(), userIds);
        found.forEach(e -> sheets.put(e.getUser().getId(), e));

        // Người chưa có phiếu vẫn phải hiện đúng thang của kỳ đang xem, không phải thang mặc định.
        double orgMax = setMaxScore(resolveSet(t), t.organization());
        Map<UUID, ConductSummaryResponse> rows = new LinkedHashMap<>();
        for (UserRoleOrgUnit a : assignments) {
            User u = a.getUser();
            if (rows.containsKey(u.getId())) continue;
            ConductEvaluation sheet = sheets.get(u.getId());
            rows.put(u.getId(), ConductSummaryResponse.builder()
                    .userId(u.getId())
                    .userName(u.getFullName())
                    .userAvatarUrl(u.getAvatarUrl())
                    .roleName(a.getRole() != null ? a.getRole().getName() : null)
                    .orgUnitId(a.getOrgUnit() != null ? a.getOrgUnit().getId() : null)
                    .orgUnitName(a.getOrgUnit() != null ? a.getOrgUnit().getName() : null)
                    .status(sheet != null ? sheet.getStatus() : ConductStatus.DRAFT)
                    .selfScore(round(sheet != null ? sheet.getSelfScore() : null))
                    .managerScore(round(sheet != null ? sheet.getManagerScore() : null))
                    .maxScore(sheet != null && sheet.getMaxScore() != null ? sheet.getMaxScore() : orgMax)
                    .build());
        }
        return new ArrayList<>(rows.values());
    }

    // ============================================================
    // ĐIỂM DÙNG CHO MA TRẬN XẾP LOẠI
    // ============================================================

    /**
     * Điểm hạnh kiểm dùng để tra ma trận: ưu tiên điểm CBQLTT, chưa chấm thì lấy điểm tự chấm.
     * Trả {@code null} khi tổ chức tắt tính năng hoặc chưa có phiếu.
     */
    @Transactional(readOnly = true)
    public Double effectiveScore(UUID userId, ConductScope scope, UUID targetId, Organization org) {
        if (org == null || !Boolean.TRUE.equals(org.getEnableConduct())) return null;
        if (userId == null || targetId == null) return null;
        ConductEvaluation sheet = scope == ConductScope.PERIOD
                ? conductEvaluationRepository.findByUserIdAndKpiPeriodId(userId, targetId).orElse(null)
                : conductEvaluationRepository.findByUserIdAndKpiCycleId(userId, targetId).orElse(null);
        return effectiveScore(sheet);
    }

    /**
     * Thang điểm của phiếu đã chấm; chưa có phiếu thì lấy thang của BỘ mà đợt/kỳ này sẽ
     * dùng — không phải thang của bộ mặc định, vì mỗi kỳ có thể chấm theo thang riêng.
     */
    @Transactional(readOnly = true)
    public Double effectiveMaxScore(UUID userId, ConductScope scope, UUID targetId, Organization org) {
        if (org == null) return ConductConstants.DEFAULT_MAX_SCORE;
        ConductEvaluation sheet = userId == null || targetId == null ? null
                : (scope == ConductScope.PERIOD
                    ? conductEvaluationRepository.findByUserIdAndKpiPeriodId(userId, targetId).orElse(null)
                    : conductEvaluationRepository.findByUserIdAndKpiCycleId(userId, targetId).orElse(null));
        if (sheet != null && sheet.getMaxScore() != null) return sheet.getMaxScore();
        if (targetId == null) return conductMaxScore(org);
        try {
            return setMaxScore(resolveSet(resolveTarget(scope,
                    scope == ConductScope.PERIOD ? targetId : null,
                    scope == ConductScope.PERIOD ? null : targetId)), org);
        } catch (RuntimeException e) {
            // Đợt/kỳ đã bị xoá: chấm điểm không còn nữa nên thang nào cũng vô hại, đừng để
            // nó làm hỏng cả bảng đánh giá đang gọi tới.
            return conductMaxScore(org);
        }
    }

    private Double effectiveScore(ConductEvaluation sheet) {
        if (sheet == null) return null;
        return sheet.getManagerScore() != null ? sheet.getManagerScore() : sheet.getSelfScore();
    }

    // ============================================================
    // NỘI BỘ
    // ============================================================

    /** Đợt hoặc kỳ được chấm, kèm tổ chức sở hữu nó. */
    private record Target(ConductScope scope, UUID periodId, UUID cycleId,
                          String name, Organization organization,
                          KpiPeriod period, KpiCycle cycle) {}

    private Target resolveTarget(ConductScope scope, UUID kpiPeriodId, UUID kpiCycleId) {
        if (scope == ConductScope.PERIOD) {
            if (kpiPeriodId == null) throw new BusinessException("Thiếu đợt đánh giá");
            KpiPeriod period = kpiPeriodRepository.findById(kpiPeriodId)
                    .orElseThrow(() -> new ResourceNotFoundException("Đợt đánh giá", "id", kpiPeriodId));
            return new Target(scope, kpiPeriodId, null, period.getName(), period.getOrganization(), period, null);
        }
        if (kpiCycleId == null) throw new BusinessException("Thiếu kỳ đánh giá");
        KpiCycle cycle = kpiCycleRepository.findById(kpiCycleId)
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá", "id", kpiCycleId));
        return new Target(scope, null, kpiCycleId, cycle.getName(), cycle.getOrganization(), null, cycle);
    }

    private ConductEvaluation findSheet(UUID userId, Target t) {
        return t.scope() == ConductScope.PERIOD
                ? conductEvaluationRepository.findByUserIdAndKpiPeriodId(userId, t.periodId()).orElse(null)
                : conductEvaluationRepository.findByUserIdAndKpiCycleId(userId, t.cycleId()).orElse(null);
    }

    /** Lấy phiếu đang có, hoặc dựng phiếu mới từ bộ tiêu chí hiện hành (chụp tên/mô tả/trọng số). */
    private ConductEvaluation openSheet(User user, Target t) {
        ConductEvaluation existing = findSheet(user.getId(), t);
        if (existing != null) return existing;

        Organization org = t.organization();
        if (!Boolean.TRUE.equals(org.getEnableConduct())) {
            throw new BusinessException("Tổ chức chưa bật chấm hạnh kiểm");
        }
        ConductCriteriaSet set = resolveSet(t);
        List<ConductCriteria> criteria = set == null ? List.of()
                : conductCriteriaRepository.findByCriteriaSetIdOrderByPositionAsc(set.getId());
        if (criteria.isEmpty()) {
            throw new BusinessException("Kỳ này chưa có bộ tiêu chí hạnh kiểm nào được cấu hình");
        }

        ConductEvaluation sheet = ConductEvaluation.builder()
                .organization(org)
                .user(user)
                .criteriaSet(set)
                .scope(t.scope())
                .kpiPeriod(t.period())
                .kpiCycle(t.cycle())
                .status(ConductStatus.DRAFT)
                .maxScore(setMaxScore(set, org))
                .items(new ArrayList<>())
                .build();
        for (ConductCriteria c : criteria) {
            sheet.getItems().add(ConductEvaluationItem.builder()
                    .conductEvaluation(sheet)
                    .criteria(c)
                    .criteriaName(c.getName())
                    .criteriaDescription(c.getDescription())
                    .weight(c.getWeight())
                    .position(c.getPosition())
                    .build());
        }
        return conductEvaluationRepository.save(sheet);
    }

    /** Ghi điểm vào MỘT phía của phiếu rồi cộng lại điểm tổng có trọng số của phía đó. */
    private void applyScores(ConductEvaluation sheet, ConductScoreRequest request, boolean selfSide) {
        double max = sheet.getMaxScore() != null ? sheet.getMaxScore() : ConductConstants.DEFAULT_MAX_SCORE;
        if (request.getItems() != null) {
            for (var input : request.getItems()) {
                ConductEvaluationItem item = matchItem(sheet, input.getCriteriaId(), input.getPosition());
                if (item == null) continue;
                Double score = input.getScore();
                if (score != null && (score < 0 || score > max)) {
                    throw new BusinessException("Điểm tiêu chí \"" + item.getCriteriaName()
                            + "\" phải nằm trong khoảng 0 đến " + max);
                }
                if (selfSide) {
                    item.setSelfScore(score);
                    if (input.getNote() != null) item.setSelfEvidence(input.getNote());
                } else {
                    item.setManagerScore(score);
                    if (input.getNote() != null) item.setManagerComment(input.getNote());
                }
            }
        }
        if (selfSide) sheet.setSelfScore(weightedTotal(sheet, true));
        else sheet.setManagerScore(weightedTotal(sheet, false));
    }

    private ConductEvaluationItem matchItem(ConductEvaluation sheet, UUID criteriaId, Integer position) {
        for (ConductEvaluationItem item : sheet.getItems()) {
            if (criteriaId != null && item.getCriteria() != null
                    && criteriaId.equals(item.getCriteria().getId())) return item;
        }
        if (position == null) return null;
        return sheet.getItems().stream()
                .filter(i -> position.equals(i.getPosition()))
                .findFirst().orElse(null);
    }

    /**
     * Σ(điểm × trọng số/100). Trả {@code null} khi chưa dòng nào được chấm — phân biệt
     * "chưa chấm" với "chấm 0 điểm".
     */
    private Double weightedTotal(ConductEvaluation sheet, boolean selfSide) {
        double sum = 0.0;
        boolean any = false;
        for (ConductEvaluationItem item : sheet.getItems()) {
            Double score = selfSide ? item.getSelfScore() : item.getManagerScore();
            if (score == null) continue;
            any = true;
            double weight = item.getWeight() != null ? item.getWeight() : 0.0;
            sum += score * weight / 100.0;
        }
        return any ? Math.round(sum * 100.0) / 100.0 : null;
    }

    /**
     * Đơn vị đã chốt kỳ đang khoá phiếu của người này (null nếu chưa bị khoá).
     *
     * Điểm hạnh kiểm lấp một trục của ma trận nên nó là ĐẦU VÀO của kết quả kỳ — chốt kỳ
     * xong mà vẫn sửa được hạnh kiểm thì con số đã công bố sẽ lệch với dữ liệu nguồn.
     * Phiếu theo ĐỢT cũng khoá theo kỳ chứa đợt đó, vì đợt là một phần của kỳ.
     */
    private OrgUnit lockingUnitFor(User user, Target t) {
        KpiCycle cycle = t.cycle() != null ? t.cycle()
                : (t.period() != null ? t.period().getKpiCycle() : null);
        if (cycle == null) return null;
        return cycleLockChecker.lockingUnitForUser(cycle.getId(), primaryUnit(user.getId()));
    }

    private void assertNotLocked(User user, Target t) {
        OrgUnit locking = lockingUnitFor(user, t);
        if (locking != null) {
            throw new BusinessException("Đánh giá kỳ của đơn vị \"" + locking.getName()
                    + "\" đã được chốt, không thể chấm hạnh kiểm. Hãy mở khoá ở đơn vị đó trước khi sửa.");
        }
    }

    private OrgUnit primaryUnit(UUID userId) {
        return userRoleOrgUnitRepository.findByUserId(userId).stream()
                .map(UserRoleOrgUnit::getOrgUnit)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
    }

    /**
     * XEM phiếu của người khác: có quyền EVALUATION:CREATE tại một đơn vị của người được
     * chấm — cùng luật với đánh giá KPI theo đợt, không nới thêm.
     */
    private boolean canEvaluate(User evaluator, User target) {
        return userRoleOrgUnitRepository.findByUserId(target.getId()).stream()
                .map(UserRoleOrgUnit::getOrgUnit)
                .filter(Objects::nonNull)
                .anyMatch(u -> permissionChecker.hasPermissionInOrgUnit(
                        evaluator.getId(), "EVALUATION:CREATE", u.getId()));
    }

    /**
     * CHẤM cho người khác thì chặt hơn xem: phải là TRƯỞNG đơn vị (rank 0). Phó xem được
     * phiếu nhưng không ký thay — hạnh kiểm là chữ ký của người đứng đầu đơn vị, khác với
     * điểm KPI vốn chia được cho cấp phó.
     */
    private boolean canScoreConduct(User evaluator, User target) {
        return userRoleOrgUnitRepository.findByUserId(target.getId()).stream()
                .map(UserRoleOrgUnit::getOrgUnit)
                .filter(Objects::nonNull)
                .anyMatch(u -> permissionChecker.hasLeaderPermissionInOrgUnit(
                        evaluator.getId(), "EVALUATION:CREATE", u.getId()));
    }

    private List<UserRoleOrgUnit> subtreeAssignments(OrgUnit unit) {
        UUID orgId = unit.getOrgHierarchyLevel().getOrganization().getId();
        List<OrgUnit> subtree = orgUnitRepository.findSubtree(unit.getPath(), orgId);
        List<UUID> unitIds = subtree.isEmpty() ? List.of(unit.getId())
                : subtree.stream().map(OrgUnit::getId).toList();
        return userRoleOrgUnitRepository.findByOrgUnitIdIn(unitIds).stream()
                .filter(a -> a.getUser() != null)
                .toList();
    }

    private ConductSheetResponse blankSheet(User target, Target t, User viewer) {
        Organization org = t.organization();
        ConductCriteriaSet set = resolveSet(t);
        double max = setMaxScore(set, org);
        OrgUnit locking = lockingUnitFor(target, t);
        List<ConductItemResponse> items = (set == null ? List.<ConductCriteria>of()
                : conductCriteriaRepository.findByCriteriaSetIdOrderByPositionAsc(set.getId())).stream()
                .map(c -> ConductItemResponse.builder()
                        .criteriaId(c.getId())
                        .name(c.getName())
                        .description(c.getDescription())
                        .weight(c.getWeight())
                        .position(c.getPosition())
                        .build())
                .toList();

        return ConductSheetResponse.builder()
                .userId(target.getId())
                .userName(target.getFullName())
                .userAvatarUrl(target.getAvatarUrl())
                .scope(t.scope())
                .kpiPeriodId(t.periodId())
                .kpiCycleId(t.cycleId())
                .targetName(t.name())
                .criteriaSetId(set != null ? set.getId() : null)
                .criteriaSetName(set != null ? set.getName() : null)
                .status(ConductStatus.DRAFT)
                .maxScore(max)
                .items(items)
                .canScoreSelf(locking == null && target.getId().equals(viewer.getId()))
                .canScoreManager(locking == null && !target.getId().equals(viewer.getId())
                        && canScoreConduct(viewer, target))
                .locked(locking != null)
                .lockedByUnitName(locking != null ? locking.getName() : null)
                .build();
    }

    private ConductSheetResponse toSheetResponse(ConductEvaluation e, User target, Target t, User viewer) {
        double max = e.getMaxScore() != null ? e.getMaxScore() : ConductConstants.DEFAULT_MAX_SCORE;
        List<ConductItemResponse> items = e.getItems().stream()
                .sorted(Comparator.comparing(ConductEvaluationItem::getPosition,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .map(i -> ConductItemResponse.builder()
                        .criteriaId(i.getCriteria() != null ? i.getCriteria().getId() : null)
                        .name(i.getCriteriaName())
                        .description(i.getCriteriaDescription())
                        .weight(i.getWeight())
                        .position(i.getPosition())
                        .selfScore(i.getSelfScore())
                        .selfEvidence(i.getSelfEvidence())
                        .managerScore(i.getManagerScore())
                        .managerComment(i.getManagerComment())
                        .selfWeighted(weighted(i.getSelfScore(), i.getWeight()))
                        .managerWeighted(weighted(i.getManagerScore(), i.getWeight()))
                        .build())
                .toList();

        Double effective = effectiveScore(e);
        var axes = ConductAxisResolver.resolve(null, null, effective, max);
        OrgUnit locking = lockingUnitFor(target, t);
        // Phiếu chấm trước khi có bộ theo kỳ chưa ghi bộ nào — suy lại từ đợt/kỳ để nhãn
        // không bỏ trống, chứ không đổi điểm (điểm vẫn từ bản chụp trong phiếu).
        ConductCriteriaSet set = e.getCriteriaSet() != null ? e.getCriteriaSet() : resolveSet(t);

        return ConductSheetResponse.builder()
                .id(e.getId())
                .userId(target.getId())
                .userName(target.getFullName())
                .userAvatarUrl(target.getAvatarUrl())
                .scope(e.getScope())
                .kpiPeriodId(t.periodId())
                .kpiCycleId(t.cycleId())
                .targetName(t.name())
                .criteriaSetId(set != null ? set.getId() : null)
                .criteriaSetName(set != null ? set.getName() : null)
                .status(e.getStatus())
                .maxScore(max)
                .selfScore(round(e.getSelfScore()))
                .managerScore(round(e.getManagerScore()))
                .comment(e.getComment())
                .evaluatorName(e.getEvaluator() != null ? e.getEvaluator().getFullName() : null)
                .selfSubmittedAt(e.getSelfSubmittedAt())
                .evaluatedAt(e.getEvaluatedAt())
                .effectiveScore(round(effective))
                .behaviorEquivalent(round(axes.behaviorScore()))
                .percentEquivalent(round(effective == null ? null : effective / max * 100.0))
                .items(items)
                .canScoreSelf(locking == null && target.getId().equals(viewer.getId()))
                .canScoreManager(locking == null && !target.getId().equals(viewer.getId())
                        && canScoreConduct(viewer, target))
                .locked(locking != null)
                .lockedByUnitName(locking != null ? locking.getName() : null)
                .build();
    }

    private ConductConfigResponse toConfigResponse(Organization org, List<ConductCriteriaSet> sets) {
        return ConductConfigResponse.builder()
                .enabled(Boolean.TRUE.equals(org.getEnableConduct()))
                .sets(sets.stream().map(this::toSetResponse).toList())
                .build();
    }

    private ConductSetResponse toSetResponse(ConductCriteriaSet set) {
        List<ConductCriteria> criteria = conductCriteriaRepository
                .findByCriteriaSetIdOrderByPositionAsc(set.getId());
        double total = criteria.stream().mapToDouble(c -> c.getWeight() != null ? c.getWeight() : 0.0).sum();
        return ConductSetResponse.builder()
                .id(set.getId())
                .name(set.getName())
                .isDefault(Boolean.TRUE.equals(set.getIsDefault()))
                .maxScore(set.getMaxScore())
                .kpiCycleIds(new ArrayList<>(set.getKpiCycleIds()))
                .totalWeight(Math.round(total * 100.0) / 100.0)
                .criteria(criteria.stream()
                        .map(c -> ConductCriteriaResponse.builder()
                                .id(c.getId())
                                .name(c.getName())
                                .description(c.getDescription())
                                .weight(c.getWeight())
                                .position(c.getPosition())
                                .build())
                        .toList())
                .build();
    }

    /** Thang điểm của bộ; chưa có bộ nào thì lấy giá trị nền của tổ chức. */
    private double setMaxScore(ConductCriteriaSet set, Organization org) {
        return set != null && set.getMaxScore() != null ? set.getMaxScore() : conductMaxScore(org);
    }

    private double conductMaxScore(Organization org) {
        Double max = org != null ? org.getConductMaxScore() : null;
        return max != null && max > 0 ? max : ConductConstants.DEFAULT_MAX_SCORE;
    }

    private Double weighted(Double score, Double weight) {
        if (score == null) return null;
        double w = weight != null ? weight : 0.0;
        return Math.round(score * w / 100.0 * 100.0) / 100.0;
    }

    private Double round(Double v) {
        return v == null ? null : Math.round(v * 100.0) / 100.0;
    }

    private Organization requireOrg(UUID organizationId) {
        return organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", organizationId));
    }

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }
}
