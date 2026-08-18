package com.kpitracking.dto.response.wallet;

import lombok.*;

/**
 * Tổng hợp ví tiền toàn tổ chức.
 *
 * <p>{@link #totalBalance} là con số đáng chú ý nhất: tiền nhân viên đã nạp nhưng
 * chưa đổi thành điểm, tức khoản công ty đã thu mà chưa giao lại gì. Không có
 * màn hình nào khác tính ra được nó — sổ đối soát chỉ thấy luồng tiền vào, không
 * biết đã đổi ra điểm bao nhiêu.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CashWalletSummaryResponse {

    private Long walletCount;

    /** Tổng số dư đang giữ, chưa quy đổi. */
    private Long totalBalance;

    private Long totalTopup;
    private Long totalConverted;

    /** Số ví có số dư lệch so với sổ cái. Phải luôn bằng 0. */
    private Long inconsistentCount;
}
