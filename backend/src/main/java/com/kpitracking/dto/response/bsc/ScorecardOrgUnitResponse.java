package com.kpitracking.dto.response.bsc;

import lombok.*;

import java.util.UUID;

/** Phòng ban gắn với bộ tiêu chí (id + tên) — 1 bộ tiêu chí áp dụng cho nhiều phòng ban. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ScorecardOrgUnitResponse {
    private UUID id;
    private String name;
}
