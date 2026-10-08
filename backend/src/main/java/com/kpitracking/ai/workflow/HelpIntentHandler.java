package com.kpitracking.ai.workflow;

import com.kpitracking.ai.agent.AiLanguage;
import com.kpitracking.ai.agent.help.HelpAgent;
import com.kpitracking.ai.agent.help.HelpAgentFactory;
import com.kpitracking.ai.agent.help.HelpService;
import com.kpitracking.entity.AiTokenUsage;
import com.kpitracking.service.AiTokenUsageRecorder;
import com.kpitracking.service.ai.AiTurn;
import dev.langchain4j.agentic.scope.AgenticScope;
import dev.langchain4j.service.Result;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.function.Consumer;

/**
 * Nhánh HELP: hỏi đáp về cách dùng KeyGo và quy chế của tổ chức, trả lời từ kho tri thức RAG.
 *
 * <p>Là {@link IntentHandler} đầu tiên — và là mẫu cho các nhánh sau: một bean, một dòng gợi ý
 * cho router, một bước ghi câu trả lời vào {@code AgentState}. Không tool, không bộ nhớ hội thoại
 * ở bước này (RAG có bộ lọc theo tổ chức riêng). Đường dẫn và ảnh minh hoạ đi THẲNG trong câu
 * trả lời (Markdown) — không có thẻ "Nguồn" riêng cho người dùng.
 * để client hiện "Nguồn".
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class HelpIntentHandler implements IntentHandler {

    public static final String INTENT = "HELP";

    private final HelpAgent helpAgent;

    @Override
    public String intent() {
        return INTENT;
    }

    @Override
    public String routerHint() {
        return "HELP    - hỏi CÁCH DÙNG hệ thống KeyGo: làm sao để..., ở đâu, nút nào, quy trình/quy chế\n"
             + "          nói gì, ai được phép làm gì theo quy định. KHÔNG phải hỏi số liệu thật, và KHÔNG\n"
             + "          phải hỏi việc đang chờ mình (hôm nay cần làm gì, còn gì chờ duyệt -> KPI).\n"
             + "          HELP đi một mình: câu hỏi về cách dùng thì chỉ trả HELP.";
    }

    @Override
    public Consumer<AgenticScope> step() {
        return scope -> {
            AiTurn turn = TurnSteps.turnOf(scope);
            turn.progress("HELP", "Đang tra tài liệu hướng dẫn");
            AiTokenUsage.AiFeature previous = AiTokenUsageRecorder.currentFeature();
            try {
                AiTokenUsageRecorder.setFeature(AiTokenUsage.AiFeature.HELP);
                Result<String> result = helpAgent.answer(AiLanguage.prefix(turn.getLanguage()) + turn.getQuestion(),
                        HelpAgentFactory.params(turn.getManager().orgId(), turn.getManager().userId()));
                turn.getAgentState().setAnswer(result.content());
                turn.getAgentState().addSources(HelpService.sourcesOf(result));
            } finally {
                if (previous == null) AiTokenUsageRecorder.clearFeature();
                else AiTokenUsageRecorder.setFeature(previous);
            }
        };
    }
}
