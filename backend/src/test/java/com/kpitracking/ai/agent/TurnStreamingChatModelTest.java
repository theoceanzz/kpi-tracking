package com.kpitracking.ai.agent;

import com.kpitracking.ai.tool.RequestContextBinder;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.TurnListener;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.model.chat.StreamingChatModel;
import dev.langchain4j.model.chat.request.ChatRequest;
import dev.langchain4j.model.chat.response.ChatResponse;
import dev.langchain4j.model.chat.response.PartialResponse;
import dev.langchain4j.model.chat.response.StreamingChatResponseHandler;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ForkJoinPool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class TurnStreamingChatModelTest {

    private final RequestContextBinder binder = new RequestContextBinder(mock(EntityManagerFactory.class));

    /** Model giả: ghi lại người dùng nhìn thấy lúc được gọi, phát hai mẩu rồi kết thúc. */
    private static final class Fake implements StreamingChatModel {
        String userSeen;
        @Override
        public void doChat(ChatRequest request, StreamingChatResponseHandler handler) {
            var auth = SecurityContextHolder.getContext().getAuthentication();
            userSeen = auth == null ? null : auth.getName();
            handler.onPartialResponse("Xin ");
            handler.onPartialResponse(new PartialResponse("chào"), null);
            handler.onCompleteResponse(ChatResponse.builder().aiMessage(AiMessage.from("Xin chào")).build());
        }
    }

    private static ChatRequest request() {
        return ChatRequest.builder().messages(dev.langchain4j.data.message.UserMessage.from("hi")).build();
    }

    private static final class Collecting implements StreamingChatResponseHandler {
        final List<String> chunks = new ArrayList<>();
        String complete;
        @Override public void onPartialResponse(String s) { chunks.add(s); }
        @Override public void onCompleteResponse(ChatResponse r) { complete = r.aiMessage().text(); }
        @Override public void onError(Throwable e) { throw new AssertionError(e); }
    }

    private static AiTurn turnWith(TurnListener listener) {
        AiTurn turn = new AiTurn("q", null, null);
        turn.setListener(listener);
        return turn;
    }

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("mỗi mẩu chữ tới người nghe đúng MỘT lần, và handler của langchain4j vẫn nhận đủ")
    void forwardsEachChunkOnce() {
        List<String> heard = new ArrayList<>();
        TurnListener listener = new TurnListener() {
            @Override public void token(String chunk) { heard.add(chunk); }
        };
        Fake fake = new Fake();
        StreamingChatModel model = TurnStreamingChatModel.forTurn(fake, binder, turnWith(listener), true);
        assertThat(((TurnStreamingChatModel) model).forwardsTokens()).isTrue();

        Collecting inner = new Collecting();
        model.chat(request(), inner);

        assertThat(heard).containsExactly("Xin ", "chào");
        assertThat(inner.chunks).containsExactly("Xin ", "chào");
        assertThat(inner.complete).isEqualTo("Xin chào");
    }

    @Test
    @DisplayName("người nghe ném lỗi (SSE đứt) -> luồng vẫn chạy trọn, câu trả lời vẫn về")
    void listenerFailureDoesNotBreakTheStream() {
        TurnListener broken = new TurnListener() {
            @Override public void token(String chunk) { throw new IllegalStateException("client đã đóng"); }
        };
        Collecting inner = new Collecting();
        TurnStreamingChatModel.forTurn(new Fake(), binder, turnWith(broken), true).chat(request(), inner);

        assertThat(inner.chunks).containsExactly("Xin ", "chào");
        assertThat(inner.complete).isEqualTo("Xin chào");
    }

    @Test
    @DisplayName("không có người nghe thật, hoặc streaming tắt -> vẫn bọc (vì ngữ cảnh bảo mật) nhưng không phát chữ")
    void noForwardingWithoutListener() {
        var noop = (TurnStreamingChatModel) TurnStreamingChatModel.forTurn(new Fake(), binder, turnWith(TurnListener.NOOP), true);
        assertThat(noop.forwardsTokens()).isFalse();
        var off = (TurnStreamingChatModel) TurnStreamingChatModel.forTurn(new Fake(), binder, turnWith(new TurnListener() { }), false);
        assertThat(off.forwardsTokens()).isFalse();
    }

    @Test
    @DisplayName("lời gọi model trên ForkJoinPool (sau một tool) vẫn thấy người dùng của lượt — TokenUsageListener ghi được")
    void carriesTheUserOntoAnotherThread() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("director@demo.com", "n/a", List.of()));
        Fake fake = new Fake();
        StreamingChatModel model = TurnStreamingChatModel.forTurn(fake, binder, turnWith(TurnListener.NOOP), true);
        SecurityContextHolder.clearContext();

        CompletableFuture.runAsync(() -> model.chat(request(), new Collecting()), ForkJoinPool.commonPool()).get();

        assertThat(fake.userSeen).isEqualTo("director@demo.com");
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }
}
