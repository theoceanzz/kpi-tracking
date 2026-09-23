package com.kpitracking.ai.tool;

import com.kpitracking.service.ManagerContextResolver.ManagerContext;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.action.PendingActionStore;
import com.kpitracking.service.ai.agent.AgentState;
import com.kpitracking.service.ai.form.FormRegistry;
import com.kpitracking.tool.ConfirmActionTool;
import com.kpitracking.tool.ToolRegistry;
import com.kpitracking.tool.ToolRegistry.Group;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.agent.tool.ToolExecutionRequest;
import dev.langchain4j.invocation.InvocationParameters;
import dev.langchain4j.service.tool.ToolExecutor;
import dev.langchain4j.service.tool.ToolProviderRequest;
import dev.langchain4j.service.tool.ToolProviderResult;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Test cho bộ trao tool theo lượt.
 *
 * <p>Hai điều được chốt, cả hai đều là lỗi đã đo trên lõi mới ngay lượt đầu:
 * <ul>
 *   <li>tool chạy trên luồng KHÁC vẫn thấy người dùng đăng nhập (langchain4j chạy tool trên
 *       ForkJoinPool; thiếu ngữ cảnh thì mọi dịch vụ đọc "người dùng hiện tại" NPE);</li>
 *   <li>không có ngữ cảnh lượt thì không trao tool nào — an toàn hơn trao tất cả.</li>
 * </ul>
 */
class KeyGoToolProviderTest {

    /** Tool giả: ghi lại tên người dùng đang đăng nhập ở LUỒNG CHẠY TOOL. */
    public static class WhoAmITool {
        static volatile String seenUser;
        static volatile String seenThread;

        @Tool(name = "who_am_i", value = "trả về người đang đăng nhập")
        public String whoAmI(InvocationParameters params) {
            var auth = SecurityContextHolder.getContext().getAuthentication();
            seenUser = auth == null ? null : auth.getName();
            seenThread = Thread.currentThread().getName();
            return "ok";
        }
    }

    private ToolRegistry registry;
    private PendingActionStore pendingActionStore;
    private KeyGoToolProvider provider;
    private AiTurn turn;

    @BeforeEach
    void setUp() {
        registry = mock(ToolRegistry.class);
        pendingActionStore = mock(PendingActionStore.class);
        FormRegistry formRegistry = mock(FormRegistry.class);
        EntityManagerFactory emf = mock(EntityManagerFactory.class);
        when(emf.createEntityManager()).thenReturn(mock(EntityManager.class));

        provider = new KeyGoToolProvider(registry, formRegistry, pendingActionStore,
                mock(ConfirmActionTool.class), new RequestContextBinder(emf));

        turn = new AiTurn("hỏi", null, null);
        turn.setManager(new ManagerContext(UUID.randomUUID(), "/cty/", UUID.randomUUID(), "truong@demo.com", UUID.randomUUID()));
        turn.setToolGroups(Set.of(Group.LOOKUP));
        turn.setAgentState(new AgentState(turn));

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("truong@demo.com", "n/a", List.of()));
    }

    @AfterEach
    void clearLogin() {
        SecurityContextHolder.clearContext();
    }

    private ToolProviderRequest request() {
        return ToolProviderRequest.builder()
                .userMessage(dev.langchain4j.data.message.UserMessage.from("hỏi"))
                .invocationContext(dev.langchain4j.invocation.InvocationContext.builder()
                        .invocationParameters(InvocationParameters.from(Map.of(AgentState.CONTEXT_KEY, turn.getAgentState())))
                        .build())
                .build();
    }

    @Test
    @DisplayName("tool chạy trên luồng khác vẫn thấy đúng người đăng nhập của lượt")
    void propagatesSecurityContextToToolThread() throws Exception {
        when(registry.toolsFor(any(), any())).thenReturn(List.of(new WhoAmITool()));
        ToolProviderResult result = provider.provideTools(request());
        ToolExecutor executor = result.tools().values().iterator().next();

        // Chạy ở một luồng KHÔNG có SecurityContext — đúng như ForkJoinPool của langchain4j.
        CompletableFuture.runAsync(() -> executor.execute(
                ToolExecutionRequest.builder().name("who_am_i").arguments("{}").build(), "mem")).get();

        assertThat(WhoAmITool.seenUser).isEqualTo("truong@demo.com");
        assertThat(WhoAmITool.seenThread).doesNotContain("main");
        // Và không rò ngữ cảnh sang luồng đó sau khi chạy xong.
        assertThat(CompletableFuture.supplyAsync(
                () -> SecurityContextHolder.getContext().getAuthentication()).get()).isNull();
    }

    @Test
    @DisplayName("trao đúng tên tool của registry, và ghi lại danh sách vào lượt")
    void offersRegistryToolsAndRecordsNames() {
        when(registry.toolsFor(any(), any())).thenReturn(List.of(new WhoAmITool()));

        ToolProviderResult result = provider.provideTools(request());

        assertThat(result.tools().keySet()).extracting(s -> s.name()).containsExactly("who_am_i");
        assertThat(turn.getToolNames()).containsExactly("who_am_i");
    }

    @Test
    @DisplayName("không có ngữ cảnh lượt -> KHÔNG trao tool nào")
    void noTurnContextMeansNoTools() {
        ToolProviderResult result = provider.provideTools(ToolProviderRequest.builder()
                .userMessage(dev.langchain4j.data.message.UserMessage.from("hỏi"))
                .invocationContext(dev.langchain4j.invocation.InvocationContext.builder()
                        .invocationParameters(new InvocationParameters()).build())
                .build());

        assertThat(result.tools()).isEmpty();
    }

    @Test
    @DisplayName("có lời mời đang chờ trong hội thoại -> thêm tool xác nhận")
    void addsConfirmToolWhenActionPending() {
        when(registry.toolsFor(any(), any())).thenReturn(List.of());
        when(pendingActionStore.hasPending(any(), any())).thenReturn(true);
        ConfirmActionTool confirm = new ConfirmActionTool(null, null, null);
        provider = new KeyGoToolProvider(registry, mock(FormRegistry.class), pendingActionStore, confirm,
                new RequestContextBinder(mock(EntityManagerFactory.class, org.mockito.Mockito.RETURNS_DEEP_STUBS)));

        ToolProviderResult result = provider.provideTools(request());

        assertThat(result.tools().keySet()).extracting(s -> s.name()).containsExactly("confirm_pending_action");
    }
}
