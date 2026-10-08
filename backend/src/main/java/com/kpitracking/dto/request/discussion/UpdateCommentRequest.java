package com.kpitracking.dto.request.discussion;

import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.UUID;

@Getter @Setter
public class UpdateCommentRequest {

    private String body;
    private List<UUID> mentionIds;
}
