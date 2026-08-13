package com.kpitracking.dto.response.reward;

import com.kpitracking.enums.GiftItemStatus;
import com.kpitracking.enums.GiftItemType;
import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class GiftItemResponse {

    private UUID id;
    private String name;
    private String description;
    private String imageUrl;
    private Integer pointCost;
    private Integer stockQuantity;
    private Boolean unlimitedStock;
    /** Cần trao tay (chờ giao) hay nhận ngay lúc đổi. */
    private Boolean requiresDelivery;
    private GiftItemType type;
    private GiftItemStatus status;
    private Integer displayOrder;

    /** Còn hàng để đổi hay không — gộp sẵn để giao diện khỏi tự suy từ hai cột. */
    private Boolean available;

    /**
     * Người đang xem có đủ điểm đổi món này không. Tính ở backend để cửa hàng không
     * phải tự đối chiếu số dư với từng món, và để thông điệp "thiếu bao nhiêu điểm"
     * luôn khớp với luật thật lúc trừ điểm.
     */
    private Boolean affordable;

    /**
     * Số yêu cầu đổi ĐANG CHỜ xử lý của món này. Chỉ có ở màn hình quản trị.
     *
     * <p>Lớn hơn 0 nghĩa là quà đang bị khoá sửa tồn kho và khoá xoá — hiện sẵn để người
     * quản lý biết trước lý do, thay vì bấm rồi mới nhận thông báo lỗi.
     */
    private Integer pendingRedemptionCount;
}
