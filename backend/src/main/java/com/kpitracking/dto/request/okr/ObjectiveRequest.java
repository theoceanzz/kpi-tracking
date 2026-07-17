package com.kpitracking.dto.request.okr;

import com.kpitracking.enums.OkrStatus;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ObjectiveRequest {
    @NotBlank
    private String code;
    private String name;
    private String description;
    private LocalDate startDate;
    private LocalDate endDate;
    private OkrStatus status;
    private List<UUID> orgUnitIds;
    private UUID perspectiveId;
}
