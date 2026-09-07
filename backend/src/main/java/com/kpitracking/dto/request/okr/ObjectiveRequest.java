package com.kpitracking.dto.request.okr;

import com.kpitracking.enums.OkrStatus;
import lombok.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ObjectiveRequest {
    /** Bỏ trống nếu tổ chức bật sinh mã tự động — backend cấp mã theo mẫu của tổ chức. */
    private String code;
    private String name;
    private String description;
    private LocalDate startDate;
    private LocalDate endDate;
    private OkrStatus status;
    private List<UUID> orgUnitIds;
    private UUID perspectiveId;
}
