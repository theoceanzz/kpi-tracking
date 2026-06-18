package com.kpitracking.dto.response.ai;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.util.List;

/**
 * Two pools of suggested follow-up questions. The frontend samples 3 of the 10 to show
 * as quick-reply buttons, and re-samples within a pool when the user toggles it.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class FollowupResponse {
    private List<String> technical;   // 5 questions: nguyên nhân / trace / sprint / so sánh dọc
    private List<String> management;  // 5 questions: trách nhiệm / quyết định / so sánh ngang
}
