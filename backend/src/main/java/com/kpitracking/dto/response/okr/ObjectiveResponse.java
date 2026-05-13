package com.kpitracking.dto.response.okr;

import com.kpitracking.enums.OkrStatus;
import lombok.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ObjectiveResponse {
    private UUID id;
    private String code;
    private String name;
    private String description;
    private LocalDate startDate;
    private LocalDate endDate;
    private OkrStatus status;
    private List<KeyResultResponse> keyResults;
    private UUID orgUnitId;
    private String orgUnitName;
}
