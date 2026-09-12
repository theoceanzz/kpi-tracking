package com.kpitracking.service;

import com.kpitracking.dto.request.bsc.CascadePolicyRequest;
import com.kpitracking.dto.response.bsc.CascadePolicyResponse;
import com.kpitracking.dto.response.bsc.ScorecardPeriodResponse;
import com.kpitracking.entity.BscCascadePolicy;
import com.kpitracking.entity.KpiCycle;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.Organization;
import com.kpitracking.enums.BscLinkedWeightEnforce;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.BscCascadePolicyRepository;
import com.kpitracking.repository.KpiCycleRepository;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Chính sách điểm BSC: trần điểm công nhận và ràng buộc KPI phải liên kết BSC (QĐ-8).
 *
 * <p>Chỉ còn hai con số này là thật sự tác động: trần quyết định điểm công nhận của mọi cá nhân,
 * ngưỡng liên kết quyết định ai bị cảnh báo (hoặc bị chặn chốt) vì KPI không bám vào cây BSC.
 * Bảng dải và các tham số hệ số đã bị gỡ cùng lúc với việc bỏ hệ số phòng/công ty.
 *
 * <p><b>Phạm vi áp dụng</b> giống bộ tiêu chí: gắn theo ĐỢT (chọn nhiều), theo KỲ (mọi đợt trong
 * kỳ), hoặc để trống cả hai làm bản MẶC ĐỊNH. Lúc chấm, {@code resolvePolicy} tra từ hẹp tới rộng:
 * đợt → kỳ → mặc định → hằng số.
 *
 * <p>Không có bản ghi chính sách nào thì hệ thống chạy bằng hằng số mặc định trong
 * {@link BscCascadeService} (120 / 60), nên tổ chức không cấu hình gì vẫn có hành vi xác định.
 */
@Service
@RequiredArgsConstructor
public class BscPolicyService {

    private final BscCascadePolicyRepository policyRepository;
    private final OrganizationRepository organizationRepository;
    private final KpiCycleRepository kpiCycleRepository;
    private final KpiPeriodRepository kpiPeriodRepository;

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

        KpiCycle cycle = resolveCycle(request.getKpiCycleId());
        List<KpiPeriod> periods = resolvePeriods(request.getKpiPeriodIds());
        assertScopeSane(cycle, periods);
        assertNoConflict(organizationId, cycle, periods, null);

