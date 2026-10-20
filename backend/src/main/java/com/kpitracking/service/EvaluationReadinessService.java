package com.kpitracking.service;

import com.kpitracking.dto.response.evaluation.ScoringReadinessResponse;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.repository.EvaluationRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiSubmissionRepository;
import com.kpitracking.workflow.KpiWorkflowConfigService;
import com.kpitracking.workflow.def.WorkflowDefinition;
import com.kpitracking.workflow.WorkflowStage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

/**
 * Khi nào quản lý được chấm đợt cho một người — MỘT luật, dùng chung cho nút "Chấm điểm" ở
 * giao diện ({@code GET /evaluations/scoring-readiness}, {@code score-preview}) và cho chốt chặn ở
 * {@link EvaluationService#createEvaluation}.
 *
 * <p>Trước khi đợt kết thúc: người đó phải có ít nhất một KPI trong đợt, đã nộp bài cho MỌI KPI
 * phải nộp, và đã tự đánh giá (nếu tổ chức bật bước tự đánh giá). Tổ chức tắt bước nộp bài thì
 * bỏ điều kiện nộp. Đợt đã kết thúc thì chấm được luôn — KPI chưa nộp tính 0 — để người không
 * bao giờ nộp không chặn mãi việc chốt kỳ.
 */
@Service
@RequiredArgsConstructor
public class EvaluationReadinessService {

    /** KPI đang chạy. KPI huỷ (INACTIVE) không bắt nộp; kỳ khoá (CLOSED_BY_LOCK) thì không chấm được nữa. */
    private static final List<KpiStatus> RUNNING = List.of(KpiStatus.APPROVED, KpiStatus.EDIT, KpiStatus.EDITED);
    /** Số tên KPI tối đa đưa vào câu báo lỗi. */
    private static final int MAX_NAMES_IN_ERROR = 5;

    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KpiSubmissionRepository kpiSubmissionRepository;
    private final EvaluationRepository evaluationRepository;
    private final KpiWorkflowConfigService workflowConfigService;
    private final KpiEffortShares effortShares;

    public Map<UUID, ScoringReadinessResponse> compute(KpiPeriod period, Collection<UUID> userIds) {
        Map<UUID, ScoringReadinessResponse> out = new LinkedHashMap<>();
        if (userIds.isEmpty()) return out;

        Instant now = Instant.now();
        boolean periodEnded = period.getEndDate() != null && now.isAfter(period.getEndDate());
        WorkflowDefinition workflow = workflowConfigService.definitionFor(
                period.getOrganization() != null ? period.getOrganization().getId() : null);
        boolean submissionRequired = workflow.isStageEnabled(WorkflowStage.SUBMISSION);
        boolean selfEvalRequired = workflow.isStageEnabled(WorkflowStage.SELF_EVALUATION);

        // [kpiId, kpiName, userId] — KPI phải nộp, xếp theo tên.
        Map<UUID, List<Object[]>> requiredByUser = new HashMap<>();
        for (Object[] row : kpiCriteriaRepository.findRequiredSubmissionKpis(period.getId(), userIds, RUNNING)) {
            requiredByUser.computeIfAbsent((UUID) row[2], k -> new ArrayList<>()).add(row);
        }
        Set<String> submitted = new HashSet<>();
        for (Object[] row : kpiSubmissionRepository.findSubmittedKpiPairs(period.getId(), userIds, now)) {
            submitted.add(row[0] + "|" + row[1]);
        }
        Set<UUID> selfEvaluated = selfEvalRequired
                ? new HashSet<>(evaluationRepository.findSelfEvaluatedUserIds(period.getId(), userIds))
                : Set.of();

        // Đơn vị của từng KPI phải nộp — để ghi rõ KPI còn thiếu của người kiêm nhiệm thuộc phòng nào.
        Map<UUID, com.kpitracking.entity.OrgUnit> unitOfKpi = new HashMap<>();
        Set<UUID> requiredIds = new HashSet<>();
        requiredByUser.values().forEach(rows -> rows.forEach(r -> requiredIds.add((UUID) r[0])));
        if (!requiredIds.isEmpty()) {
            kpiCriteriaRepository.findAllById(requiredIds).forEach(k -> unitOfKpi.put(k.getId(), k.getOrgUnit()));
        }

        for (UUID userId : userIds) {
            List<Object[]> required = requiredByUser.getOrDefault(userId, List.of());
            List<String> missing = new ArrayList<>();
            List<UUID> missingIds = new ArrayList<>();
            int submittedCount = 0;
            for (Object[] kpi : required) {
                if (submitted.contains(kpi[0] + "|" + userId)) submittedCount++;
                else { missing.add((String) kpi[1]); missingIds.add((UUID) kpi[0]); }
            }
            missing = labelOtherBranches(userId, required, missingIds, missing, unitOfKpi);
            boolean submissionsDone = !submissionRequired || missing.isEmpty();
            boolean selfDone = !selfEvalRequired || selfEvaluated.contains(userId);
            out.put(userId, ScoringReadinessResponse.builder()
                    .userId(userId)
                    .requiredKpiCount(required.size())
                    .submittedKpiCount(submittedCount)
                    .missingKpiNames(submissionRequired ? missing : List.of())
                    .selfEvaluationRequired(selfEvalRequired)
                    .selfEvaluated(selfEvaluated.contains(userId))
                    .periodEnded(periodEnded)
                    .ready(periodEnded || (!required.isEmpty() && submissionsDone && selfDone))
                    .build());
        }
        return out;
    }

