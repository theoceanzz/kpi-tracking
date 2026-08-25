package com.kpitracking.config;

import com.kpitracking.advisor.TokenUsageAuditAdvisor;
import com.kpitracking.service.AiTokenUsageRecorder;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.SimpleLoggerAdvisor;
import org.springframework.ai.chat.client.advisor.api.Advisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
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

    /**
     * Bộ nhớ hội thoại, dùng TƯỜNG MINH chứ không qua advisor.
     *
     * <p>Bean {@code chatClientWithMemory} từng gắn {@code MessageChatMemoryAdvisor} vào đây đã bỏ:
     * từ khi ứng dụng tự sở hữu vòng lặp agent, {@code TurnPromptBuilder} đọc bộ nhớ và
     * {@code FinishNode} ghi vào — và ghi CHỈ KHI đã có câu trả lời. Advisor thì ghi câu hỏi TRƯỚC
     * khi gọi model, chính là nguồn gốc của những câu hỏi mồ côi mà {@code ChatMemoryCleaner} sinh
     * ra để dọn.
     */
    @Bean
    public ChatMemory chatMemory(DatabaseChatMemoryRepository repository) {
        return MessageWindowChatMemory.builder()
                .chatMemoryRepository(repository)
                .maxMessages(5)
                .build();
    }

}
