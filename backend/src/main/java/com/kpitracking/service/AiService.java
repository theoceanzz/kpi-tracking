package com.kpitracking.service;

import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.tool.OrgStatisticTool;
import com.kpitracking.tool.OrgUnitStatisticTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
public class AiService {

    private final ChatClient chatClient;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final OrgStatisticTool orgStatisticTool;
    private final OrgUnitStatisticTool orgUnitStatisticTool;

    @Value("classpath:/promptTemplates/orgToolSystemPromptTemplate.st")
    Resource orgSystemPrompt;

    @Value("classpath:/promptTemplates/orgUnitToolSystemPromptTemplate.st")
    Resource orgUnitSystemPrompt;

    public AiService(@Qualifier("openAiChatClient") ChatClient chatClient,
                     UserRepository userRepository,
                     UserRoleOrgUnitRepository userRoleOrgUnitRepository,
                     OrgStatisticTool orgStatisticTool,
                     OrgUnitStatisticTool orgUnitStatisticTool) {
        this.chatClient = chatClient;
        this.userRepository = userRepository;
        this.userRoleOrgUnitRepository = userRoleOrgUnitRepository;
        this.orgStatisticTool = orgStatisticTool;
        this.orgUnitStatisticTool = orgUnitStatisticTool;
    }

    public String processOrgChat(String question) {
        UUID orgId = getCurrentUserOrgId();
        if(orgId == null) return  null;
        log.info("Processing chat for orgId: {}", orgId);

        return chatClient.prompt()
                .user(question)
                .system(orgSystemPrompt)
                .tools(orgStatisticTool)
                .toolContext(Map.of("organizationId", orgId))
                .call()
                .content();
    }

    public String processOrgUnitChat(String question) {
        UUID orgUnitId = getCurrentUserOrgUnitId();
        if(orgUnitId == null) return  null;
        log.info("Processing chat for orgUnitId: {}", orgUnitId);

        return chatClient.prompt()
                .user(question)
                .system(orgUnitSystemPrompt)
                .tools(orgUnitStatisticTool)
                .toolContext(Map.of("orgUnitId", orgUnitId))
                .call()
                .content();
    }

    private UUID getCurrentUserOrgUnitId() {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            User user = userRepository.findByEmail(email).orElse(null);
            if (user == null) return null;

            List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(user.getId());
            if (assignments.isEmpty()) return null;

            // Get the first assigned org unit ID
            return assignments.get(0).getOrgUnit().getId();
        } catch (Exception e) {
            log.error("Error getting current user org unit ID", e);
            return null;
        }
    }

    private UUID getCurrentUserOrgId() {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            User user = userRepository.findByEmail(email).orElse(null);
            if (user == null) return null;

            List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(user.getId());
            if (assignments.isEmpty()) return null;

            // Get organization ID from the first assignment
            return assignments.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
        } catch (Exception e) {
            log.error("Error getting current user org ID", e);
            return null;
        }
    }
}
