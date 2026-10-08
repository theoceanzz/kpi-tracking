package com.kpitracking.dto.request.approvalprocess;

import com.kpitracking.enums.ApprovalObjectType;
import com.kpitracking.service.approvalprocess.ProcessGraph;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.List;
import java.util.UUID;

/** Tạo / sửa quy trình duyệt. {@code version} bắt buộc khi sửa: lệch với bản trong DB thì 409. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ApprovalProcessRequest {

    @NotBlank(message = "Title is required")
    @Size(max = 255)
    private String title;

    @NotNull(message = "Object is required")
    private ApprovalObjectType objectType;

    /** Rỗng = tất cả đối tượng con. */
    private List<String> subObjectTypes;

    private List<UUID> followerIds;

    private boolean showInObject;

    /** Null khi tạo = đang áp dụng. */
    private Boolean active;

    @NotNull(message = "Diagram is required")
    private ProcessGraph definition;

    private Long version;
}
