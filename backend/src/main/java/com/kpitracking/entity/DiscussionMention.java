package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.util.UUID;

/** Người được @tag trong một bình luận. */
@Entity
@Table(name = "discussion_mentions")
@IdClass(DiscussionMention.Key.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DiscussionMention {

    @Id
    @Column(name = "comment_id")
    private UUID commentId;

    @Id
    @Column(name = "mentioned_user_id")
    private UUID mentionedUserId;

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class Key implements Serializable {
        private UUID commentId;
        private UUID mentionedUserId;
    }
}
