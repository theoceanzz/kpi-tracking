package com.kpitracking.ai.agent;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class KpiSuggestionAgentTest {

    @Test
    @DisplayName("bóc mảng JSON dù model bọc trong ```json``` và thêm câu dẫn")
    void parsesFencedJson() {
        String raw = "Đây là gợi ý:\n```json\n[{\"name\":\"Uptime\",\"description\":\"d\",\"unit\":\"%\","
                + "\"targetValue\":99.5,\"weight\":30,\"frequency\":\"MONTHLY\",\"extra\":1}]\n```";
        var out = KpiSuggestionAgent.parse(raw);
        assertThat(out).hasSize(1);
        assertThat(out.get(0).getName()).isEqualTo("Uptime");
        assertThat(out.get(0).getTargetValue()).isEqualTo(99.5);
    }

    @Test
    @DisplayName("không có mảng -> rỗng; mảng hỏng -> ném để tầng trên báo đúng lỗi")
    void emptyAndBroken() {
        assertThat(KpiSuggestionAgent.parse(null)).isEmpty();
        assertThat(KpiSuggestionAgent.parse("Xin lỗi, không có dữ liệu")).isEmpty();
        assertThatThrownBy(() -> KpiSuggestionAgent.parse("[{\"name\": }]")).isInstanceOf(IllegalStateException.class);
    }
}
