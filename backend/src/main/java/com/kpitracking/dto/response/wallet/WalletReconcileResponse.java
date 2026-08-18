package com.kpitracking.dto.response.wallet;

import lombok.*;

import java.util.List;
import java.util.UUID;

/**
 * Kết quả đối soát ví tiền. <b>Cả ba trường phải sạch</b> (danh sách rỗng và hai
 * số bằng 0) thì mới gọi là sổ đúng — một cái lệch là có tiền chưa được ghi nhận
 * đúng chỗ hoặc có sự kiện chưa ai xử lý.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class WalletReconcileResponse {

    /** Ví có số dư lệch so với tổng sổ cái. Phải luôn rỗng. */
    private List<UUID> inconsistentWalletIds;

    /** Sự kiện SePay chưa khớp đơn và chưa ai xử lý. */
    private Long unresolvedEventCount;

    /** Sự kiện đã ghi có nhưng lệch số tiền, chưa ai xác nhận. */
    private Long amountMismatchCount;

    /** Sạch hay không, để giao diện khỏi phải tự suy. */
    private Boolean clean;
}
