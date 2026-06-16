package com.kpitracking.advisor;

import org.springframework.ai.chat.client.advisor.api.CallAdvisor;
import org.springframework.ai.chat.client.advisor.api.CallAdvisorChain;
import org.springframework.ai.chat.client.advisor.api.StreamAdvisor;
import org.springframework.ai.chat.client.advisor.api.StreamAdvisorChain;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.client.ChatClientRequest;
import org.springframework.ai.chat.client.ChatClientResponse;
import org.springframework.core.Ordered;
import reactor.core.publisher.Flux;

public class ResponseSanitizingAdvisor implements CallAdvisor, StreamAdvisor {

    @Override
    public ChatClientResponse adviseCall(ChatClientRequest request, CallAdvisorChain chain) {
        ChatClientResponse response = chain.nextCall(request);
        if (response.chatResponse() == null || response.chatResponse().getResult() == null) {
            return response;
        }

        String raw = response.chatResponse().getResult().getOutput().getText();
        if (raw == null) {
            return response;
        }

        String sanitized = sanitize(raw);
        if (sanitized.equals(raw)) {
            return response;
        }

        AssistantMessage sanitizedMsg = new AssistantMessage(sanitized);
        Generation gen = new Generation(sanitizedMsg,
                response.chatResponse().getResult().getMetadata());
        ChatResponse chatResp = new ChatResponse(java.util.List.of(gen),
                response.chatResponse().getMetadata());
        return new ChatClientResponse(chatResp, response.context());
    }

    @Override
    public String getName() {
        return this.getClass().getName();
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE - 1;
    }

    @Override
    public Flux<ChatClientResponse> adviseStream(ChatClientRequest request, StreamAdvisorChain chain) {
        return null;
    }

    private String sanitize(String result) {
        if (result == null) return "";
        String[] lines = result.split("\n", -1);
        for (int i = 0; i < lines.length; i++) {
            if (lines[i].stripLeading().startsWith("|")) {
                lines[i] = lines[i].replaceAll("(?i)<br\\s*/?>", " / ");
            } else {
                lines[i] = lines[i].replaceAll("(?i)<br\\s*/?>", "\n");
            }
        }
        result = String.join("\n", lines);
        result = result.replaceAll("(?m)(\\|[^\\n]+)\\n{2,}(?=\\|)", "$1\n");
        return result.strip();
    }
}
