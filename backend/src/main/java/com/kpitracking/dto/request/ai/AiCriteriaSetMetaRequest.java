package com.kpitracking.dto.request.ai;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Tên + đơn vị áp dụng của một bộ tiêu chí — dùng cho "Sửa thông tin", "Nhân bản", "Áp dụng lại" và "Gửi đề
 * nghị". {@code orgUnitId} trống = cả tổ chức; {@code title} trống = giữ tên cũ (sửa) / tên tự đặt theo đơn vị
 * (nhân bản).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiCriteriaSetMetaRequest {

    @Size(max = 255)
    private String title;

    private UUID orgUnitId;

    /** Nhân bản sang đơn vị đang áp tài liệu của cấp trên: tạo bản nháp rồi gửi đề nghị luôn. */
    private Boolean sendRequest;

    /** Ghi chú kèm đề nghị (tuỳ chọn) / lý do khi quyết đề nghị. */
    @Size(max = 1000)
    private String note;
}
