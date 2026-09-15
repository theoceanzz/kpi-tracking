package com.kpitracking.event;

import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.RewardBudget;
import com.kpitracking.entity.RewardGrant;
import com.kpitracking.entity.RewardGrantItem;
import com.kpitracking.entity.RewardProgramRun;
import com.kpitracking.entity.RewardProgramRunItem;
import com.kpitracking.entity.RewardRedemption;
import com.kpitracking.entity.User;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.RewardBudgetRepository;
import com.kpitracking.repository.RewardGrantItemRepository;
import com.kpitracking.repository.RewardGrantRepository;
import com.kpitracking.repository.RewardProgramRunItemRepository;
import com.kpitracking.repository.RewardProgramRunRepository;
import com.kpitracking.repository.RewardRedemptionRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.service.notification.NotificationDispatcher;
import com.kpitracking.service.notification.NotificationRoutingService;
import com.kpitracking.service.reward.RewardContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Thông báo của luồng điểm thưởng — song song với {@link BscNotificationEventListener} của luồng
 * BSC và {@link NotificationEventListener} của luồng KPI, dùng đúng bộ hạ tầng đó:
 * {@link NotificationRoutingService} chọn người nhận theo phân cấp,
 * {@link NotificationDispatcher} bật/tắt theo cấu hình tổ chức rồi đẩy chuông + xếp email chờ gộp.
 *
 * <p>Quy tắc người nhận:
 * <ul>
 *   <li>Đề nghị vượt hạn mức ⇒ chỉ cấp có {@code REWARD:APPROVE} GẦN NHẤT phía trên đơn vị của
 *       đề nghị nhận, không rải lên cả cây quản lý.</li>
 *   <li>Duyệt / từ chối ⇒ báo ngược về đúng người trao đã đứng tên đề nghị.</li>
 *   <li>Điểm vào ví, điểm bị thu hồi ⇒ báo cho CHÍNH người nhận điểm, từng người một. Đây là
 *       thay đổi số dư của họ; gộp thành một thư gửi người trao thì người bị trừ không hề biết.</li>
 *   <li>Đặt đổi quà ⇒ báo cho người có {@code GIFT:FULFILL} gần nhất — họ là người phải xuất quà.</li>
 * </ul>
 *
 * <p><b>Vì sao thưởng dùng {@code dispatch} (gộp thư) chứ không {@code dispatchImmediate} như ví
 * tiền:</b> người nhận thưởng không ngồi chờ màn hình xác nhận như người vừa chuyển khoản, và một
 * đợt phát thưởng chương trình có thể chạm tới hàng trăm người cùng lúc. Ngoại lệ duy nhất là
 * thưởng bị THU HỒI — số dư tụt xuống mà không ai báo ngay là thứ người dùng phát hiện bằng cách
 * mở ví ra và hoảng.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RewardNotificationEventListener {

    private final NotificationDispatcher dispatcher;
    private final NotificationRoutingService routing;
    private final RewardContext context;
    private final RewardGrantRepository grantRepository;
    private final RewardGrantItemRepository grantItemRepository;
    private final RewardBudgetRepository budgetRepository;
    private final RewardProgramRunRepository runRepository;
    private final RewardProgramRunItemRepository runItemRepository;
    private final RewardRedemptionRepository redemptionRepository;
    private final UserRepository userRepository;
    private final OrgUnitRepository orgUnitRepository;

    /** Nhãn kiểu thông báo — quyết định biểu tượng ở chuông. */
    private static final String TYPE_GRANT = "REWARD_GRANT";
    private static final String TYPE_POINT = "REWARD_POINT";
    private static final String TYPE_GIFT = "REWARD_GIFT";

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    // ============================================================
    // Thưởng thủ công — vòng đời duyệt
    // ============================================================

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleGrantSubmitted(RewardEvents.GrantSubmitted event) {
        RewardGrant grant = findGrant(event.grantId());
        if (grant == null) return;

        int people = grantItemRepository.findByGrantId(grant.getId()).size();
        String title = "Đề nghị thưởng cần duyệt";
        String message = String.format(
                "%s đề nghị thưởng %d điểm cho %d nhân viên. Lý do: %s. %s",
                nameOf(event.actorId(), "Một cán bộ quản lý"),
                grant.getTotalPoints(), people, reasonOf(grant),
                grant.getApprovalReason() == null
                        ? "Đề nghị này cần bạn duyệt."
                        : grant.getApprovalReason());

        Set<UUID> notified = new HashSet<>();
        if (event.actorId() != null) notified.add(event.actorId());

        OrgUnit unit = grant.getOrgUnit();
        for (User approver : routing.nearestWithPermission(unit, "REWARD:APPROVE", notified)) {
            if (notified.add(approver.getId())) {
                dispatcher.dispatch(orgIdOf(grant), "reward_grant_submitted", approver, unit,
                        title, message, TYPE_GRANT, grant.getId());
            }
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleGrantApproved(RewardEvents.GrantApproved event) {
        RewardGrant grant = findGrant(event.grantId());
        if (grant == null) return;

        String message = String.format(
                "Đề nghị thưởng %d điểm của bạn (lý do: %s) đã được %s duyệt. Điểm đã vào ví của "
                + "những người được thưởng.%s",
                grant.getTotalPoints(), reasonOf(grant),
                nameOf(event.actorId(), "cấp trên"), noteSuffix(grant.getDecisionNote()));

        dispatchTo(grant.getGrantor(), orgIdOf(grant), "reward_grant_approved",
                "Đề nghị thưởng đã được duyệt", message, TYPE_GRANT, grant.getId(), false);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleGrantRejected(RewardEvents.GrantRejected event) {
        RewardGrant grant = findGrant(event.grantId());
        if (grant == null) return;

        String message = String.format(
                "Đề nghị thưởng %d điểm của bạn (lý do: %s) đã bị %s từ chối. Không có ai bị trừ "
                + "hoặc được cộng điểm, và hạn mức của bạn được trả lại nguyên vẹn.%s",
                grant.getTotalPoints(), reasonOf(grant),
                nameOf(event.actorId(), "cấp trên"), noteSuffix(event.note()));

        dispatchTo(grant.getGrantor(), orgIdOf(grant), "reward_grant_rejected",
                "Đề nghị thưởng bị từ chối", message, TYPE_GRANT, grant.getId(), false);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleGrantCancelled(RewardEvents.GrantCancelled event) {
        RewardGrant grant = findGrant(event.grantId());
        if (grant == null) return;

        String message = String.format(
                "%s đã rút lại đề nghị thưởng %d điểm (lý do: %s). Đề nghị này không còn chờ bạn duyệt nữa.",
                nameOf(event.actorId(), "Người trao"), grant.getTotalPoints(), reasonOf(grant));

        Set<UUID> notified = new HashSet<>();
        if (event.actorId() != null) notified.add(event.actorId());

        OrgUnit unit = grant.getOrgUnit();
        for (User approver : routing.nearestWithPermission(unit, "REWARD:APPROVE", notified)) {
            if (notified.add(approver.getId())) {
                dispatcher.dispatch(orgIdOf(grant), "reward_grant_cancelled", approver, unit,
                        "Đề nghị thưởng đã được rút lại", message, TYPE_GRANT, grant.getId());
            }
        }
    }

    // ============================================================
    // Thưởng thủ công — điểm vào và ra khỏi ví
    // ============================================================

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleGrantIssued(RewardEvents.GrantIssued event) {
        RewardGrant grant = findGrant(event.grantId());
        if (grant == null) return;

        UUID orgId = orgIdOf(grant);
        String grantorName = grant.getGrantor() != null
                ? grant.getGrantor().getFullName() : "Ban lãnh đạo";

        for (RewardGrantItem item : grantItemRepository.findByGrantId(grant.getId())) {
            String message = String.format(
                    "Bạn được %s thưởng %d điểm. Lý do: %s.%s",
                    grantorName, item.getPoints(), reasonOf(grant),
                    Boolean.TRUE.equals(grant.getCertificateEnabled())
                            ? " Kèm theo là một giấy chứng nhận, xem ở mục Phần thưởng của tôi."
                            : "");

            dispatchTo(item.getUser(), orgId, "reward_points_received",
                    "Bạn được thưởng " + item.getPoints() + " điểm",
                    message, TYPE_POINT, grant.getId(), false);
        }
    }

    /**
     * Thu hồi thì gửi NGAY, không xếp vào hàng đợi gom thư.
     *
     * <p>Điểm biến mất khỏi ví là thay đổi người dùng sẽ tự nhận ra trong vài phút — và nếu nhận
     * ra trước khi lời giải thích tới nơi thì họ báo là hệ thống tính sai. Số dư có thể xuống ÂM
     * khi thu hồi cưỡng chế, nên câu chữ phải nói thẳng con số thay vì để họ tự suy.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleGrantRevoked(RewardEvents.GrantRevoked event) {
        RewardGrant grant = findGrant(event.grantId());
        if (grant == null) return;

        UUID orgId = orgIdOf(grant);
        String actorName = nameOf(event.actorId(), "Quản trị viên");
        List<RewardGrantItem> items = grantItemRepository.findByGrantId(grant.getId());

        for (RewardGrantItem item : items) {
            String message = String.format(
                    "%s đã thu hồi khoản thưởng %d điểm trước đó của bạn (lý do thưởng: %s). "
                    + "Số điểm này đã được trừ khỏi ví.%s",
                    actorName, item.getPoints(), reasonOf(grant), noteSuffix(event.note()));

            dispatchTo(item.getUser(), orgId, "reward_grant_revoked",
                    "Khoản thưởng đã bị thu hồi", message, TYPE_POINT, grant.getId(), true);
        }

        // Người trao cũng phải biết: hạn mức của họ vừa được trả lại và đề nghị họ đứng tên
        // không còn hiệu lực — nếu chỉ báo cho người nhận thì họ vẫn tưởng khoản kia đang chạy.
        if (grant.getGrantor() != null
                && (event.actorId() == null || !grant.getGrantor().getId().equals(event.actorId()))) {
            dispatchTo(grant.getGrantor(), orgId, "reward_grant_revoked",
                    "Đề nghị thưởng của bạn đã bị thu hồi",
                    String.format("%s đã thu hồi đề nghị thưởng %d điểm cho %d nhân viên của bạn "
                            + "(lý do: %s). Số điểm đã trừ lại khỏi ví người nhận và hạn mức của "
                            + "bạn được hoàn.%s",
                            actorName, grant.getTotalPoints(), items.size(),
                            reasonOf(grant), noteSuffix(event.note())),
                    TYPE_GRANT, grant.getId(), true);
        }
    }

    // ============================================================
    // Hạn mức
    // ============================================================

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleBudgetAssigned(RewardEvents.BudgetAssigned event) {
        RewardBudget budget = budgetRepository.findById(event.budgetId()).orElse(null);
        if (budget == null) return;

        String title = event.updated() ? "Hạn mức thưởng của bạn đã thay đổi" : "Bạn được cấp hạn mức thưởng";
        String message = String.format(
                "%s hạn mức %d điểm, hiệu lực từ %s đến %s.%s Trong hạn mức này bạn thưởng cho "
                + "nhân viên được duyệt ngay, vượt hạn mức thì đề nghị sẽ chuyển lên cấp trên duyệt.",
                event.updated()
                        ? nameOf(event.actorId(), "Cấp trên") + " đã điều chỉnh"
                        : nameOf(event.actorId(), "Cấp trên") + " vừa cấp cho bạn",
                budget.getAllocatedPoints(),
                budget.getPeriodStart() == null ? "—" : budget.getPeriodStart().format(DATE),
                budget.getPeriodEnd() == null ? "—" : budget.getPeriodEnd().format(DATE),
                budget.getMaxPerAward() == null
                        ? ""
                        : " Tối đa " + budget.getMaxPerAward() + " điểm mỗi lần thưởng cho một người.");

        dispatchTo(budget.getGrantor(), budget.getOrganization().getId(), "reward_budget_assigned",
                title, message, TYPE_GRANT, budget.getId(), false);
    }

    // ============================================================
    // Chương trình thưởng tự động
    // ============================================================

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleRunIssued(RewardEvents.RunIssued event) {
        RewardProgramRun run = findRun(event.runId());
        if (run == null) return;

        UUID orgId = run.getOrganization().getId();
        String programName = run.getProgram().getName();

        for (RewardProgramRunItem item : runItemRepository.findByRunIdOrderByOrderIndexAsc(run.getId())) {
            String message = String.format(
                    "Bạn đạt hạng %d của chương trình \"%s\" và được thưởng %d điểm. "
                    + "Điểm đã vào ví thưởng của bạn.",
                    item.getRank(), programName, item.getPoints());

            dispatchTo(item.getUser(), orgId, "reward_program_issued",
                    "Bạn được thưởng từ chương trình " + programName,
                    message, TYPE_POINT, run.getId(), false);
        }
    }

    /** Gửi ngay, cùng lý do với thu hồi thưởng thủ công: đây là điểm bị trừ khỏi ví. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleRunReverted(RewardEvents.RunReverted event) {
        RewardProgramRun run = findRun(event.runId());
        if (run == null) return;

        UUID orgId = run.getOrganization().getId();
        String programName = run.getProgram().getName();
        String actorName = nameOf(event.actorId(), "Quản trị viên");

        for (RewardProgramRunItem item : runItemRepository.findByRunIdOrderByOrderIndexAsc(run.getId())) {
            String message = String.format(
                    "%s đã thu hồi lần phát thưởng của chương trình \"%s\". %d điểm bạn nhận trước "
                    + "đó đã được trừ khỏi ví. Chương trình có thể được tính và phát lại cho cùng đợt này.",
                    actorName, programName, item.getPoints());

            dispatchTo(item.getUser(), orgId, "reward_program_reverted",
                    "Thưởng chương trình đã bị thu hồi", message, TYPE_POINT, run.getId(), true);
        }
    }

    // ============================================================
    // Đổi quà
    // ============================================================

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleRedemptionCreated(RewardEvents.RedemptionCreated event) {
        RewardRedemption r = findRedemption(event.redemptionId());
        // Quà điện tử xuất được ngay lúc đặt thì không còn gì để ai xử lý — báo cho bộ phận
        // quà một việc đã xong là tạo hàng đợi giả.
        if (r == null || r.getStatus() != com.kpitracking.enums.RedemptionStatus.PENDING) return;

        String message = String.format(
                "%s vừa đặt đổi %d điểm lấy \"%s\"%s. Yêu cầu đang chờ được xử lý.",
                r.getUser().getFullName(), r.getPointsSpent(), r.getGiftNameSnapshot(),
                r.getQuantity() != null && r.getQuantity() > 1 ? " (số lượng " + r.getQuantity() + ")" : "");

        notifyFulfillers(r, "reward_redemption_created", "Yêu cầu đổi quà mới", message,
                Set.of(r.getUser().getId()));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleRedemptionSettled(RewardEvents.RedemptionSettled event) {
        RewardRedemption r = findRedemption(event.redemptionId());
        if (r == null) return;

        String gift = r.getGiftNameSnapshot();
        String actor = nameOf(event.actorId(), "Bộ phận phần thưởng");
        UUID orgId = r.getOrganization().getId();

        switch (r.getStatus()) {
            case APPROVED -> dispatchTo(r.getUser(), orgId, "reward_redemption_approved",
                    "Yêu cầu đổi quà đã được duyệt",
                    String.format("Yêu cầu đổi \"%s\" của bạn đã được %s duyệt và đang chuẩn bị trao.%s",
                            gift, actor, noteSuffix(r.getNote())),
                    TYPE_GIFT, r.getId(), false);

            case REJECTED -> dispatchTo(r.getUser(), orgId, "reward_redemption_rejected",
                    "Yêu cầu đổi quà bị từ chối",
                    String.format("Yêu cầu đổi \"%s\" của bạn đã bị %s từ chối. %d điểm đã được "
                            + "hoàn lại vào ví thưởng của bạn.%s",
                            gift, actor, r.getPointsSpent(), noteSuffix(r.getNote())),
                    TYPE_GIFT, r.getId(), false);

            case DELIVERED -> dispatchTo(r.getUser(), orgId, "reward_redemption_delivered",
                    "Quà của bạn đã được trao",
                    String.format("\"%s\" đã được trao cho bạn.%s%s", gift,
                            r.getExternalOrderId() != null && !r.getExternalOrderId().isBlank()
                                    ? " Mã quà nằm trong mục Đổi quà của tôi."
                                    : "",
                            noteSuffix(r.getNote())),
                    TYPE_GIFT, r.getId(), false);

            // Xuất quà hỏng dứt khoát: điểm đã hoàn nhưng người dùng vẫn đang chờ món quà họ
            // tưởng đã đổi được. Gửi ngay, và báo cả bộ phận quà vì đây thường là dấu hiệu món
            // quà hoặc nhà cung cấp đang có vấn đề chứ không phải sự cố của riêng một người.
            case FAILED -> {
                dispatchTo(r.getUser(), orgId, "reward_redemption_failed",
                        "Không xuất được quà, điểm đã hoàn lại",
                        String.format("Rất tiếc, không xuất được \"%s\" nên yêu cầu của bạn đã dừng "
                                + "và %d điểm đã được hoàn về ví thưởng.%s",
                                gift, r.getPointsSpent(), noteSuffix(r.getFulfillmentError())),
                        TYPE_GIFT, r.getId(), true);

                notifyFulfillers(r, "reward_redemption_failed", "Xuất quà thất bại",
                        String.format("Không xuất được \"%s\" cho %s: %s. Điểm đã hoàn và tồn kho đã trả lại.",
                                gift, r.getUser().getFullName(),
                                r.getFulfillmentError() == null ? "(không rõ lý do)" : r.getFulfillmentError()),
                        Set.of(r.getUser().getId()));
            }

            // Người đổi tự huỷ thì chính họ vừa bấm — báo lại cho họ là thừa. Bộ phận quà thì
            // cần biết vì yêu cầu đó vừa biến mất khỏi hàng đợi đang mở của họ.
            case CANCELLED -> notifyFulfillers(r, "reward_redemption_cancelled",
                    "Yêu cầu đổi quà đã bị huỷ",
                    String.format("%s đã huỷ yêu cầu đổi \"%s\". %d điểm đã hoàn lại và tồn kho đã trả về.",
                            r.getUser().getFullName(), gift, r.getPointsSpent()),
                    Set.of(r.getUser().getId()));

            default -> { /* PENDING: chưa chốt gì, không có tin gì để báo. */ }
        }
    }

    // ============================================================
    // Tiện ích dùng chung
    // ============================================================

    /** Báo cho người có {@code GIFT:FULFILL} gần nhất tính từ đơn vị của người đổi quà. */
    private void notifyFulfillers(RewardRedemption r, String eventCode, String title,
                                  String message, Set<UUID> exclude) {
        OrgUnit unit = unitFor(r.getUser().getId(), r.getOrganization().getId());
        if (unit == null) return;

        Set<UUID> notified = new HashSet<>(exclude);
        for (User handler : routing.nearestWithPermission(unit, "GIFT:FULFILL", notified)) {
            if (notified.add(handler.getId())) {
                dispatcher.dispatch(r.getOrganization().getId(), eventCode, handler, unit,
                        title, message, TYPE_GIFT, r.getId());
            }
        }
    }

    /**
     * Một người nhận. {@code immediate = true} bỏ qua hàng đợi gom thư — chỉ dành cho tin làm
     * TỤT số dư, thứ người dùng sẽ tự thấy trước khi thư gộp kịp đi.
     *
     * <p>Nuốt mọi lỗi: việc nghiệp vụ đã commit từ trước, và một người nhận hỏng không được kéo
     * theo những người còn lại trong cùng vòng lặp.
     */
    private void dispatchTo(User recipient, UUID orgId, String eventCode, String title,
                            String message, String type, UUID referenceId, boolean immediate) {
        if (recipient == null) return;
        try {
            OrgUnit unit = unitFor(recipient.getId(), orgId);
            if (unit == null) {
                log.error("Không xác định được đơn vị nào cho {}, bỏ qua thông báo {}",
                        recipient.getId(), eventCode);
                return;
            }
            if (immediate) {
                dispatcher.dispatchImmediate(orgId, eventCode, recipient, unit, title, message, type, referenceId);
            } else {
                dispatcher.dispatch(orgId, eventCode, recipient, unit, title, message, type, referenceId);
            }
        } catch (Exception e) {
            log.error("Không gửi được thông báo thưởng {} cho {}", eventCode, recipient.getId(), e);
        }
    }

    /**
     * Đơn vị để gắn thông báo: đơn vị chính của người nhận, hoặc đơn vị GỐC của tổ chức nếu họ
     * chưa được gán đơn vị nào.
     *
     * <p>Phải có một đơn vị thật — {@code notifications.org_unit_id} là NOT NULL, nên trả về null
     * ở đây nghĩa là bản ghi thông báo ném lỗi ràng buộc lúc flush và người nhận im lặng không
     * nhận được gì. {@code RewardContext.getPrimaryOrgUnit} thì ném ngoại lệ khi người dùng chưa
     * gắn đơn vị, mà một nhân viên chưa gắn đơn vị vẫn nhận được thưởng bình thường.
     *
     * @return null chỉ khi tổ chức không có cả đơn vị gốc — lúc đó thật sự không còn gì để gắn
     */
    private OrgUnit unitFor(UUID userId, UUID orgId) {
        try {
            return context.getPrimaryOrgUnit(userId);
        } catch (Exception e) {
            log.warn("Người dùng {} chưa gắn đơn vị nào, gắn thông báo thưởng vào đơn vị gốc", userId);
            return orgUnitRepository.findRootsByOrganizationId(orgId).stream().findFirst().orElse(null);
        }
    }

    private RewardGrant findGrant(UUID id) {
        RewardGrant grant = grantRepository.findById(id).orElse(null);
        if (grant == null) log.warn("Không tìm thấy đề nghị thưởng {} để gửi thông báo", id);
        return grant;
    }

    private RewardProgramRun findRun(UUID id) {
        RewardProgramRun run = runRepository.findById(id).orElse(null);
        if (run == null) log.warn("Không tìm thấy lần chạy chương trình {} để gửi thông báo", id);
        return run;
    }

    private RewardRedemption findRedemption(UUID id) {
        RewardRedemption r = redemptionRepository.findById(id).orElse(null);
        if (r == null) log.warn("Không tìm thấy yêu cầu đổi quà {} để gửi thông báo", id);
        return r;
    }

    private UUID orgIdOf(RewardGrant grant) {
        return grant.getOrganization().getId();
    }

    private String nameOf(UUID userId, String fallback) {
        if (userId == null) return fallback;
        return userRepository.findById(userId).map(User::getFullName).orElse(fallback);
    }

    private static String reasonOf(RewardGrant grant) {
        return grant.getReason() == null || grant.getReason().isBlank()
                ? "(không ghi)" : grant.getReason();
    }

    /** Ghi chú của người quyết định, chỉ thêm vào câu khi thật sự có. */
    private static String noteSuffix(String note) {
        return note == null || note.isBlank() ? "" : " Ghi chú: " + note;
    }
}
