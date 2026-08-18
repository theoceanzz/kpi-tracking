package com.kpitracking.dto.response.reward;

import com.kpitracking.enums.RedemptionStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class RedemptionResponse {

    private UUID id;

    private UUID userId;
    private String userFullName;
    private String userEmail;
    private String userEmployeeCode;

    private UUID giftItemId;
    /** Tên quà CHỤP LẠI lúc đổi — quà đổi tên sau này không làm sai lịch sử. */
    private String giftNameSnapshot;
    private String giftImageUrl;

    private Integer quantity;
    private Integer pointsSpent;
    private RedemptionStatus status;

    private UUID handledByUserId;
    private String handledByName;
    private Instant handledAt;
    private Instant deliveredAt;

    private String note;
    private Instant createdAt;

    // ── Quà từ nhà cung cấp ngoài (UrBox) ────────────────────────────

    /** {@code "URBOX"} nếu quà do nhà cung cấp ngoài xuất; null với quà nội bộ. */
    private String externalProvider;

    /** Mã đơn bên nhà cung cấp — cho người vận hành đối soát, không phải mã dùng quà. */
    private String externalOrderId;

    /**
     * Mã voucher đã xuất. CHỈ có ở phản hồi cho chính người đã đổi; danh sách của màn
     * hình quản trị luôn để trống — ai cầm mã là người tiêu được nó.
     */
    private List<RedemptionVoucherResponse> vouchers;

    /**
     * Vì sao chưa lấy được quà. Hiện cho cả người đổi lẫn người xử lý: yêu cầu treo mà
     * không nói lý do sẽ biến thành một cuộc gọi cho bộ phận hỗ trợ.
     */
    private String fulfillmentError;

    /** Điều kiện sử dụng (HTML) chụp lại lúc nhập quà — UrBox bắt buộc hiển thị. */
    private String giftTerms;
}
