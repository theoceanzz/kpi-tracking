package com.kpitracking.dto.request.kpi;

import com.kpitracking.dto.request.kpi.lock.LockCycleRequest;
import jakarta.validation.Valid;
import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class FinalizeUnitRequest {

    private String comment;

    /**
     * Bắt buộc khi khoá kết quả ở ĐƠN VỊ GỐC và kỳ còn mở: token xem trước + cách xử lý từng đợt dở
     * (lấy từ GET /kpi-cycles/{id}/lock-preview). Đơn vị con thì bỏ trống.
     */
    @Valid
    private LockCycleRequest cycleLock;
}
