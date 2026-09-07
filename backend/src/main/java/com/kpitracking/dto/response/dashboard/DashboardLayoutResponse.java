package com.kpitracking.dto.response.dashboard;

import com.kpitracking.enums.DashboardScope;
import lombok.*;

import java.time.Instant;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DashboardLayoutResponse {

    private DashboardScope scope;

    /** null khi người dùng chưa từng tuỳ chỉnh — frontend rơi về preset mặc định. */
    private String layout;

    private Instant updatedAt;
}
