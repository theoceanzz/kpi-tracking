package com.kpitracking.event;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.entity.User;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.event.KpiEvents.KpiCriteriaApprovedEvent;
import com.kpitracking.event.KpiEvents.KpiCriteriaRejectedEvent;
import com.kpitracking.event.KpiEvents.KpiCriteriaApprovalRevertedEvent;
import com.kpitracking.event.KpiEvents.KpiCriteriaSubmittedForApprovalEvent;
import com.kpitracking.event.KpiEvents.KpiSubmittedEvent;
import com.kpitracking.event.KpiEvents.SubmissionReviewedEvent;
import com.kpitracking.service.notification.NotificationDispatcher;
import com.kpitracking.service.notification.NotificationRoutingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Thông báo của luồng KPI.
 *
 * <p>Người nhận được chọn theo PHÂN CẤP ({@link NotificationRoutingService}) chứ không phải
 * "mọi người có quyền ở mọi cấp cha ông" như trước: nhân viên nộp thì chỉ trưởng đơn vị của
 * họ nhận, trưởng đơn vị nộp thì thư leo thẳng lên sếp, và chỉ khi trưởng đơn vị đã DUYỆT
 * xong thì cấp trên kế tiếp mới được báo.
 *
 * <p>Email đi qua {@link NotificationDispatcher} nên được gom theo người nhận trước khi gửi;
 * chuông trong hệ thống vẫn hiện tức thời.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationEventListener {

    private final NotificationDispatcher dispatcher;
    private final NotificationRoutingService routing;

    private UUID getOrgId(KpiSubmission submission) {
        return submission.getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
    }

    private UUID getOrgId(KpiCriteria kpi) {
        return kpi.getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleKpiSubmitted(KpiSubmittedEvent event) {
        KpiSubmission submission = event.getSubmission();
        log.info("Handling KPI submitted event for submission: {}", submission.getId());

        KpiCriteria kpi = submission.getKpiCriteria();
        User submitter = submission.getSubmittedBy();

        String title = "Báo cáo KPI mới cần duyệt";
        String message = String.format("Nhân viên %s vừa nộp báo cáo cho chỉ tiêu KPI '%s'. Giá trị đạt được: %s. Vui lòng vào hệ thống để kiểm tra và duyệt.",
                submitter.getFullName(), kpi.getName(), submission.getActualValue());

        UUID orgId = getOrgId(submission);
        Set<UUID> notifiedIds = new HashSet<>();
        notifiedIds.add(submitter.getId());

        // CHỈ cấp duyệt gần nhất — không ai khác. Người nộp là trưởng đơn vị thì chính họ bị
        // loại và thang leo tiếp một cấp: "trưởng đơn vị nộp thì báo thẳng cho sếp".
        //
        // Người TẠO chỉ tiêu cố tình không có trong danh sách này: tổ chức nào để một người
        // nhân sự dựng KPI cho cả công ty thì người đó nhận thông báo của từng báo cáo trong
        // toàn bộ công ty, trong khi họ không phải người duyệt và không có việc gì để làm với
        // nó. Ai cần theo dõi thì mở màn hình chỉ tiêu, ở đó vốn đã thấy đủ.
        List<User> reviewers = routing.nearestWithPermission(
                submission.getOrgUnit(), "SUBMISSION:REVIEW", notifiedIds);
        for (User reviewer : reviewers) {
            if (notifiedIds.add(reviewer.getId())) {
                dispatcher.dispatch(orgId, "submission_submitted", reviewer, submission.getOrgUnit(),
                        title, message, "SUBMISSION", submission.getId());
            }
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleSubmissionReviewed(SubmissionReviewedEvent event) {
        KpiSubmission submission = event.getSubmission();
        log.info("Handling submission reviewed event for submission: {}", submission.getId());

        UUID orgId = getOrgId(submission);
        User submitter = submission.getSubmittedBy();
        User reviewer = submission.getReviewedBy();
        boolean approved = submission.getStatus() == SubmissionStatus.APPROVED;
        String statusText = approved ? "chấp nhận" : "từ chối";

        String title = "Báo cáo KPI đã được " + statusText;
        String message = String.format("Báo cáo cho chỉ tiêu '%s' của bạn đã được %s bởi %s.",
                submission.getKpiCriteria().getName(), statusText,
                reviewer != null ? reviewer.getFullName() : "hệ thống");

        if (submission.getReviewNote() != null) {
            message += " Ghi chú: " + submission.getReviewNote();
        }

        dispatcher.dispatch(orgId, "submission_reviewed", submitter, submission.getOrgUnit(),
                title, message, "REVIEW", submission.getId());

        escalateApprovedSubmission(submission, orgId, submitter, reviewer, approved);
    }

    /**
     * Báo lên cấp trên SAU KHI cấp dưới đã duyệt.
     *
     * <p>Đây là điểm khác căn bản so với trước: cấp trên không còn nhận thư ngay lúc nhân
     * viên bấm nộp — lúc đó việc chưa qua tay ai và chẳng có gì để họ xử lý. Chỉ khi cấp
     * duyệt trực tiếp đã chấp nhận thì kết quả mới nổi lên một bậc.
     *
     * <p>Bản nộp bị TỪ CHỐI thì dừng tại chỗ: nó quay lại cho người nộp làm lại chứ không
     * đi lên đâu cả.
     */
    private void escalateApprovedSubmission(KpiSubmission submission, UUID orgId,
                                            User submitter, User reviewer, boolean approved) {
        if (!approved || reviewer == null) return;

        Set<UUID> exclude = new HashSet<>();
        exclude.add(reviewer.getId());
        if (submitter != null) exclude.add(submitter.getId());

        List<User> superiors = routing.nearestAbove(
                submission.getOrgUnit(), reviewer.getId(), "SUBMISSION:REVIEW", exclude);
        if (superiors.isEmpty()) return;

        String title = "Báo cáo KPI đã được duyệt ở cấp dưới";
        String message = String.format(
                "%s đã duyệt báo cáo chỉ tiêu '%s' của %s. Giá trị đạt được: %s.",
                reviewer.getFullName(),
                submission.getKpiCriteria().getName(),
                submitter != null ? submitter.getFullName() : "nhân viên",
                submission.getActualValue());

        for (User superior : superiors) {
            dispatcher.dispatch(orgId, "submission_escalated", superior, submission.getOrgUnit(),
                    title, message, "SUBMISSION", submission.getId());
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleKpiApproved(KpiCriteriaApprovedEvent event) {
        KpiCriteria kpi = event.getKpiCriteria();
        log.info("Handling KPI approved event for KPI: {}", kpi.getId());

        UUID orgId = getOrgId(kpi);
        User creator = kpi.getCreatedBy();

        // Toggle: kpi_approved — thông báo cho người tạo KPI
        String approvedTitle = "Chỉ tiêu KPI đã được duyệt";
        String approvedMessage = String.format("Chỉ tiêu KPI '%s' do bạn tạo đã được phê duyệt bởi %s.",
                kpi.getName(), kpi.getApprovedBy().getFullName());

        dispatcher.dispatch(orgId, "kpi_approved", creator, kpi.getOrgUnit(),
                approvedTitle, approvedMessage, "KPI_APPROVED", kpi.getId());

        // Toggle: kpi_assigned — thông báo cho từng người được giao
        if (kpi.getAssignees() != null && !kpi.getAssignees().isEmpty()) {
            String assignedTitle = "KPI mới được giao";
            for (User assignee : kpi.getAssignees()) {
                if (!assignee.getId().equals(creator.getId())) {
                    String assignedMessage = String.format("Bạn vừa được giao một chỉ tiêu KPI mới: '%s'.", kpi.getName());
                    dispatcher.dispatch(orgId, "kpi_assigned", assignee, kpi.getOrgUnit(),
                            assignedTitle, assignedMessage, "KPI_ASSIGNED", kpi.getId());
                }
            }
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleKpiRejected(KpiCriteriaRejectedEvent event) {
        KpiCriteria kpi = event.getKpiCriteria();
        log.info("Handling KPI rejected event for KPI: {}", kpi.getId());

        UUID orgId = getOrgId(kpi);
        User creator = kpi.getCreatedBy();

        String title = "Chỉ tiêu KPI bị từ chối";
        String message = String.format("Chỉ tiêu KPI '%s' do bạn tạo đã bị từ chối bởi %s.",
                kpi.getName(), kpi.getApprovedBy().getFullName());

        if (kpi.getRejectReason() != null && !kpi.getRejectReason().isBlank()) {
            message += " Lý do: " + kpi.getRejectReason();
        }

        dispatcher.dispatch(orgId, "kpi_rejected", creator, kpi.getOrgUnit(),
                title, message, "KPI_REJECTED", kpi.getId());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleKpiSubmittedForApproval(KpiCriteriaSubmittedForApprovalEvent event) {
        KpiCriteria kpi = event.getKpiCriteria();
        log.info("Handling KPI submitted for approval event for KPI: {}", kpi.getId());

        UUID orgId = getOrgId(kpi);
        User submitter = kpi.getCreatedBy();

        String title = "Chỉ tiêu KPI mới cần phê duyệt";
        String message = String.format("%s vừa gửi chỉ tiêu KPI '%s' để chờ phê duyệt. Vui lòng vào hệ thống để xem xét.",
                submitter.getFullName(), kpi.getName());

        // Cùng quy tắc một cấp như bản nộp: chỉ người duyệt gần nhất nhận, không rải lên
        // toàn bộ cây quản lý.
        Set<UUID> notifiedIds = new HashSet<>();
        notifiedIds.add(submitter.getId());

        for (User approver : routing.nearestWithPermission(kpi.getOrgUnit(), "KPI:APPROVE_CRITERIA", notifiedIds)) {
            if (notifiedIds.add(approver.getId())) {
                dispatcher.dispatch(orgId, "kpi_submitted", approver, kpi.getOrgUnit(),
                        title, message, "KPI_SUBMITTED", kpi.getId());
            }
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleKpiApprovalReverted(KpiCriteriaApprovalRevertedEvent event) {
        KpiCriteria kpi = event.getKpiCriteria();
        log.info("Handling KPI approval reverted event for KPI: {}", kpi.getId());

        UUID orgId = getOrgId(kpi);
        User creator = kpi.getCreatedBy();

        String title = "Chỉ tiêu KPI bị hoàn duyệt";
        String message = String.format("Chỉ tiêu KPI '%s' do bạn tạo đã bị hoàn duyệt (huỷ phê duyệt) bởi %s và cần được xem xét lại.",
                kpi.getName(), event.getRevertedBy().getFullName());

        dispatcher.dispatch(orgId, "kpi_approval_reverted", creator, kpi.getOrgUnit(),
                title, message, "KPI_APPROVAL_REVERTED", kpi.getId());
    }
}
