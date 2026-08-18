package com.kpitracking.service.reward.urbox;

import com.kpitracking.exception.BusinessException;
import lombok.Getter;

import java.util.Set;

/**
 * UrBox trả lời nhưng TỪ CHỐI yêu cầu, kèm mã lỗi nghiệp vụ của họ.
 *
 * <p>Kế thừa {@link BusinessException} để những chỗ chỉ cần hiển thị thông điệp (màn hình
 * duyệt kho quà) không phải biết gì thêm. Riêng luồng đổi quà cần đọc {@link #getCode()}:
 * "hết hàng" và "sai cấu hình" đều là từ chối, nhưng dẫn tới hai xử lý khác nhau.
 */
@Getter
public class UrboxRejectedException extends BusinessException {

    /**
     * Những mã cho biết vấn đề nằm ở CHÍNH MÓN QUÀ đó, không phải ở đơn hàng hay hệ
     * thống: hết code, hết hạn, không còn trong chương trình. Quà dính một trong các mã
     * này thì mọi lượt đổi tiếp theo cũng hỏng y hệt, nên phải rút khỏi cửa hàng.
     *
     * <p>CỐ Ý không có 220 ("kho quà đang hết, quay lại sau") — đó là sự cố toàn kho phía
     * UrBox, tạm thời, ẩn món quà vì nó là ẩn oan. Cũng không có 407 ("số lượng sản phẩm
     * không đủ"): có thể chỉ thiếu cho lần đổi nhiều phần, còn đổi một phần vẫn được.
     */
    private static final Set<Integer> GIFT_UNAVAILABLE_CODES = Set.of(221, 222, 223, 224, 225, 226);

    /** Mã trạng thái nghiệp vụ của UrBox. Xem bảng mã lỗi trong tài liệu tích hợp. */
    private final int code;

    public UrboxRejectedException(int code, String message) {
        super(message);
        this.code = code;
    }

    /** Món quà này hỏng vĩnh viễn chứ không phải đơn hàng gặp trục trặc nhất thời. */
    public boolean giftUnavailable() {
        return GIFT_UNAVAILABLE_CODES.contains(code);
    }
}
