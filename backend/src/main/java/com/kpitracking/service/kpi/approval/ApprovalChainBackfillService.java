package com.kpitracking.service.kpi.approval;

import com.kpitracking.entity.KpiAdjustmentRequest;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.Organization;
import com.kpitracking.enums.ApprovalEventAction;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.repository.KpiAdjustmentRequestRepository;
import com.kpitracking.repository.KpiApprovalFlowRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;

/**
 * Chuyển KPI đang chờ duyệt theo luồng một cấp sang chuỗi duyệt (quyết định C12a).
 *
 * <p>Lập chuỗi theo cơ cấu HIỆN TẠI, bắt đầu từ bước 1, người gửi là người tạo (điều chỉnh: người
 * xin), ghi {@code MIGRATED} và KHÔNG gửi thông báo hàng loạt. Chạy khi ứng dụng khởi động và khi
 * một tổ chức chuyển cấu hình sang CHAIN. Lặp lại vô hại: chỉ xét đối tượng chưa có flow đang chạy.
 *
 * <p>Mỗi đối tượng một transaction riêng: một KPI không lập được chuỗi (không tìm ra người duyệt)
 * chỉ để lại cảnh báo trong log, không chặn các KPI khác. KPI đó vẫn được lập chuỗi lại lúc có người
 * bấm duyệt, và khi ấy người dùng nhận thông báo lỗi rõ ràng.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ApprovalChainBackfillService {

    private final OrganizationRepository organizationRepository;
    private final KpiApprovalFlowRepository flowRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KpiAdjustmentRequestRepository adjustmentRepository;
    private final KpiApprovalChainService chainService;
    private final TransactionTemplate transactionTemplate;

    @Value("${app.approval-chain.backfill-on-startup:true}")
    private boolean backfillOnStartup;

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        if (!backfillOnStartup) return;
        for (Organization org : organizationRepository.findAll()) {
            try {
                backfillOrganization(org.getId());
            } catch (Exception e) {
                log.warn("Không chuyển được KPI chờ duyệt của tổ chức {} sang chuỗi duyệt: {}", org.getId(), e.getMessage());
            }
        }
    }

    /** @return số đối tượng đã lập chuỗi */
    public int backfillOrganization(UUID organizationId) {
        if (!chainService.isChainMode(organizationId)) return 0;
        int done = 0;
        for (UUID kpiId : flowRepository.findLegacyPendingCriteriaIds(organizationId)) {
            done += runOne(() -> {
                KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId).orElse(null);
                if (kpi == null || kpi.getStatus() != KpiStatus.PENDING_APPROVAL || kpi.getCreatedBy() == null) return false;
                if (chainService.runningCriteriaFlowId(kpiId).isPresent()) return false;
                chainService.startCriteria(kpi, kpi.getCreatedBy(), ApprovalEventAction.MIGRATED, false);
                return true;
            }, "chỉ tiêu " + kpiId);
        }
        for (UUID adjId : flowRepository.findLegacyPendingAdjustmentIds(organizationId)) {
            done += runOne(() -> {
                KpiAdjustmentRequest adj = adjustmentRepository.findById(adjId).orElse(null);
                if (adj == null || chainService.runningAdjustmentFlowId(adjId).isPresent()) return false;
                chainService.startAdjustment(adj, adj.getRequester(), ApprovalEventAction.MIGRATED, false);
                return true;
            }, "yêu cầu điều chỉnh " + adjId);
        }
        if (done > 0) log.info("Đã chuyển {} đối tượng đang chờ duyệt của tổ chức {} sang chuỗi duyệt", done, organizationId);
        return done;
    }

    private int runOne(java.util.function.Supplier<Boolean> work, String label) {
        try {
            Boolean ok = transactionTemplate.execute(tx -> work.get());
            return Boolean.TRUE.equals(ok) ? 1 : 0;
        } catch (Exception e) {
            log.warn("Bỏ qua {} khi chuyển sang chuỗi duyệt: {}", label, e.getMessage());
            return 0;
        }
    }
}