        BscCascadePolicy policy = BscCascadePolicy.builder()
                .organization(org)
                .name(request.getName().trim())
                .kpiCycle(cycle)
                .kpiPeriods(new ArrayList<>(periods))
                .build();
        apply(policy, request);
        return toResponse(policyRepository.save(policy));
    }

    @Transactional
    public CascadePolicyResponse update(UUID policyId, CascadePolicyRequest request) {
        BscCascadePolicy policy = policyRepository.findById(policyId)
                .orElseThrow(() -> new ResourceNotFoundException("Chính sách hệ số", "id", policyId));
        validate(request);
        KpiCycle cycle = resolveCycle(request.getKpiCycleId());
        List<KpiPeriod> periods = resolvePeriods(request.getKpiPeriodIds());
        assertScopeSane(cycle, periods);
        assertNoConflict(policy.getOrganization().getId(), cycle, periods, policy.getId());
        policy.setName(request.getName().trim());
        policy.setKpiCycle(cycle);
        // Danh sách gửi lên là authoritative: bỏ tick một đợt ở màn cấu hình = gỡ đợt đó khỏi chính sách.
        policy.getKpiPeriods().clear();
        policy.getKpiPeriods().addAll(periods);
        apply(policy, request);
        // Sửa chính sách đang dùng = đổi cách chấm cho các kỳ CHƯA chốt. Tăng version để đối chiếu
        // được về sau khi có ai hỏi "sao điểm kỳ này khác kỳ trước".
        policy.setVersion(policy.getVersion() != null ? policy.getVersion() + 1 : 1);
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
        if (r.getRecognizedCapPercent() != null) policy.setRecognizedCapPercent(r.getRecognizedCapPercent());
        if (r.getMinBscLinkedWeight() != null) policy.setMinBscLinkedWeight(r.getMinBscLinkedWeight());
        if (r.getLinkedWeightEnforce() != null) policy.setLinkedWeightEnforce(r.getLinkedWeightEnforce());
    }

    private void validate(CascadePolicyRequest r) {
        if (r.getRecognizedCapPercent() != null && r.getRecognizedCapPercent() <= 0) {
            throw new BusinessException("Trần điểm công nhận phải lớn hơn 0");
        }
        if (r.getMinBscLinkedWeight() != null
                && (r.getMinBscLinkedWeight() < 0 || r.getMinBscLinkedWeight() > 100)) {
            throw new BusinessException("Tỉ trọng KPI liên kết BSC phải nằm trong khoảng 0–100%");
        }
    }

    /** Gắn kỳ hay gắn đợt — chọn một, không nhập nhằng cả hai. */
    private void assertScopeSane(KpiCycle cycle, List<KpiPeriod> periods) {
        if (cycle != null && !periods.isEmpty()) {
            throw new BusinessException("Chọn áp dụng theo KỲ hoặc theo ĐỢT, không chọn cả hai");
        }
    }

    /**
     * Mỗi phạm vi chỉ được MỘT chính sách: một đợt không nằm trong hai chính sách đợt, một kỳ không
     * có hai chính sách kỳ, và tổ chức chỉ một bản mặc định.
     *
     * <p>{@code resolvePolicy} lấy bản ghi đầu tiên khớp, nên hai chính sách cùng phủ một phạm vi
     * nghĩa là điểm chạy theo bản nào tuỳ thứ tự truy vấn — đúng loại lỗi không ai phát hiện ra cho
     * tới khi hai người so điểm với nhau. Chặn ngay lúc lưu.
     *
     * <p>Chồng lấn giữa các CẤP thì không chặn: gắn riêng một đợt trong khi kỳ của nó đã có chính
     * sách là chuyện cố ý ("cả kỳ dùng trần 120, riêng đợt cuối năm 130") — cấp hẹp hơn thắng.
     */
    private void assertNoConflict(UUID organizationId, KpiCycle cycle, List<KpiPeriod> periods, UUID selfId) {
        for (KpiPeriod period : periods) {
            for (BscCascadePolicy p : policyRepository.findActiveByPeriod(organizationId, period.getId())) {
                if (selfId != null && selfId.equals(p.getId())) continue;
                throw new BusinessException("Đợt " + period.getName() + " đã nằm trong chính sách '"
                        + p.getName() + "' — sửa chính sách đó thay vì tạo thêm");
            }
        }
        if (!periods.isEmpty()) return;

        List<BscCascadePolicy> existing = cycle == null
                ? policyRepository.findActiveDefault(organizationId)
                : policyRepository.findActiveByCycle(organizationId, cycle.getId());
        for (BscCascadePolicy p : existing) {
            if (selfId != null && selfId.equals(p.getId())) continue;
            throw new BusinessException(cycle == null
                    ? "Tổ chức đã có chính sách mặc định ('" + p.getName() + "') — sửa chính sách đó thay vì tạo thêm"
                    : "Kỳ " + cycle.getName() + " đã có chính sách riêng ('" + p.getName()
                      + "') — sửa chính sách đó thay vì tạo thêm");
        }
    }

    private List<KpiPeriod> resolvePeriods(List<UUID> periodIds) {
        if (periodIds == null || periodIds.isEmpty()) return List.of();
        List<KpiPeriod> periods = new ArrayList<>();
        for (UUID id : periodIds) {
            periods.add(kpiPeriodRepository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Đợt KPI", "id", id)));
        }
        return periods;
    }

    private KpiCycle resolveCycle(UUID cycleId) {
        if (cycleId == null) return null;
        return kpiCycleRepository.findById(cycleId)
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá", "id", cycleId));
    }

    private List<ScorecardPeriodResponse> periodsOf(BscCascadePolicy p) {
        if (p.getKpiPeriods() == null) return List.of();
        return p.getKpiPeriods().stream()
                .map(x -> ScorecardPeriodResponse.builder().id(x.getId()).name(x.getName()).build())
                .collect(Collectors.toList());
    }

    /** Chữ hiển thị trên chip chọn chính sách: tên kỳ, danh sách đợt, hoặc "Mặc định". */
    private String scopeLabelOf(BscCascadePolicy p) {
        if (p.getKpiCycle() != null) return p.getKpiCycle().getName();
        if (p.getKpiPeriods() != null && !p.getKpiPeriods().isEmpty()) {
            return p.getKpiPeriods().stream().map(KpiPeriod::getName).collect(Collectors.joining(", "));
        }
        return "Mặc định";
    }

    private CascadePolicyResponse toResponse(BscCascadePolicy p) {
        return CascadePolicyResponse.builder()
                .id(p.getId())
                .name(p.getName())
                .kpiCycleId(p.getKpiCycle() != null ? p.getKpiCycle().getId() : null)
                .kpiCycleName(p.getKpiCycle() != null ? p.getKpiCycle().getName() : null)
                .periods(periodsOf(p))
                .scopeLabel(scopeLabelOf(p))
                .recognizedCapPercent(p.getRecognizedCapPercent())
                .minBscLinkedWeight(p.getMinBscLinkedWeight())
                .linkedWeightEnforce(p.getLinkedWeightEnforce() != null
                        ? p.getLinkedWeightEnforce() : BscLinkedWeightEnforce.WARN)
                .status(p.getStatus())
                .version(p.getVersion())
                .build();
    }
}
