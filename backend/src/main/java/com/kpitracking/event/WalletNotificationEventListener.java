package com.kpitracking.event;

import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.TopupOrder;
import com.kpitracking.entity.User;
import com.kpitracking.event.WalletEvents.CashConvertedEvent;
import com.kpitracking.event.WalletEvents.TopupPaidEvent;
import com.kpitracking.service.CashWalletService;
import com.kpitracking.service.notification.NotificationDispatcher;
import com.kpitracking.service.reward.RewardContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.UUID;

/**
 * Thông báo của ví tiền. Tách khỏi {@link NotificationEventListener} vì lớp kia
 * đã dài và chỉ nói về KPI; gộp vào chỉ làm cả hai khó đọc hơn.
 *
 * <p>Cùng bộ ba chú thích như bên KPI: chạy SAU KHI COMMIT nên không bao giờ gửi
 * thông báo cho một giao dịch rồi bị rollback, chạy bất đồng bộ nên gửi mail chậm
 * không giữ chân request, và mở transaction MỚI vì transaction gốc đã đóng.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WalletNotificationEventListener {

    private final NotificationDispatcher dispatcher;
    private final RewardContext context;

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
     * Gửi NGAY, không xếp vào hàng đợi gom email như bên KPI.
     *
     * <p>Người vừa chuyển khoản đang ngồi nhìn màn hình chờ xác nhận tiền đã về; giữ lá thư
     * lại vài phút để gộp với thông báo khác thì họ đọc thành "giao dịch chưa chạy" và đi
     * chuyển thêm lần nữa. Thông báo tiền bạc cũng thưa, không phải nguồn gây ngập hộp thư.
     */
    private void send(UUID orgId, String eventCode, User recipient,
                      String title, String message, UUID referenceId) {
        try {
            OrgUnit orgUnit = context.getPrimaryOrgUnit(recipient.getId());
            dispatcher.dispatchImmediate(orgId, eventCode, recipient, orgUnit,
                    title, message, eventCode, referenceId);
        } catch (Exception e) {
            // Thông báo hỏng không được kéo theo gì cả: tiền đã ghi xong và commit
            // từ trước, đây chỉ là lớp báo tin.
            log.error("Không gửi được thông báo ví tiền {} cho {}", eventCode, recipient.getId(), e);
        }
    }
}
