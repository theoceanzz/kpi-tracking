package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

/**
 * Trạng thái riêng của MỘT người với MỘT tài liệu: yêu thích, ghim lên thanh bên, lần mở gần nhất (tab "Gần đây").
 * Không phải quyền — mọi danh sách vẫn lọc qua quyền xem trước, nên mất quyền thì dòng này tự vô nghĩa.
 */
@Entity
@Table(name = "document_user_states")
@IdClass(DocumentUserState.Key.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DocumentUserState {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Id
    @Column(name = "document_id")
    private UUID documentId;

    @Column(name = "favorite", nullable = false)
    @Builder.Default
    private Boolean favorite = false;

    @Column(name = "pinned", nullable = false)
    @Builder.Default
    private Boolean pinned = false;

    @Column(name = "last_opened_at")
    private Instant lastOpenedAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Key implements Serializable {
        private UUID userId;
        private UUID documentId;
    }
}
