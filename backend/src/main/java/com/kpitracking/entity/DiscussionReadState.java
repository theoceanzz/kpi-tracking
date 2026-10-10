package com.kpitracking.entity;

import com.kpitracking.enums.DiscussionTargetType;
import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

/** Mốc "đã đọc tới" của một người trên khung thảo luận của một đối tượng. */
@Entity
@Table(name = "discussion_read_states")
@IdClass(DiscussionReadState.Key.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DiscussionReadState {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Id
    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", length = 20)
    private DiscussionTargetType targetType;

    @Id
    @Column(name = "target_id")
    private UUID targetId;

    @Column(name = "last_read_at", nullable = false)
    private Instant lastReadAt;

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class Key implements Serializable {
        private UUID userId;
        private DiscussionTargetType targetType;
        private UUID targetId;
    }
}
