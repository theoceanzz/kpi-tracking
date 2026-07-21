package com.kpitracking.service;

import com.kpitracking.dto.request.bsc.ObjectiveRelationRequest;
import com.kpitracking.dto.response.bsc.ObjectiveRelationResponse;
import com.kpitracking.dto.response.bsc.StrategyMapResponse;
import com.kpitracking.entity.*;
import com.kpitracking.enums.OkrStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.DuplicateResourceException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Bản đồ chiến lược (Strategy Map) — GĐ4b.
 * Dựng cây Viễn cảnh → Objective → KeyResult → KPI + KPI gán trực tiếp + cạnh nhân-quả giữa Objective.
 */
@Service
@RequiredArgsConstructor
public class BscStrategyMapService {

    private final BscPerspectiveRepository perspectiveRepository;
    private final ObjectiveRepository objectiveRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final BscObjectiveRelationRepository relationRepository;
    private final OrganizationRepository organizationRepository;
    private final BscFixedPerspectiveRepository fixedPerspectiveRepository;

    // ── Strategy map ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public StrategyMapResponse getStrategyMap(UUID organizationId) {
        List<BscPerspective> perspectives = perspectiveRepository.findByOrganizationIdOrderByDisplayOrderAsc(organizationId);
        List<Objective> objectives = objectiveRepository.findByOrganizationId(organizationId);

        // Tên/màu viễn cảnh cố định tùy chỉnh theo org (fallback enum) để bản đồ khớp dashboard.
        Map<String, BscFixedPerspectiveEntity> orgFixed = new HashMap<>();
        for (BscFixedPerspectiveEntity f : fixedPerspectiveRepository.findByOrganizationIdOrderByDisplayOrderAsc(organizationId)) {
            orgFixed.put(f.getCode(), f);
        }

        // Gom Objective theo viễn cảnh (bỏ mục tiêu đã huỷ — không còn thuộc chiến lược đang chạy)
        Map<UUID, List<Objective>> objByPerspective = new HashMap<>();
        for (Objective o : objectives) {
            if (o.getPerspective() == null) continue;
            if (o.getStatus() == OkrStatus.CANCELLED) continue;
            objByPerspective.computeIfAbsent(o.getPerspective().getId(), k -> new ArrayList<>()).add(o);
        }

        List<StrategyMapResponse.PerspectiveLane> lanes = new ArrayList<>();
        for (BscPerspective p : perspectives) {
            List<StrategyMapResponse.ObjectiveNode> objNodes = objByPerspective.getOrDefault(p.getId(), List.of()).stream()
                    .map(o -> mapObjectiveNode(o, p.getId()))
                    .collect(Collectors.toList());
            var fixed = p.getFixedPerspective();
            BscFixedPerspectiveEntity fixedRow = fixed != null ? orgFixed.get(fixed.name()) : null;
            lanes.add(StrategyMapResponse.PerspectiveLane.builder()
                    .perspectiveId(p.getId()).code(p.getCode()).name(p.getName())
                    .color(p.getColor()).displayOrder(p.getDisplayOrder())
                    .fixedPerspective(fixed != null ? fixed.name() : null)
                    .fixedPerspectiveName(fixed != null ? (fixedRow != null ? fixedRow.getName() : fixed.getDisplayName()) : null)
                    .fixedPerspectiveColor(fixed != null ? (fixedRow != null ? fixedRow.getColor() : fixed.getColor()) : null)
                    .objectives(objNodes)
                    .build());
        }

        // KPI gán trực tiếp viễn cảnh nhưng KHÔNG thuộc OKR (nối thẳng từ viễn cảnh)
        // Lọc theo cùng tập trạng thái dashboard chấm ⇒ số KPI trên bản đồ khớp dashboard (không hiện KPI nháp/từ chối/thay thế).
        List<StrategyMapResponse.KpiNode> directKpis = kpiCriteriaRepository
                .findByOrganizationIdAndPerspectiveNotNullAndKeyResultIsNull(organizationId).stream()
                .filter(k -> BscScoringService.ACTIVE_STATUSES.contains(k.getStatus()))
                .map(k -> StrategyMapResponse.KpiNode.builder()
                        .id(k.getId()).name(k.getName())
                        .perspectiveId(k.getPerspective().getId())
                        .perspectiveMismatch(false)
                        .build())
                .collect(Collectors.toList());

