package com.kpitracking.config;

import com.kpitracking.advisor.TokenUsageAuditAdvisor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.client.advisor.SimpleLoggerAdvisor;
import org.springframework.ai.chat.client.advisor.api.Advisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
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
    public ChatClient ollamaChatClient(OllamaChatModel ollamaChatModel){
        Advisor logAdvisor = new SimpleLoggerAdvisor();
        return ChatClient.builder(ollamaChatModel)
                .defaultAdvisors(logAdvisor)
                .build();
    }

    @Bean(name = "openAiChatClient")
    public ChatClient openAiChatClient(OpenAiChatModel openAiChatModel) {
        Advisor logAdvisor = new SimpleLoggerAdvisor();
        Advisor tokenUsageAdvisor = new TokenUsageAuditAdvisor();
        return ChatClient.builder(openAiChatModel)
                .defaultAdvisors(logAdvisor, tokenUsageAdvisor)
                .build();
    }

    @Bean
    public ChatMemory chatMemory(DatabaseChatMemoryRepository repository) {
        return MessageWindowChatMemory.builder()
                .chatMemoryRepository(repository)
                .maxMessages(5)
                .build();
    }

    @Bean(name = "chatClientWithMemory")
    public ChatClient chatClientWithMemory(OpenAiChatModel openAiChatModel, ChatMemory chatMemory) {
        Advisor logAdvisor = new SimpleLoggerAdvisor();
        Advisor tokenUsageAdvisor = new TokenUsageAuditAdvisor();
        return ChatClient.builder(openAiChatModel)
                .defaultAdvisors(
                        logAdvisor,
                        tokenUsageAdvisor,
                        MessageChatMemoryAdvisor.builder(chatMemory).build(),
                        new SimpleLoggerAdvisor()
                )
                .build();
    }
}
