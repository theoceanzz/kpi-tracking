package com.kpitracking.event;

import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.SepayWebhookEvent;
import com.kpitracking.entity.TopupOrder;
import com.kpitracking.entity.TopupReceipt;
import com.kpitracking.entity.User;
import com.kpitracking.event.WalletEvents.CashConvertedEvent;
import com.kpitracking.event.WalletEvents.TopupPaidEvent;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.SepayWebhookEventRepository;
import com.kpitracking.repository.TopupOrderRepository;
import com.kpitracking.service.CashWalletService;
import com.kpitracking.service.EmailService;
import com.kpitracking.service.notification.NotificationDispatcher;
import com.kpitracking.service.notification.NotificationRoutingService;
import com.kpitracking.service.reward.RewardContext;
import com.kpitracking.service.wallet.TopupReceiptService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Thông báo của ví tiền. Tách khỏi {@link NotificationEventListener} vì lớp kia
 * đã dài và chỉ nói về KPI; gộp vào chỉ làm cả hai khó đọc hơn.
 *
 * <p>Cùng bộ ba chú thích như bên KPI: chạy SAU KHI COMMIT nên không bao giờ gửi
 * thông báo cho một giao dịch rồi bị rollback, chạy bất đồng bộ nên gửi mail chậm
 * không giữ chân request, và mở transaction MỚI vì transaction gốc đã đóng.
 *
 * <p>Ngoài chuông và thư báo tin, lớp này còn là nơi phát BIÊN NHẬN THU TIỀN cho mỗi lần nạp
 * thành công — xem {@link #handleTopupPaid}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WalletNotificationEventListener {

    private final NotificationDispatcher dispatcher;
    private final NotificationRoutingService routing;
    private final RewardContext context;
    private final TopupOrderRepository orderRepository;
    private final SepayWebhookEventRepository sepayEventRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final TopupReceiptService receiptService;
    private final EmailService emailService;

    /** Nhãn kiểu thông báo — quyết định biểu tượng ở chuông. */
    private static final String TYPE_WALLET = "WALLET";
    /** Việc của người đối soát, không phải tin về ví của chính người nhận. */
    private static final String TYPE_RECONCILE = "WALLET_RECONCILE";

    private static final DateTimeFormatter DATETIME =
            DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy").withZone(ZoneId.of("Asia/Ho_Chi_Minh"));

    /**
     * Tiền đã về và ví đã được ghi có: báo cho chủ ví, rồi lập và gửi biên nhận thu tiền.
     *
     * <p>Hai việc tách rời nhau có chủ đích. Thông báo là tin nhắn, biên nhận là CHỨNG TỪ: chứng
     * từ hỏng (thiếu cấu hình pháp nhân, lỗi lập số) không được nuốt mất lời báo tiền đã vào ví,
     * và ngược lại tổ chức tắt thông báo nạp tiền cũng không đồng nghĩa với việc từ chối cấp
     * chứng từ cho người đã chuyển tiền thật.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleTopupPaid(TopupPaidEvent event) {
        TopupOrder order = event.getOrder();
        User user = order.getUser();
        UUID orgId = order.getOrganization().getId();

        String title = "Nạp tiền thành công";
        StringBuilder message = new StringBuilder()
                .append("Ví tiền của bạn đã được cộng ")
                .append(CashWalletService.formatVnd(event.getPaidAmount()))
                .append(" từ đơn nạp ").append(order.getCode()).append(".");

        // Nói thẳng khi số tiền lệch: người dùng nhìn số dư không khớp với số mình
        // định chuyển mà không được giải thích sẽ nghĩ hệ thống tính sai.
        if (event.getPaidAmount() != order.getAmount()) {
            message.append(" Lưu ý: số tiền thực nhận khác với số đề nghị ban đầu (")
                    .append(CashWalletService.formatVnd(order.getAmount()))
                    .append("), và ví đã được cộng đúng số thực nhận.");
        }

        send(orgId, "wallet_topup_paid", user, title, message.toString(), order.getId());
        sendReceipt(orgId, order, user);
    }

    /**
     * Lập biên nhận rồi gửi cho người nộp tiền.
     *
     * <p>Gửi NGAY và KHÔNG đi qua công tắc thông báo của tổ chức: đây là chứng từ xác nhận đã nhận
     * tiền của một người, không phải một tin tức tuỳ chọn. Công tắc duy nhất chi phối nó là
     * {@code receiptEnabled} ở cấu hình ví — dành cho tổ chức đã phát hành hoá đơn qua nhà cung
     * cấp riêng và không muốn gửi hai loại giấy cho cùng một khoản.
     */
    private void sendReceipt(UUID orgId, TopupOrder order, User user) {
        try {
            TopupReceipt receipt = receiptService.issueFor(order.getId());
            if (receipt == null) return;

            Map<String, String> vars = new LinkedHashMap<>();
            vars.put("ten_nguoi_nhan", user.getFullName());
            vars.put("email", user.getEmail());
            vars.put("so_bien_nhan", receipt.getDisplayNumber());
            vars.put("so_tien", CashWalletService.formatVnd(receipt.getTotalAmount()));
            vars.put("ma_don", order.getCode());
            vars.put("bien_nhan", receiptService.renderHtml(receipt));

            emailService.sendTemplated(orgId, "wallet_topup_receipt", user.getEmail(), vars);
        } catch (Exception e) {
            // Tiền đã vào ví và bút toán đã commit từ trước. Không lập được chứng từ là việc phải
            // sửa bằng cấu hình rồi phát lại, không phải lý do để làm hỏng luồng báo tin.
            log.error("Không lập/gửi được biên nhận cho đơn nạp {}", order.getCode(), e);
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleCashConverted(CashConvertedEvent event) {
        User user = event.getUser();
        UUID orgId = context.getOrgIdOf(user.getId());

        String message = String.format(
                "Bạn đã đổi %s từ ví tiền lấy %d điểm thưởng (tỉ giá %s/điểm).",
                CashWalletService.formatVnd(event.getCost()),
                event.getPoints(),
                CashWalletService.formatVnd(event.getRate()));

        send(orgId, "wallet_converted", user, "Đã quy đổi sang điểm thưởng", message, null);
    }

    /**
     * Đơn nạp hết hạn mà chưa nhận được tiền.
     *
     * <p>Không có tiền nào chuyển động nên đây là tin duy nhất trong lớp này đi qua hàng đợi gom
     * thư thay vì gửi ngay: người dùng không ngồi chờ nó, và một đợt hết hạn có thể quét qua nhiều
     * đơn cùng lúc. Điều cần nói rõ là mã QR cũ không còn được trông đợi nữa — quét lại mã đó thì
     * tiền rơi vào hàng đợi đối soát chứ không tự vào ví.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleTopupExpired(WalletEvents.TopupExpired event) {
        TopupOrder order = orderRepository.findById(event.orderId()).orElse(null);
        if (order == null) return;

        String message = String.format(
                "Đơn nạp %s (%s) đã hết hạn vì chưa nhận được tiền. Mã QR của đơn này không còn "
                + "hiệu lực — nếu vẫn muốn nạp, hãy tạo đơn mới để lấy mã mới. Trường hợp bạn đã "
                + "chuyển khoản theo mã cũ, tiền không mất: hãy báo bộ phận hỗ trợ để được ghi có.",
                order.getCode(), CashWalletService.formatVnd(order.getAmount()));

        deliver(order.getOrganization().getId(), "wallet_topup_expired", order.getUser(),
                "Đơn nạp tiền đã hết hạn", message, TYPE_WALLET, order.getId(), false);
    }

    /**
     * Có tiền về mà hệ thống không tự ghi có được: báo cho người có {@code WALLET:RECONCILE}.
     *
     * <p>Gửi NGAY. Đây là tiền thật đang nằm trong tài khoản công ty mà chưa vào ví của ai, và
     * người đã chuyển khoản thì đang nhìn màn hình chờ. Không báo thì việc này chỉ hiện thành một
     * dòng trong hàng đợi đối soát mà không ai được nhắc là phải mở ra xem.
     *
     * <p>Định tuyến từ ĐƠN VỊ GỐC của tổ chức: giao dịch chưa khớp đơn thì không thuộc về đơn vị
     * nào cả, và quyền đối soát vốn nằm ở cấp trên cùng.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleSepayUnmatched(WalletEvents.SepayUnmatched event) {
        SepayWebhookEvent e = sepayEventRepository.findById(event.eventId()).orElse(null);
        if (e == null || e.getOrganization() == null) return;

        UUID orgId = e.getOrganization().getId();
        List<OrgUnit> roots = orgUnitRepository.findRootsByOrganizationId(orgId);
        if (roots.isEmpty()) {
            log.warn("Tổ chức {} không có đơn vị gốc, không định tuyến được cảnh báo đối soát", orgId);
            return;
        }

        String message = String.format(
                "Nhận được %s về tài khoản %s lúc %s nhưng chưa ghi có tự động được. Lý do: %s "
                + "Nội dung chuyển khoản: \"%s\". Vào Đối soát ví tiền để gán đơn hoặc ghi có "
                + "trực tiếp cho người chuyển.",
                CashWalletService.formatVnd(e.getTransferAmount() == null ? 0L : e.getTransferAmount()),
                nullTo(e.getAccountNumber(), "(không rõ)"),
                e.getTransactionDate() == null ? "(không rõ thời điểm)" : DATETIME.format(e.getTransactionDate()),
                nullTo(e.getErrorMessage(), "(không rõ)"),
                nullTo(e.getContent(), ""));

        Set<UUID> notified = new HashSet<>();
        for (OrgUnit root : roots) {
            for (User handler : routing.nearestWithPermission(root, "WALLET:RECONCILE", notified)) {
                if (notified.add(handler.getId())) {
                    deliver(orgId, "wallet_topup_unmatched", handler, "Có tiền về chưa ghi có được",
                            message, TYPE_RECONCILE, e.getId(), true);
                }
            }
        }
    }

    /**
     * Gửi NGAY, không xếp vào hàng đợi gom email như bên KPI.
     *
     * <p>Người vừa chuyển khoản đang ngồi nhìn màn hình chờ xác nhận tiền đã về; giữ lá thư
     * lại vài phút để gộp với thông báo khác thì họ đọc thành "giao dịch chưa chạy" và đi
     * chuyển thêm lần nữa. Thông báo tiền bạc cũng thưa, không phải nguồn gây ngập hộp thư.
     */
    private void send(UUID orgId, String eventCode, User recipient,
                      String title, String message, UUID referenceId) {
        deliver(orgId, eventCode, recipient, title, message, TYPE_WALLET, referenceId, true);
    }

    private void deliver(UUID orgId, String eventCode, User recipient, String title,
                         String message, String type, UUID referenceId, boolean immediate) {
        if (recipient == null) return;
        try {
            OrgUnit orgUnit = context.getPrimaryOrgUnit(recipient.getId());
            if (immediate) {
                dispatcher.dispatchImmediate(orgId, eventCode, recipient, orgUnit,
                        title, message, type, referenceId);
            } else {
                dispatcher.dispatch(orgId, eventCode, recipient, orgUnit,
                        title, message, type, referenceId);
            }
        } catch (Exception e) {
            // Thông báo hỏng không được kéo theo gì cả: tiền đã ghi xong và commit
            // từ trước, đây chỉ là lớp báo tin.
            log.error("Không gửi được thông báo ví tiền {} cho {}", eventCode, recipient.getId(), e);
        }
    }

    private static String nullTo(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
