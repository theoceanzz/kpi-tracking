package com.kpitracking.ai.workflow;

import com.kpitracking.ai.agent.help.HelpAgent;
import com.kpitracking.ai.agent.help.HelpAgentFactory;
import com.kpitracking.ai.agent.help.HelpService;
import com.kpitracking.entity.AiTokenUsage;
import com.kpitracking.service.AiTokenUsageRecorder;
import com.kpitracking.service.ai.AiTurn;
import dev.langchain4j.agentic.scope.AgenticScope;
import dev.langchain4j.invocation.InvocationParameters;
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
 * ở bước này (RAG có bộ lọc theo tổ chức riêng); nguồn trích dẫn ghi vào {@code turn.sources}
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
             + "          nói gì, ai được phép làm gì theo quy định. KHÔNG phải hỏi số liệu thật.\n"
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
                Result<String> result = helpAgent.answer(turn.getQuestion(), InvocationParameters.from(
                        HelpAgentFactory.PARAM_ORG_ID, turn.getManager().orgId().toString()));
                turn.getAgentState().setAnswer(result.content());
                turn.setSources(HelpService.sourcesOf(result.sources()));
            } finally {
                if (previous == null) AiTokenUsageRecorder.clearFeature();
                else AiTokenUsageRecorder.setFeature(previous);
            }
        };
    }
}