        List<StrategyMapResponse.RelationEdge> edges = relationRepository.findByOrganizationId(organizationId).stream()
                .map(r -> StrategyMapResponse.RelationEdge.builder()
                        .id(r.getId())
                        .sourceObjectiveId(r.getSourceObjective().getId())
                        .targetObjectiveId(r.getTargetObjective().getId())
                        .label(r.getLabel())
                        .build())
                .collect(Collectors.toList());

        return StrategyMapResponse.builder()
                .perspectives(lanes)
                .directKpis(directKpis)
                .relations(edges)
                .build();
    }

    private StrategyMapResponse.ObjectiveNode mapObjectiveNode(Objective o, UUID lanePerspectiveId) {
        List<StrategyMapResponse.KeyResultNode> krNodes = o.getKeyResults().stream()
                .map(kr -> StrategyMapResponse.KeyResultNode.builder()
                        .id(kr.getId()).code(kr.getCode()).name(kr.getName())
                        .kpis(kr.getKpis().stream()
                                // deleted_at đã lọc sẵn qua @SQLRestriction; ở đây lọc trạng thái để khớp dashboard.
                                .filter(k -> BscScoringService.ACTIVE_STATUSES.contains(k.getStatus()))
                                .map(k -> StrategyMapResponse.KpiNode.builder()
                                        .id(k.getId()).name(k.getName())
                                        .perspectiveId(k.getPerspective() != null ? k.getPerspective().getId() : null)
                                        // Lệch khi KPI gán viễn cảnh TRỰC TIẾP khác viễn cảnh của Objective cha
                                        .perspectiveMismatch(k.getPerspective() != null
                                                && !k.getPerspective().getId().equals(lanePerspectiveId))
                                        .build())
                                .collect(Collectors.toList()))
                        .build())
                .collect(Collectors.toList());
        return StrategyMapResponse.ObjectiveNode.builder()
                .id(o.getId()).code(o.getCode()).name(o.getName())
                .keyResults(krNodes)
                .build();
    }

    // ── Quan hệ nhân-quả ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ObjectiveRelationResponse> getRelations(UUID organizationId) {
        return relationRepository.findByOrganizationId(organizationId).stream()
                .map(this::mapRelation)
                .collect(Collectors.toList());
    }

    @Transactional
    public ObjectiveRelationResponse createRelation(UUID organizationId, ObjectiveRelationRequest request) {
        if (request.getSourceObjectiveId().equals(request.getTargetObjectiveId())) {
            throw new BusinessException("Không thể nối một mục tiêu với chính nó");
        }
        Organization org = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization not found"));
        Objective source = objectiveRepository.findById(request.getSourceObjectiveId())
                .orElseThrow(() -> new ResourceNotFoundException("Mục tiêu nguồn", "id", request.getSourceObjectiveId()));
        Objective target = objectiveRepository.findById(request.getTargetObjectiveId())
                .orElseThrow(() -> new ResourceNotFoundException("Mục tiêu đích", "id", request.getTargetObjectiveId()));
        if (relationRepository.existsByOrganizationIdAndSourceObjectiveIdAndTargetObjectiveId(
                organizationId, source.getId(), target.getId())) {
            throw new DuplicateResourceException("Quan hệ giữa hai mục tiêu này đã tồn tại");
        }
        BscObjectiveRelation rel = BscObjectiveRelation.builder()
                .organization(org).sourceObjective(source).targetObjective(target)
                .label(request.getLabel())
                .build();
        return mapRelation(relationRepository.save(rel));
    }

    @Transactional
    public void deleteRelation(UUID relationId) {
        BscObjectiveRelation rel = relationRepository.findById(relationId)
                .orElseThrow(() -> new ResourceNotFoundException("Relation not found"));
        rel.setDeletedAt(Instant.now());
        relationRepository.save(rel);
    }

    private ObjectiveRelationResponse mapRelation(BscObjectiveRelation r) {
        return ObjectiveRelationResponse.builder()
                .id(r.getId())
                .sourceObjectiveId(r.getSourceObjective().getId())
                .sourceObjectiveName(r.getSourceObjective().getName())
                .targetObjectiveId(r.getTargetObjective().getId())
                .targetObjectiveName(r.getTargetObjective().getName())
                .label(r.getLabel())
                .build();
    }
}
