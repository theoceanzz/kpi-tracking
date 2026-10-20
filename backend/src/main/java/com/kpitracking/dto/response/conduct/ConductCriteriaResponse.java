package com.kpitracking.dto.response.conduct;

import lombok.*;

import java.util.Map;
import java.util.UUID;

/** Một tiêu chí hạnh kiểm trong cấu hình của tổ chức. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ConductCriteriaResponse {
    private UUID id;
    private String name;
    private String description;
    /** Định nghĩa từng mức điểm, khoá "1".."thang" (V48); null = không định nghĩa theo mức. */
    private Map<String, String> levelDescriptions;
    /** Trọng số %, tổng cả bộ = 100. */
    private Double weight;
    private Integer position;
    /** Nhóm chứa tiêu chí; null = bộ không chia nhóm (khi đó weight là % trên tổng). */
    private UUID groupId;
}
