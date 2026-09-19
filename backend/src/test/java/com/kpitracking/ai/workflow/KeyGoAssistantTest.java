package com.kpitracking.ai.workflow;

import dev.langchain4j.agentic.agent.AgentInvocationException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class KeyGoAssistantTest {

    @Test
    @DisplayName("nhận ra 'hết ngân sách vòng gọi tool' qua thông điệp của langchain4j 1.20, kể cả khi bị bọc")
    void recognizesBudgetExceededThroughCauseChain() {
        RuntimeException inner = new RuntimeException(
                "Something is wrong, exceeded 10 tool calling round trips (maxToolCallingRoundTrips)");
        assertThat(KeyGoAssistant.isToolBudgetExceeded(new AgentInvocationException("agent lỗi", inner))).isTrue();
        assertThat(KeyGoAssistant.isToolBudgetExceeded(new RuntimeException("Exceeded max sequential tool invocations"))).isTrue();
        assertThat(KeyGoAssistant.isToolBudgetExceeded(new RuntimeException("timeout"))).isFalse();
        assertThat(KeyGoAssistant.isToolBudgetExceeded(new RuntimeException((String) null))).isFalse();
    }
}
