package com.kpitracking.config;

import com.kpitracking.advisor.TokenUsageAuditAdvisor;
import com.kpitracking.service.AiTokenUsageRecorder;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.SimpleLoggerAdvisor;
import org.springframework.ai.chat.client.advisor.api.Advisor;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ChatModelConfig {

    @Bean(name = "openAiChatClient")
    public ChatClient openAiChatClient(OpenAiChatModel openAiChatModel,
                                       AiTokenUsageRecorder tokenUsageRecorder) {
        Advisor logAdvisor = new SimpleLoggerAdvisor();
        Advisor tokenUsageAdvisor = new TokenUsageAuditAdvisor(tokenUsageRecorder);
        return ChatClient.builder(openAiChatModel)
                .defaultAdvisors(logAdvisor, tokenUsageAdvisor)
                .build();
    }

}
