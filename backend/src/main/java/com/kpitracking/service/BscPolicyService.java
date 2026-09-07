package com.kpitracking.service;

import com.kpitracking.dto.request.bsc.CascadePolicyRequest;
import com.kpitracking.dto.request.bsc.FactorBandRequest;
import com.kpitracking.dto.response.bsc.CascadePolicyResponse;
import com.kpitracking.dto.response.bsc.FactorBandResponse;
import com.kpitracking.entity.BscCascadePolicy;
import com.kpitracking.entity.BscFactorBand;
import com.kpitracking.entity.KpiCycle;
import com.kpitracking.entity.Organization;
import com.kpitracking.enums.BscFactorBasis;
import com.kpitracking.enums.BscFactorMode;
import com.kpitracking.enums.BscFactorScope;
import com.kpitracking.enums.BscLinkedWeightEnforce;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.BscCascadePolicyRepository;
import com.kpitracking.repository.KpiCycleRepository;
import com.kpitracking.repository.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Quản lý chính sách hệ số cascade và bảng dải (QĐ-4, QĐ-8).
 *
 * <p>Chính sách quyết định mô hình phạt nặng hay nhẹ, nên mọi thay đổi ở đây tác động lên điểm
 * của toàn tổ chức. Kết quả đã chốt không bị ảnh hưởng vì hệ số đã được chụp lại lúc chốt.
 */
@Service
@RequiredArgsConstructor
public class BscPolicyService {

    private final BscCascadePolicyRepository policyRepository;
    private final OrganizationRepository organizationRepository;
    private final KpiCycleRepository kpiCycleRepository;

