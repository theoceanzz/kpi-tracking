package com.kpitracking.config;

import com.kpitracking.advisor.TokenUsageAuditAdvisor;
import com.kpitracking.tool.OrgStatisticTool;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.SimpleLoggerAdvisor;
import org.springframework.ai.chat.client.advisor.api.Advisor;
import org.springframework.ai.google.genai.GoogleGenAiChatModel;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;

@Configuration
public class ChatModelConfig {

    @Value("classpath://promptTemplates/systemPromptTemplate.st")
    Resource systemPrompt;

    @Bean(name = "ollamaChatClient")
    public ChatClient ollamaChatClient(OllamaChatModel ollamaChatModel,
                                 OrgStatisticTool orgStatisticTool){
        ChatClient.Builder chatClientBuilder = ChatClient.builder(ollamaChatModel);
        Advisor logAdvisor = new SimpleLoggerAdvisor();
        return chatClientBuilder
//                .defaultSystem(systemPrompt)
//                .defaultTools(statisticTool)
                .defaultAdvisors(logAdvisor)
                .build();
    }

    @Bean(name = "geminiChatClient")
    public ChatClient geminiChatClient(GoogleGenAiChatModel googleGenAiChatModel,
                                 OrgStatisticTool orgStatisticTool){
        Advisor logAdvisor = new SimpleLoggerAdvisor();
        return ChatClient.builder(googleGenAiChatModel)
//                .defaultSystem(systemPrompt)
//                .defaultTools(statisticTool)
                .defaultAdvisors(logAdvisor)
                .build();
    }

    @Bean(name = "openAiChatClient")
    public ChatClient openAiChatClient(OpenAiChatModel openAiChatModel){
        Advisor logAdvisor = new SimpleLoggerAdvisor();
        Advisor tokenUsageAdvisor = new TokenUsageAuditAdvisor();
        return ChatClient.builder(openAiChatModel)
//                .defaultSystem(systemPrompt)
                .defaultAdvisors(logAdvisor, tokenUsageAdvisor)
                .build();
    }
}
