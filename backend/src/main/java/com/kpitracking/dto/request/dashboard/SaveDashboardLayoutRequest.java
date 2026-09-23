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
     * Chuỗi JSON mảng [{i, x, y, w, h, visible, s}]. Giới hạn độ dài để một client lỗi
     * không nhồi được payload lớn vào cột jsonb.
     *
     * <p>Nới trần vì mỗi widget nay mang thêm cấu hình riêng (bộ lọc, cách biểu diễn): 40 widget
     * kèm cấu hình đầy đủ vào khoảng 7KB, vẫn dưới trần cũ, nhưng cột là jsonb không giới hạn nên
     * không có lý do gì để trần chặt tới mức một người dùng nhiệt tình có thể chạm phải.
     */
    @NotNull(message = "Bố cục không được để trống")
    @Size(max = 100000, message = "Bố cục vượt quá giới hạn cho phép")
    private String layout;
}
