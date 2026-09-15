package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "messages",
    // Tên khớp V1__init_schema.sql; không đặt tên thì Hibernate ddl-auto sinh thêm một unique
    // constraint tên hash (uk6rsee...) trùng nội dung — phát hiện ở docs/DATABASE_SCALING.md M2.
    uniqueConstraints = @UniqueConstraint(name = "messages_conversation_id_msg_index_key",
                                          columnNames = {"conversation_id", "msg_index"}))
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ConversationMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "conversation_id", nullable = false)
    private UUID conversationId;

    @Column(name = "role", nullable = false, length = 20)
    private String role;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "msg_index", nullable = false)
    private int msgIndex;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
