package com.kpitracking.dto.request.wallet;

import com.kpitracking.enums.SepayResolveMode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

/**
 * Đóng một sự kiện SePay trong hàng đợi đối soát.
 *
 * <p><b>Cố ý KHÔNG có trường số tiền.</b> Chính sách của module là ghi có đúng số
 * tiền thực nhận, và một ô số tiền tự do sẽ phá nó ngay ở đường dễ sai nhất:
 * người xử lý gõ nhầm một chữ số thì số dư lệch khỏi tiền thật đã về mà không còn
 * gì để đối chiếu — chính con số lẽ ra dùng để đối chiếu lại là con số vừa bị gõ
 * đè.
 *
 * <p>Toàn hệ thống không có đường nào ghi một số tiền tuỳ ý vào ví: mọi bút toán
 * đều suy ra từ một sự kiện có thật (webhook SePay, hoặc lệnh quy đổi của chính
 * chủ ví).
 */
@Data
public class ResolveSepayEventRequest {

    @NotNull(message = "Vui lòng chọn cách xử lý")
    private SepayResolveMode mode;

    /** Bắt buộc với MATCH_ORDER. */
    private UUID orderId;

    /** Bắt buộc với CREDIT_USER. */
    private UUID userId;

    @NotBlank(message = "Vui lòng ghi rõ lý do xử lý")
    private String note;
}
