package com.kpitracking.entity.task;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.io.Serializable;
import java.util.UUID;

/**
 * Nguồn tạo một việc (cột {@code kpi_tasks.source_ref}, JSONB): bình luận, tài liệu hay K.AI. {@code label} là đoạn trích
 * ngắn lúc tạo. Giao diện chỉ hiện liên kết khi người xem mở được nguồn.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@EqualsAndHashCode // Hibernate so cột JSON bằng equals — thiếu thì mỗi lần flush đều tưởng đã đổi và tăng version.
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class TaskSourceRef implements Serializable {

    public enum Type { COMMENT, DOCUMENT, AI }

    private Type type;
    private UUID id;
    private String label;
}
