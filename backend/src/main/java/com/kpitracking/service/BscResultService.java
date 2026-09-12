package com.kpitracking.service;

import com.kpitracking.dto.request.bsc.BscOverrideRequest;
import com.kpitracking.dto.response.bsc.BscWaterfallResponse;
import com.kpitracking.dto.response.bsc.UnitResultItemResponse;
import com.kpitracking.dto.response.bsc.UnitResultResponse;
import com.kpitracking.entity.BscScorecardPerspective;
import com.kpitracking.entity.BscUnitResult;
import com.kpitracking.entity.BscUnitResultItem;
import com.kpitracking.entity.Evaluation;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.BscUnitResultItemRepository;
import com.kpitracking.repository.EvaluationRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.event.BscEvents;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Đọc và can thiệp KẾT QUẢ đã tính: diễn giải waterfall cho một cá nhân và ghi đè thủ công.
 *
 * <p>Waterfall là màn hình quyết định nhân viên có chấp nhận kết quả hay không, nên nó phải trả
 * đủ mọi con số trung gian — điểm gốc, trần, điểm công nhận, ghi đè — thay vì chỉ một con số cuối
 * không giải thích được.
 */
@Service
@RequiredArgsConstructor
public class BscResultService {

    private final EvaluationRepository evaluationRepository;
    private final BscUnitResultItemRepository unitResultItemRepository;
    private final UserRepository userRepository;
    private final BscScoringService bscScoringService;
    private final BscCascadeService bscCascadeService;
    private final ApplicationEventPublisher eventPublisher;

    // ============================================================
    // Waterfall
    // ============================================================

    @Transactional(readOnly = true)
    public BscWaterfallResponse waterfall(UUID evaluationId) {
        Evaluation e = evaluationRepository.findById(evaluationId)
                .orElseThrow(() -> new ResourceNotFoundException("Đánh giá", "id", evaluationId));

        UUID orgId = organizationIdOf(e);
        UUID periodId = e.getKpiPeriod() != null ? e.getKpiPeriod().getId() : null;

        var policy = bscCascadeService.resolvePolicy(orgId, periodId);
        Double cap = policy != null ? policy.getRecognizedCapPercent() : null;
        Double raw = e.getRawBscScore() != null ? e.getRawBscScore() : e.getBscScore();
        Double capped = raw != null && cap != null ? Math.min(raw, cap) : raw;

        // Breakdown lấy bản ĐÃ LƯU của lần chấm — không tính lại, nếu không màn hình giải thích
        // lại hiện một bộ số khác với điểm đã công bố.
        var perspectives = bscScoringService.getBreakdown(evaluationId);

        // Chỉ cần bộ tiêu chí để nói ra chính sách hạng mục rỗng — điểm cá nhân không phụ thuộc
        // kết quả BSC của phòng/công ty nữa nên không phải đọc lại %đạt của các cấp trên.
        var score = orgId != null && periodId != null && e.getUser() != null
                ? bscScoringService.computeForUser(e.getUser().getId(), periodId, orgId, false)
                : null;

        BscCascadeService.LinkedWeightCheck linked = e.getUser() != null && periodId != null
                ? bscCascadeService.checkLinkedWeight(e.getUser().getId(), periodId, orgId)
                : null;

        Double finalScore = e.getOverrideScore() != null ? e.getOverrideScore() : e.getRecognizedScore();
        if (finalScore == null) finalScore = e.getScore();

        return BscWaterfallResponse.builder()
                .evaluationId(e.getId())
                .userId(e.getUser() != null ? e.getUser().getId() : null)
                .userName(e.getUser() != null ? e.getUser().getFullName() : null)
                .orgUnitName(e.getOrgUnit() != null ? e.getOrgUnit().getName() : null)
                .kpiPeriodId(periodId)
                .kpiPeriodName(e.getKpiPeriod() != null ? e.getKpiPeriod().getName() : null)
                .rawBscScore(raw)
                .recognizedCapPercent(cap)
                .cappedScore(capped)
                .recognizedScore(e.getRecognizedScore())
                .overrideScore(e.getOverrideScore())
                .overrideReasonCode(e.getOverrideReasonCode())
                .overrideComment(e.getOverrideComment())
                .overriddenByName(e.getOverriddenBy() != null ? e.getOverriddenBy().getFullName() : null)
                .overriddenAt(e.getOverriddenAt())
                .finalScore(finalScore)
                .gatePassed(e.getGatePassed())
                .gateCapRating(e.getGateCapRating())
                .gateFailedItems(e.getGateFailedItems())
                .matrixRating(e.getMatrixRating())
                .perspectives(perspectives)
                .emptyPerspectivePolicy(score != null && score.getScorecard() != null
                        ? score.getScorecard().getEmptyPerspectivePolicy() : null)
                .linkedWeightPercent(linked != null ? linked.linkedPercent() : null)
                .linkedWeightRequired(linked != null ? linked.minRequired() : null)
                .linkedWeightSatisfied(linked != null ? linked.satisfied() : null)
                .build();
    }

