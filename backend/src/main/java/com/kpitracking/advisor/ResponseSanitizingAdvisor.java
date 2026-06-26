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

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.regex.Pattern;

public class ResponseSanitizingAdvisor implements CallAdvisor, StreamAdvisor {

    /**
     * Pre-compiled matcher for internal tool-name leaks. Matches an (optional) lead-in verb and an
     * (optional) "tool" noun followed by a known tool name (with or without surrounding backticks),
     * e.g. "Sử dụng công cụ `compare_org_units`", "dùng get_kpi_detail", "`search_users`".
     * {@code null} when no tool names were supplied (redaction disabled).
     */
    private final Pattern toolLeakPattern;

    /** Replacement phrase shown to the user in place of any leaked internal tool name. */
    private static final String TOOL_REPLACEMENT = "tính năng tương ứng";

    public ResponseSanitizingAdvisor(Collection<String> toolNames) {
        this.toolLeakPattern = buildToolLeakPattern(toolNames);
    }

    /** No-arg fallback: keeps existing behavior (formatting only, no tool-name redaction). */
    public ResponseSanitizingAdvisor() {
        this(List.of());
    }

    private static Pattern buildToolLeakPattern(Collection<String> toolNames) {
        if (toolNames == null || toolNames.isEmpty()) {
            return null;
        }
        // Longest names first so e.g. "get_kpi_period_breakdown" matches before "get_kpi".
        List<String> sorted = new ArrayList<>(toolNames);
        sorted.removeIf(n -> n == null || n.isBlank());
        if (sorted.isEmpty()) {
            return null;
        }
        sorted.sort((a, b) -> Integer.compare(b.length(), a.length()));
        StringBuilder alt = new StringBuilder();
        for (int i = 0; i < sorted.size(); i++) {
            if (i > 0) alt.append('|');
            alt.append(Pattern.quote(sorted.get(i).trim()));
        }
        String regex = "(?iu)(?:\\b(?:bằng cách|hãy|nên|có thể)\\s+)?"
                + "(?:(?:công cụ|tool|hàm|chức năng|function)\\s+)?"
                + "`?\\b(?:" + alt + ")\\b`?";
        return Pattern.compile(regex);
    }

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
        result = redactToolNames(result);
        return result.strip();
    }

    /**
     * Removes leaked internal tool names from user-facing text, replacing each leak (and its
     * optional "công cụ/tool" scaffolding) with a neutral business phrase so the sentence still
     * reads naturally — e.g. "Sử dụng công cụ `compare_org_units` để…" → "Sử dụng tính năng
     * tương ứng để…". Only known tool names are touched, avoiding false positives.
     */
    private String redactToolNames(String text) {
        if (toolLeakPattern == null || text == null || text.isEmpty()) {
            return text;
        }
        String redacted = toolLeakPattern.matcher(text).replaceAll(TOOL_REPLACEMENT);
        // Tidy up artifacts left behind: empty backticks and doubled spaces.
        redacted = redacted.replaceAll("`\\s*`", "");
        redacted = redacted.replaceAll("[ \\t]{2,}", " ");
        return redacted;
    }
}
