package com.kpitracking.entity;

import com.kpitracking.enums.DiscussionReactionType;
import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

/** Một cảm xúc của một người trên một bình luận. Mỗi người thả được nhiều loại, mỗi loại một lần. */
@Entity
@Table(name = "discussion_reactions")
@IdClass(DiscussionReaction.Key.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DiscussionReaction {

    @Id
    @Column(name = "comment_id")
    private UUID commentId;

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Id
    @Enumerated(EnumType.STRING)
    @Column(name = "reaction", length = 20)
    private DiscussionReactionType reaction;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class Key implements Serializable {
        private UUID commentId;
        private UUID userId;
        private DiscussionReactionType reaction;
    }
}
