package com.kpitracking.dto.response.approvalprocess;

import com.kpitracking.enums.approvalprocess.ApprovalObjectType;
import com.kpitracking.service.approvalprocess.ProcessGraph;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Một quy trình duyệt. Dùng cho cả danh sách ({@code definition} = null) và màn sửa.
 * {@code refUsers}: tên những người được nhắc tới trong sơ đồ (người duyệt cụ thể, điều kiện
 * "người gửi") để giao diện hiện chip mà không phải tải cả danh sách nhân sự.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ApprovalProcessResponse {
    private UUID id;
    private String title;
    private ApprovalObjectType objectType;
    private List<String> subObjectTypes;
    private String approvalType;
    private boolean showInObject;
    private boolean active;
    private ProcessGraph definition;
    private long stepCount;
    private Person createdBy;
    private List<Person> followers;
    private Map<UUID, Person> refUsers;
    private long version;
    private Instant createdAt;
    private Instant updatedAt;
    private boolean canManage;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Person {
        private UUID id;
        private String name;
        private String avatarUrl;
    }
}
