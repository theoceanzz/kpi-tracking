package com.kpitracking.event;

import com.kpitracking.entity.TopupOrder;
import com.kpitracking.entity.User;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/** Sự kiện của ví tiền, theo đúng khuôn {@link KpiEvents}. */
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
}