    /**
     * Người kiêm nhiệm (KpiEffortShares): KPI còn thiếu thuộc nhánh KHÁC đơn vị chính được ghi kèm tên
     * đơn vị, vd. "Bài viết tháng (Team Content)" — trưởng đơn vị chính biết phải chờ / nhắc ở đâu.
     * Chỉ tra nhánh khi KPI phải nộp đến từ ≥ 2 đơn vị, nên người một phòng không tốn thêm truy vấn.
     */
    private List<String> labelOtherBranches(UUID userId, List<Object[]> required, List<UUID> missingIds,
                                            List<String> missing, Map<UUID, com.kpitracking.entity.OrgUnit> unitOfKpi) {
        if (missing.isEmpty()) return missing;
        long units = required.stream().map(r -> unitOfKpi.get((UUID) r[0])).filter(java.util.Objects::nonNull)
                .map(com.kpitracking.entity.OrgUnit::getId).distinct().count();
        if (units < 2) return missing;
        List<KpiEffortShares.Branch> branches = effortShares.branchesOf(userId);
        if (branches.size() < 2) return missing;
        List<com.kpitracking.entity.OrgUnit> branchUnits = branches.stream().map(KpiEffortShares.Branch::unit).toList();
        UUID home = branchUnits.get(0).getId();
        List<String> out = new ArrayList<>(missing.size());
        for (int i = 0; i < missing.size(); i++) {
            UUID b = KpiEffortShares.branchOfUnit(branchUnits, unitOfKpi.get(missingIds.get(i)));
            String name = branchUnits.stream().filter(u -> u.getId().equals(b)).map(com.kpitracking.entity.OrgUnit::getName)
                    .findFirst().orElse(null);
            out.add(b.equals(home) || name == null ? missing.get(i) : missing.get(i) + " (" + name + ")");
        }
        return out;
    }

    public ScoringReadinessResponse compute(KpiPeriod period, UUID userId) {
        return compute(period, List.of(userId)).get(userId);
    }

    /** Ném lỗi nghiệp vụ nêu đúng lý do nếu quản lý chưa được chấm người này ở đợt này. */
    public void assertReady(KpiPeriod period, UUID userId, String userName) {
        ScoringReadinessResponse r = compute(period, userId);
        if (r.isReady()) return;
        if (r.getRequiredKpiCount() == 0) {
            throw new BusinessException(ErrorCode.EVALUATION_WAITING_NO_KPI, userName);
        }
        if (!r.getMissingKpiNames().isEmpty()) {
            List<String> names = r.getMissingKpiNames();
            String shown = String.join(", ", names.subList(0, Math.min(names.size(), MAX_NAMES_IN_ERROR)))
                    + (names.size() > MAX_NAMES_IN_ERROR ? ", …" : "");
            throw new BusinessException(ErrorCode.EVALUATION_WAITING_SUBMISSIONS, userName,
                    String.valueOf(r.getSubmittedKpiCount()), String.valueOf(r.getRequiredKpiCount()), shown);
        }
        throw new BusinessException(ErrorCode.EVALUATION_WAITING_SELF_EVALUATION, userName);
    }
}
