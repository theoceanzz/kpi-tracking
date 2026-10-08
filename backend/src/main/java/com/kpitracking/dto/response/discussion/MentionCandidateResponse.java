package com.kpitracking.dto.response.discussion;

import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class MentionCandidateResponse {

    private UUID id;
    private String fullName;
    private String email;
    private String avatarUrl;
    private String title;
    private String unitName;
}
