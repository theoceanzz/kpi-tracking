package com.kpitracking.dto.response.bsc;

import lombok.*;

import java.util.UUID;

/** Phòng ban gắn với thẻ điểm (id + tên) — 1 thẻ điểm áp dụng cho nhiều phòng ban. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ScorecardOrgUnitResponse {
    private UUID id;
    private String name;
}
