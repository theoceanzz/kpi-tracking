package com.kpitracking.event;

import com.kpitracking.entity.TopupOrder;
import com.kpitracking.entity.User;
import java.util.UUID;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * Sự kiện của ví tiền.
 *
 * <p>Hai lớp cũ ({@link TopupPaidEvent}, {@link CashConvertedEvent}) mang thẳng entity theo khuôn
 * {@link KpiEvents}. Các sự kiện MỚI dùng record chỉ mang ID theo khuôn {@link BscEvents} —
 * listener chạy {@code @Async} với transaction mới nên entity truyền qua đã rời session; hai cái
 * cũ sống được là vì bên nhận chỉ chạm tới quan hệ đã nạp sẵn. Không sửa lại hai cái cũ vì việc
 * đó động vào đường tiền đang chạy mà không đổi được hành vi nào.
 */
public final class WalletEvents {

    private WalletEvents() {}

    /** Đơn nạp đã nhận được tiền và ví đã được ghi có. */
    @Getter
    public static class TopupPaidEvent extends ApplicationEvent {
        private final TopupOrder order;
        /** Số tiền THỰC NHẬN, có thể lệch so với {@code order.amount}. */
        private final long paidAmount;

        public TopupPaidEvent(Object source, TopupOrder order, long paidAmount) {
            super(source);
            this.order = order;
            this.paidAmount = paidAmount;
        }
    }

    /** Người dùng đã đổi tiền trong ví sang điểm thưởng. */
    @Getter
    public static class CashConvertedEvent extends ApplicationEvent {
        private final User user;
        private final long cost;
        private final int points;
        private final long rate;

        public CashConvertedEvent(Object source, User user, long cost, int points, long rate) {
            super(source);
            this.user = user;
            this.cost = cost;
            this.points = points;
            this.rate = rate;
        }
    }

    /**
     * Đơn nạp hết hạn mà không nhận được tiền.
     *
     * <p>Đáng báo dù chẳng có tiền nào chuyển động: người dùng để mở màn hình chờ chuyển khoản
     * rồi đi làm việc khác, và mã QR trên màn hình đó đã không còn được trông đợi nữa. Không báo
     * thì họ quét mã cũ và tiền rơi vào hàng đợi đối soát.
     */
    public record TopupExpired(UUID orderId) {}

    /**
     * Có tiền về mà hệ thống KHÔNG tự ghi có được — sai mã, sai tài khoản, đơn đã thanh toán.
     *
     * <p>Đây là sự kiện quan trọng nhất của cả phần ví: tiền thật đã nằm trong tài khoản công ty
     * nhưng chưa vào ví của ai. Nó chỉ hiện trong một hàng đợi mà không ai được nhắc là mở ra xem,
     * nên người có {@code WALLET:RECONCILE} phải được báo ngay.
     */
    public record SepayUnmatched(UUID eventId) {}
}
