package com.kpitracking.dto.request.dashboard;

import com.kpitracking.enums.DashboardScope;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class SaveDashboardLayoutRequest {

    @NotNull(message = "Vai trò bố cục không được để trống")
    private DashboardScope scope;

    /**
     * Chuỗi JSON mảng [{i, x, y, w, h, visible}]. Giới hạn độ dài để một client lỗi
     * không nhồi được payload lớn vào cột jsonb.
     */
    @NotNull(message = "Bố cục không được để trống")
    @Size(max = 20000, message = "Bố cục vượt quá giới hạn cho phép")
    private String layout;
}
