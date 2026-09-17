package com.kpitracking.ai.tool;

import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.action.PendingActionStore;
import com.kpitracking.service.ai.agent.AgentState;
import com.kpitracking.service.ai.form.FormRegistry;
import com.kpitracking.tool.ConfirmActionTool;
import com.kpitracking.tool.ToolRegistry;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.agent.tool.ToolSpecification;
import dev.langchain4j.agent.tool.ToolSpecifications;
import dev.langchain4j.agent.tool.ToolExecutionRequest;
import dev.langchain4j.invocation.InvocationContext;
import dev.langchain4j.service.tool.DefaultToolExecutor;
import dev.langchain4j.service.tool.ToolExecutionResult;
import dev.langchain4j.service.tool.ToolExecutor;
import dev.langchain4j.service.tool.ToolProvider;
import dev.langchain4j.service.tool.ToolProviderRequest;
import dev.langchain4j.service.tool.ToolProviderResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Trao cho model đúng bộ tool của LƯỢT này — và chỉ những tool người dùng có quyền dùng.
 *
 * <p>Đây là {@code ToolProvider} của langchain4j: được hỏi ở MỖI lời gọi agent chính, nhận ngữ cảnh
 * lượt qua {@code InvocationParameters}. Việc chọn (nhóm nào, quyền gì, form nào đang mở, có lời
 * mời chờ xác nhận không) vẫn nằm ở {@link ToolRegistry} — lớp này chỉ dịch danh sách bean sang
 * cặp (đặc tả, bộ chạy) mà langchain4j hiểu.
 *
 * <p><b>Lọc lúc CHỌN, không phải lúc chạy.</b> Model không thể gọi thứ nó không nhìn thấy. Đây là
 * nguyên tắc số một của module từ bản đầu, và {@code ToolProvider} là chỗ đúng để đặt nó: mỗi
 * lượt, mỗi người, một bộ tool riêng.
 *
 * <p>Đặc tả và bộ chạy tính từ phản chiếu một lần cho mỗi lớp tool rồi giữ lại — 24 tool, mỗi lượt
 * đọc lại annotation là phí vô ích.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class KeyGoToolProvider implements ToolProvider {

    private record Prepared(ToolSpecification spec, ToolExecutor executor) {}

    private final ToolRegistry registry;
    private final FormRegistry formRegistry;
    private final PendingActionStore pendingActionStore;
    private final ConfirmActionTool confirmActionTool;
    private final RequestContextBinder contextBinder;

    private final Map<Class<?>, List<Prepared>> cache = new ConcurrentHashMap<>();

    @Override
    public ToolProviderResult provideTools(ToolProviderRequest request) {
        AgentState state = request.invocationParameters() == null
                ? null : request.invocationParameters().get(AgentState.CONTEXT_KEY);
        if (state == null || state.getTurn() == null) {
            // Không có ngữ cảnh lượt thì không trao tool nào — an toàn hơn trao tất cả.
            log.warn("ToolProvider được gọi mà không có AgentState; không trao tool");
            return ToolProviderResult.builder().build();
        }
        AiTurn turn = state.getTurn();
        Set<ToolRegistry.Group> groups = turn.getToolGroups() == null ? Set.of() : turn.getToolGroups();
        java.util.UUID userId = turn.getManager() == null ? null : turn.getManager().userId();

        List<Object> beans = new ArrayList<>(registry.toolsFor(groups, userId));

        // Tool điền form chỉ có khi người dùng đang mở đúng form đó; tool xác nhận chỉ có khi có
        // lời mời đang treo trong chính hội thoại này. Cùng lý lẽ: không có việc thì không có tool.
        Object formTool = registry.formTool(formRegistry.toolNameFor(turn.getOpenFormId()));
        if (formTool != null) beans.add(formTool);
        if (pendingActionStore.hasPending(userId, turn.getConversationId())) beans.add(confirmActionTool);

        // Bắt ngữ cảnh bảo mật NGAY BÂY GIỜ (đang ở luồng yêu cầu) để mang sang luồng chạy tool.
        SecurityContext security = contextBinder.capture();

        ToolProviderResult.Builder out = ToolProviderResult.builder();
        Map<String, Object> names = new LinkedHashMap<>();
        for (Object bean : beans) {
            for (Prepared p : prepare(bean)) {
                out.add(p.spec(), new ContextBound(p.executor(), security));
                names.put(p.spec().name(), bean);
            }
        }
        turn.setToolNames(List.copyOf(names.keySet()));
        log.debug("Trao {} tool cho lượt: {}", names.size(), names.keySet());
        return out.build();
    }

    private List<Prepared> prepare(Object bean) {
        return cache.computeIfAbsent(bean.getClass(), cls -> {
            List<Prepared> out = new ArrayList<>();
            for (Method m : cls.getMethods()) {
                if (!m.isAnnotationPresent(Tool.class)) continue;
                out.add(new Prepared(ToolSpecifications.toolSpecificationFrom(m),
                        new DefaultToolExecutor(bean, m)));
            }
            return List.copyOf(out);
        });
    }

    /**
     * Bộ chạy tool có mang theo ngữ cảnh: langchain4j chạy tool trên luồng của nó, nên mỗi lần chạy
     * phải đặt lại người dùng đăng nhập và mở phạm vi Session — xem {@link RequestContextBinder}.
     */
    private final class ContextBound implements ToolExecutor {
        private final ToolExecutor delegate;
        private final SecurityContext security;

        ContextBound(ToolExecutor delegate, SecurityContext security) {
            this.delegate = delegate;
            this.security = security;
        }

        @Override
        public String execute(ToolExecutionRequest request, Object memoryId) {
            return contextBinder.runWith(security, () -> delegate.execute(request, memoryId));
        }

        @Override
        public ToolExecutionResult executeWithContext(ToolExecutionRequest request, InvocationContext context) {
            return contextBinder.runWith(security, () -> delegate.executeWithContext(request, context));
        }
    }
}
