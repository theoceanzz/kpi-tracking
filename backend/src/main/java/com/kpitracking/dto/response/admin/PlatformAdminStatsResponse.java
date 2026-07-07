package com.kpitracking.dto.response.admin;

import lombok.*;

import java.util.Map;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PlatformAdminStatsResponse {

    private long totalOrgs;
    private Map<String, Long> orgsByStatus;

    private long totalUsers;
    private long newUsersThisMonth;

    private long totalKpiCriteria;
    private long totalSubmissionsThisMonth;

    private long orgsWithAiEnabled;
    private long totalAiConversations;
    private long totalAiMessages;
}