    @Transactional(readOnly = true)
    public List<CascadePolicyResponse> list(UUID organizationId) {
        return policyRepository.findByOrganizationIdOrderByCreatedAtDesc(organizationId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public CascadePolicyResponse create(UUID organizationId, CascadePolicyRequest request) {
        Organization org = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization not found"));
        validate(request);

        BscCascadePolicy policy = BscCascadePolicy.builder()
                .organization(org)
                .name(request.getName().trim())
                .kpiCycle(resolveCycle(request.getKpiCycleId()))
                .build();
        apply(policy, request);
        policy = policyRepository.save(policy);
        replaceBands(policy, request.getBands());
        return toResponse(policyRepository.save(policy));
    }

    @Transactional
    public CascadePolicyResponse update(UUID policyId, CascadePolicyRequest request) {
        BscCascadePolicy policy = policyRepository.findById(policyId)
                .orElseThrow(() -> new ResourceNotFoundException("Chính sách hệ số", "id", policyId));
        validate(request);
        policy.setName(request.getName().trim());
        policy.setKpiCycle(resolveCycle(request.getKpiCycleId()));
        apply(policy, request);
        // Sửa chính sách đang dùng = đổi cách chấm cho các kỳ CHƯA chốt. Tăng version để đối chiếu
        // được về sau khi có ai hỏi "sao điểm kỳ này khác kỳ trước".
        policy.setVersion(policy.getVersion() != null ? policy.getVersion() + 1 : 1);
        replaceBands(policy, request.getBands());
        return toResponse(policyRepository.save(policy));
    }

    @Transactional
    public void delete(UUID policyId) {
        BscCascadePolicy policy = policyRepository.findById(policyId)
                .orElseThrow(() -> new ResourceNotFoundException("Chính sách hệ số", "id", policyId));
        // Soft delete: kết quả đã chốt vẫn trỏ tới chính sách này qua cascade_policy_id.
        policy.setDeletedAt(Instant.now());
        policyRepository.save(policy);
    }

    // ============================================================

    private void apply(BscCascadePolicy policy, CascadePolicyRequest r) {
        if (r.getUnitFactorMode() != null) policy.setUnitFactorMode(r.getUnitFactorMode());
        if (r.getCompanyFactorMode() != null) policy.setCompanyFactorMode(r.getCompanyFactorMode());
        if (r.getFactorBasis() != null) policy.setFactorBasis(r.getFactorBasis());
        if (r.getFactorFloor() != null) policy.setFactorFloor(r.getFactorFloor());
        if (r.getFactorCap() != null) policy.setFactorCap(r.getFactorCap());
        if (r.getRecognizedCapPercent() != null) policy.setRecognizedCapPercent(r.getRecognizedCapPercent());
        if (r.getMinBscLinkedWeight() != null) policy.setMinBscLinkedWeight(r.getMinBscLinkedWeight());
        if (r.getLinkedWeightEnforce() != null) policy.setLinkedWeightEnforce(r.getLinkedWeightEnforce());
    }

    private void validate(CascadePolicyRequest r) {
        if (r.getFactorFloor() != null && r.getFactorCap() != null && r.getFactorFloor() > r.getFactorCap()) {
            throw new BusinessException("Sàn hệ số không được lớn hơn trần hệ số");
        }
        if (r.getRecognizedCapPercent() != null && r.getRecognizedCapPercent() <= 0) {
            throw new BusinessException("Trần điểm công nhận phải lớn hơn 0");
        }
        if (r.getMinBscLinkedWeight() != null
                && (r.getMinBscLinkedWeight() < 0 || r.getMinBscLinkedWeight() > 100)) {
            throw new BusinessException("Tỉ trọng KPI liên kết BSC phải nằm trong khoảng 0–100%");
        }
        if (r.getBands() == null) return;

        // Dải chồng lấn thì hệ số phụ thuộc vào thứ tự duyệt — cùng một kết quả có thể ra hai hệ số
        // khác nhau tuỳ lần chạy. Chặn ngay lúc cấu hình thay vì để lộ ra ở điểm của nhân viên.
        for (BscFactorScope scope : BscFactorScope.values()) {
            List<FactorBandRequest> bands = r.getBands().stream()
                    .filter(b -> b.getScope() == scope)
                    .sorted(Comparator.comparing(b -> b.getFromPercent() == null
                            ? Double.NEGATIVE_INFINITY : b.getFromPercent()))
                    .toList();
            for (int i = 0; i < bands.size(); i++) {
                FactorBandRequest b = bands.get(i);
                if (b.getFromPercent() != null && b.getToPercent() != null
                        && b.getFromPercent() >= b.getToPercent()) {
                    throw new BusinessException("Dải " + label(b) + " có mốc dưới lớn hơn hoặc bằng mốc trên");
                }
                if (i > 0) {
                    FactorBandRequest prev = bands.get(i - 1);
                    Double prevTo = prev.getToPercent();
                    Double curFrom = b.getFromPercent();
                    if (prevTo == null || curFrom == null || curFrom < prevTo) {
                        throw new BusinessException("Các dải của cấp " + scope + " bị chồng lấn nhau");
                    }
                }
            }
        }
    }

    private static String label(FactorBandRequest b) {
        return (b.getLabel() != null ? b.getLabel() : "")
                + " [" + (b.getFromPercent() != null ? b.getFromPercent() : "-∞")
                + ", " + (b.getToPercent() != null ? b.getToPercent() : "+∞") + ")";
    }

    private void replaceBands(BscCascadePolicy policy, List<FactorBandRequest> bands) {
        if (bands == null) return;
        policy.getBands().clear();
        int order = 0;
        for (FactorBandRequest b : bands) {
            policy.getBands().add(BscFactorBand.builder()
                    .policy(policy)
                    .scope(b.getScope())
                    .fromPercent(b.getFromPercent())
                    .toPercent(b.getToPercent())
                    .factor(b.getFactor())
                    .label(b.getLabel())
                    .color(b.getColor())
                    .displayOrder(b.getDisplayOrder() != null ? b.getDisplayOrder() : order++)
                    .build());
        }
    }

    private KpiCycle resolveCycle(UUID cycleId) {
        if (cycleId == null) return null;
        return kpiCycleRepository.findById(cycleId)
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá", "id", cycleId));
    }

    private CascadePolicyResponse toResponse(BscCascadePolicy p) {
        List<FactorBandResponse> bands = new ArrayList<>();
        if (p.getBands() != null) {
            for (BscFactorBand b : p.getBands()) {
                bands.add(FactorBandResponse.builder()
                        .id(b.getId())
                        .scope(b.getScope())
                        .fromPercent(b.getFromPercent())
                        .toPercent(b.getToPercent())
                        .factor(b.getFactor())
                        .label(b.getLabel())
                        .color(b.getColor())
                        .displayOrder(b.getDisplayOrder())
                        .build());
            }
        }
        return CascadePolicyResponse.builder()
                .id(p.getId())
                .name(p.getName())
                .kpiCycleId(p.getKpiCycle() != null ? p.getKpiCycle().getId() : null)
                .kpiCycleName(p.getKpiCycle() != null ? p.getKpiCycle().getName() : null)
                .unitFactorMode(p.getUnitFactorMode() != null ? p.getUnitFactorMode() : BscFactorMode.BAND_TABLE)
                .companyFactorMode(p.getCompanyFactorMode() != null ? p.getCompanyFactorMode() : BscFactorMode.BAND_TABLE)
                .factorBasis(p.getFactorBasis() != null ? p.getFactorBasis() : BscFactorBasis.OVERALL)
                .factorFloor(p.getFactorFloor())
                .factorCap(p.getFactorCap())
                .recognizedCapPercent(p.getRecognizedCapPercent())
                .minBscLinkedWeight(p.getMinBscLinkedWeight())
                .linkedWeightEnforce(p.getLinkedWeightEnforce() != null
                        ? p.getLinkedWeightEnforce() : BscLinkedWeightEnforce.WARN)
                .status(p.getStatus())
                .version(p.getVersion())
                .bands(bands)
                .build();
    }
}
