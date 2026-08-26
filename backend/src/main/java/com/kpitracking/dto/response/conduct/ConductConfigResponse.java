package com.kpitracking.dto.response.conduct;

import lombok.*;

import java.util.List;

/**
 * Cấu hình chấm hạnh kiểm của tổ chức: bật/tắt và toàn bộ các bộ tiêu chí.
 * Bộ mặc định luôn đứng đầu danh sách.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ConductConfigResponse {
    private boolean enabled;
    private List<ConductSetResponse> sets;
}
