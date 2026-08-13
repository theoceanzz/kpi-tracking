package com.kpitracking.service.reward;

import com.kpitracking.dto.request.reward.RewardBudgetRequest;
import com.kpitracking.dto.response.reward.RewardBudgetResponse;
import com.kpitracking.entity.KpiCycle;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.RewardBudget;
import com.kpitracking.entity.User;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.KpiCycleRepository;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.RewardBudgetRepository;
import com.kpitracking.repository.RewardGrantRepository;
import com.kpitracking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Cấp và tra cứu hạn mức điểm của người được phép trao thưởng.
 *
 * <p>Điểm mấu chốt: KHÔNG có cột đếm "đã dùng". Hạn mức đã dùng luôn được tính bằng
 * tổng các đề nghị đang chờ duyệt và đã duyệt trỏ về ngân sách. Xem
 * {@link RewardGrantRepository#sumUsedPointsByBudgetId}.
 */
@Service
@RequiredArgsConstructor
public class RewardBudgetService {

    /** Múi giờ dùng để quy "hôm nay" khi so với khoảng hiệu lực của ngân sách. */
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final RewardBudgetRepository budgetRepository;
    private final RewardGrantRepository grantRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final KpiCycleRepository kpiCycleRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final RewardContext context;

    public static LocalDate today() {
        return LocalDate.now(ZONE);
    }

    @Transactional
    public RewardBudgetResponse create(RewardBudgetRequest request) {
        UUID orgId = context.getCurrentOrgId();
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));
        User grantor = userRepository.findById(request.getGrantorUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "id", request.getGrantorUserId()));

        RewardBudget budget = RewardBudget.builder()
                .organization(org)
                .grantor(grantor)
                .allocatedPoints(request.getAllocatedPoints())
                .maxPerAward(request.getMaxPerAward())
                .note(request.getNote())
                .build();

        applyPeriod(budget, request);

        try {
            budgetRepository.save(budget);
        } catch (DataIntegrityViolationException ex) {
            // Exclusion constraint ex_reward_budgets_no_overlap. Dịch sang thông báo
            // người dùng hiểu được, thay vì để lộ tên ràng buộc của PostgreSQL.
            throw new BusinessException("Người này đã có hạn mức trong khoảng thời gian trùng với khoảng bạn chọn. "
                    + "Mỗi người tại một thời điểm chỉ được có một hạn mức — hãy sửa hạn mức cũ hoặc chọn khoảng khác.");
        }
        return toResponse(budget);
    }

    @Transactional
    public RewardBudgetResponse update(UUID id, RewardBudgetRequest request) {
        RewardBudget budget = budgetRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Hạn mức thưởng", "id", id));

        int used = grantRepository.sumUsedPointsByBudgetId(budget.getId());

        // Hạ hạn mức xuống dưới mức đã tiêu là một lệnh vô nghĩa: các đề nghị đã duyệt
        // không thể rút lại bằng cách sửa con số ở đây. Chặn sớm và nói rõ con số thật.
        if (request.getAllocatedPoints() < used) {
            throw new BusinessException("Không thể hạ hạn mức xuống " + request.getAllocatedPoints()
                    + " điểm vì đã sử dụng " + used + " điểm. Hãy thu hồi bớt đề nghị thưởng trước.");
        }

        LocalDate oldStart = budget.getPeriodStart();
        LocalDate oldEnd = budget.getPeriodEnd();

        budget.setAllocatedPoints(request.getAllocatedPoints());
        budget.setMaxPerAward(request.getMaxPerAward());
        budget.setNote(request.getNote());
        applyPeriod(budget, request);

        // THU HẸP khoảng ngày khi hạn mức đã dùng sẽ đẩy các đề nghị đã tính vào đây ra
        // ngoài khoảng hiệu lực — con số "đã dùng" vẫn tính chúng nhưng khoảng thời gian
        // lại nói chúng không thuộc về hạn mức này. NỚI RỘNG thì vô hại nên vẫn cho.
        if (used > 0
                && (budget.getPeriodStart().isAfter(oldStart) || budget.getPeriodEnd().isBefore(oldEnd))) {
            throw new BusinessException("Không thể thu hẹp khoảng hiệu lực của hạn mức đã sử dụng "
                    + used + " điểm — các đề nghị đã trao sẽ nằm ngoài khoảng mới. "
                    + "Bạn chỉ có thể mở rộng khoảng (từ " + fmt(oldStart) + " – " + fmt(oldEnd) + ").");
        }

        try {
            budgetRepository.save(budget);
        } catch (DataIntegrityViolationException ex) {
            throw new BusinessException("Khoảng thời gian mới bị trùng với một hạn mức khác của người này.");
        }
        return toResponse(budget);
    }

    /**
     * Xoá hạn mức — CHỈ khi chưa có đề nghị thưởng nào tính vào nó.
     *
     * <p>Hạn mức đã dùng mà bị xoá sẽ để lại một lỗ hổng sổ sách: các đề nghị vẫn trỏ về
     * nó, nhưng nếu cấp một hạn mức mới cho cùng người thì phép tính "đã dùng" của hạn
     * mức mới bắt đầu lại từ 0 — người quản lý được reset quota mà không ai biết. Xoá
     * rồi cấp lại sẽ thành cách lách hạn mức dễ nhất.
     *
     * <p>Muốn dừng quyền tự thưởng của ai đó thì hạ hạn mức xuống bằng đúng số đã dùng
     * (còn lại 0), hoặc để nó hết hiệu lực theo ngày.
     */
    @Transactional
    public void delete(UUID id) {
        RewardBudget budget = budgetRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Hạn mức thưởng", "id", id));

        long grantCount = grantRepository.countByBudgetId(id);
        if (grantCount > 0) {
            int used = grantRepository.sumUsedPointsByBudgetId(id);
            throw new BusinessException("Không thể xoá hạn mức của " + budget.getGrantor().getFullName()
                    + " vì đã có " + grantCount + " đề nghị thưởng tính vào hạn mức này (đã dùng "
                    + used + " điểm). Xoá sẽ làm sai sổ sách hạn mức. "
                    + "Muốn dừng quyền tự thưởng, hãy hạ tổng điểm được cấp xuống còn " + used
                    + " điểm, hoặc để hạn mức hết hiệu lực theo ngày.");
        }

        budget.setDeletedAt(Instant.now());
        budgetRepository.save(budget);
    }

    @Transactional(readOnly = true)
    public List<RewardBudgetResponse> listForOrg() {
        return budgetRepository.findByOrganizationIdOrderByPeriodStartDesc(context.getCurrentOrgId())
                .stream().map(this::toResponse).toList();
    }

    /** Hạn mức đang hiệu lực của chính người đang đăng nhập; null nếu chưa được cấp. */
    @Transactional(readOnly = true)
    public RewardBudgetResponse getMyActiveBudget() {
        User me = context.getCurrentUser();
        return budgetRepository.findActive(context.getOrgIdOf(me.getId()), me.getId(), today())
                .map(this::toResponse)
                .orElse(null);
    }

    /**
     * Quy khoảng hiệu lực về hai cột ngày.
     *
     * <p>Khi gắn kỳ hoặc đợt, ngày được COPY xuống chứ không tham chiếu động: hạn mức đã
     * cấp là một cam kết, nó không nên tự dịch chuyển khi ai đó sửa ngày của kỳ/đợt. Giao
     * diện sẽ cảnh báo lệch và cho đồng bộ lại thủ công.
     */
    private void applyPeriod(RewardBudget budget, RewardBudgetRequest request) {
        if (request.getKpiCycleId() != null && request.getKpiPeriodId() != null) {
            throw new BusinessException("Chỉ được gắn hạn mức vào kỳ HOẶC đợt, không phải cả hai.");
        }

        if (request.getKpiCycleId() != null) {
            KpiCycle cycle = kpiCycleRepository.findById(request.getKpiCycleId())
                    .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá", "id", request.getKpiCycleId()));
            applyRange(budget, cycle.getStartDate(), cycle.getEndDate(), "Kỳ", cycle.getName());
            budget.setKpiCycle(cycle);
            budget.setKpiPeriod(null);
            return;
        }

        if (request.getKpiPeriodId() != null) {
            KpiPeriod period = kpiPeriodRepository.findById(request.getKpiPeriodId())
                    .orElseThrow(() -> new ResourceNotFoundException("Đợt đánh giá", "id", request.getKpiPeriodId()));
            applyRange(budget, period.getStartDate(), period.getEndDate(), "Đợt", period.getName());
            budget.setKpiPeriod(period);
            budget.setKpiCycle(null);
            return;
        }

        if (request.getPeriodStart() == null || request.getPeriodEnd() == null) {
            throw new BusinessException("Vui lòng chọn kỳ, đợt, hoặc nhập khoảng thời gian áp dụng hạn mức.");
        }
        if (request.getPeriodEnd().isBefore(request.getPeriodStart())) {
            throw new BusinessException("Ngày kết thúc phải sau ngày bắt đầu.");
        }
        budget.setKpiCycle(null);
        budget.setKpiPeriod(null);
        budget.setPeriodStart(request.getPeriodStart());
        budget.setPeriodEnd(request.getPeriodEnd());
    }

    private static String fmt(LocalDate d) {
        return d.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"));
    }

    private void applyRange(RewardBudget budget, Instant start, Instant end, String kind, String name) {
        if (start == null || end == null) {
            throw new BusinessException(kind + " \"" + name
                    + "\" chưa có ngày bắt đầu/kết thúc nên không dùng để khoanh hạn mức được.");
        }
        budget.setPeriodStart(LocalDate.ofInstant(start, ZONE));
        budget.setPeriodEnd(LocalDate.ofInstant(end, ZONE));
    }

    public RewardBudgetResponse toResponse(RewardBudget budget) {
        int used = grantRepository.sumUsedPointsByBudgetId(budget.getId());
        KpiCycle cycle = budget.getKpiCycle();
        KpiPeriod period = budget.getKpiPeriod();

        // Ngày của kỳ/đợt bị sửa SAU khi cấp hạn mức. Hệ thống cố ý không tự chạy theo
        // (hạn mức đã cấp là cam kết), chỉ báo để người quản trị tự quyết đồng bộ hay không.
        boolean outOfSync = false;
        if (cycle != null) {
            outOfSync = isOutOfSync(budget, cycle.getStartDate(), cycle.getEndDate());
        } else if (period != null) {
            outOfSync = isOutOfSync(budget, period.getStartDate(), period.getEndDate());
        }

        return RewardBudgetResponse.builder()
                .id(budget.getId())
                .grantorUserId(budget.getGrantor().getId())
                .grantorName(budget.getGrantor().getFullName())
                .grantorEmail(budget.getGrantor().getEmail())
                .kpiCycleId(cycle != null ? cycle.getId() : null)
                .kpiCycleName(cycle != null ? cycle.getName() : null)
                .kpiPeriodId(period != null ? period.getId() : null)
                .kpiPeriodName(period != null ? period.getName() : null)
                .periodStart(budget.getPeriodStart())
                .periodEnd(budget.getPeriodEnd())
                .allocatedPoints(budget.getAllocatedPoints())
                .usedPoints(used)
                .remainingPoints(budget.getAllocatedPoints() - used)
                .maxPerAward(budget.getMaxPerAward())
                .note(budget.getNote())
                .cycleDatesOutOfSync(outOfSync)
                .build();
    }

    private boolean isOutOfSync(RewardBudget budget, Instant start, Instant end) {
        if (start == null || end == null) return false;
        return !budget.getPeriodStart().equals(LocalDate.ofInstant(start, ZONE))
            || !budget.getPeriodEnd().equals(LocalDate.ofInstant(end, ZONE));
    }

    /** Dùng bởi {@code RewardGrantService} khi cần bản KHÔNG khoá để hiển thị. */
    @Transactional(readOnly = true)
    public Optional<RewardBudget> findActive(UUID orgId, UUID grantorId) {
        return budgetRepository.findActive(orgId, grantorId, today());
    }
}