    // ============================================================
    // Ghi đè thủ công (QĐ-6)
    // ============================================================

    /**
     * Ghi đè điểm công nhận của một cá nhân. Lý do là BẮT BUỘC — đây là hành vi ngoại lệ và phải
     * giải trình được về sau; báo cáo kỳ phải liệt kê được mọi lần ghi đè.
     *
     * <p>Gửi {@code score = null} để huỷ ghi đè, khi đó điểm quay về con số hệ thống tính.
     */
    @Transactional
    public BscWaterfallResponse override(UUID evaluationId, BscOverrideRequest request) {
        Evaluation e = evaluationRepository.findById(evaluationId)
                .orElseThrow(() -> new ResourceNotFoundException("Đánh giá", "id", evaluationId));
        User actor = currentUserOrNull();

        if (request.getScore() == null) {
            e.setOverrideScore(null);
            e.setOverrideReasonCode(null);
            e.setOverrideComment(null);
            e.setOverriddenBy(null);
            e.setOverriddenAt(null);
            // Trả điểm về con số hệ thống tính. Không có điểm công nhận (org chưa bật cascade)
            // thì giữ nguyên điểm hiện tại thay vì xoá trắng.
            if (e.getRecognizedScore() != null) e.setScore(e.getRecognizedScore());
        } else {
            if (request.getReasonCode() == null || request.getReasonCode().isBlank()) {
                throw new BusinessException("Ghi đè điểm bắt buộc phải có lý do");
            }
            if (request.getScore() < 0) {
                throw new BusinessException("Điểm ghi đè không được âm");
            }
            e.setOverrideScore(request.getScore());
            e.setOverrideReasonCode(request.getReasonCode().trim());
            e.setOverrideComment(request.getComment());
            e.setOverriddenBy(actor);
            e.setOverriddenAt(Instant.now());
            e.setScore(request.getScore());
        }
        evaluationRepository.save(e);
        // Điểm đã công bố của một người vừa bị đổi bằng tay — chính người đó phải được báo.
        eventPublisher.publishEvent(new BscEvents.EvaluationScoreOverridden(
                e.getId(), actor != null ? actor.getId() : null,
                request.getScore(), request.getScore() == null));
        return waterfall(evaluationId);
    }

    // ============================================================
    // Kết quả BSC đơn vị → DTO
    // ============================================================

    @Transactional(readOnly = true)
    public UnitResultResponse toResponse(BscUnitResult r) {
        List<UnitResultItemResponse> items = new ArrayList<>();
        for (BscUnitResultItem item : unitResultItemRepository.findByUnitResultId(r.getId())) {
            BscScorecardPerspective row = item.getScorecardPerspective();
            items.add(UnitResultItemResponse.builder()
                    .id(item.getId())
                    .scorecardPerspectiveId(row.getId())
                    .name(row.getPerspective().getName())
                    .color(row.getPerspective().getColor())
                    .actualValue(item.getActualValue())
                    .targetValue(item.getTargetValue())
                    .unit(row.getUnit() != null ? row.getUnit() : row.getPerspective().getUnit())
                    .achievementPercent(item.getAchievementPercent())
                    .weightPercentage(item.getWeightPercentage())
                    .weightedScore(item.getWeightedScore())
                    .kpiCount(item.getKpiCount())
                    .isGate(row.getIsGate())
                    .gatePassed(item.getGatePassed())
                    .measurementSource(item.getMeasurementSource())
                    .build());
        }
        String unitName = r.getScorecard().getOrgUnits() == null || r.getScorecard().getOrgUnits().isEmpty()
                ? null
                : String.join(", ", r.getScorecard().getOrgUnits().stream().map(OrgUnit::getName).toList());

        return UnitResultResponse.builder()
                .id(r.getId())
                .scorecardId(r.getScorecard().getId())
                .scorecardName(r.getScorecard().getName())
                .orgUnitName(unitName)
                .kpiPeriodId(r.getKpiPeriod() != null ? r.getKpiPeriod().getId() : null)
                .kpiPeriodName(r.getKpiPeriod() != null ? r.getKpiPeriod().getName() : null)
                .achievementPercent(r.getAchievementPercent())
                .gatePassed(r.getGatePassed())
                .gateFailedItems(r.getGateFailedItems())
                .status(r.getStatus())
                .finalizedByName(r.getFinalizedBy() != null ? r.getFinalizedBy().getFullName() : null)
                .finalizedAt(r.getFinalizedAt())
                .items(items)
                .build();
    }

    // ============================================================

    private UUID organizationIdOf(Evaluation e) {
        OrgUnit unit = e.getOrgUnit();
        if (unit != null && unit.getOrgHierarchyLevel() != null
                && unit.getOrgHierarchyLevel().getOrganization() != null) {
            return unit.getOrgHierarchyLevel().getOrganization().getId();
        }
        return null;
    }

    private User currentUserOrNull() {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            return userRepository.findByEmail(email).orElse(null);
        } catch (Exception ex) {
            return null;
        }
    }
}
