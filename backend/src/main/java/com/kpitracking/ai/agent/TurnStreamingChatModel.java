package com.kpitracking.ai.agent;

import com.kpitracking.ai.tool.RequestContextBinder;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.TurnListener;
import dev.langchain4j.model.ModelProvider;
import dev.langchain4j.model.chat.Capability;
import dev.langchain4j.model.chat.ChatRequestOptions;
import dev.langchain4j.model.chat.StreamingChatModel;
import dev.langchain4j.model.chat.listener.ChatModelListener;
import dev.langchain4j.model.chat.request.ChatRequest;
import dev.langchain4j.model.chat.request.ChatRequestParameters;
import dev.langchain4j.model.chat.response.ChatResponse;
import dev.langchain4j.model.chat.response.CompleteToolCall;
import dev.langchain4j.model.chat.response.PartialResponse;
import dev.langchain4j.model.chat.response.PartialResponseContext;
import dev.langchain4j.model.chat.response.PartialThinking;
import dev.langchain4j.model.chat.response.PartialThinkingContext;
import dev.langchain4j.model.chat.response.PartialToolCall;
import dev.langchain4j.model.chat.response.PartialToolCallContext;
import dev.langchain4j.model.chat.response.StreamingChatResponseHandler;
import org.springframework.security.core.context.SecurityContext;

import java.util.List;
import java.util.Set;

/**
 * Model streaming CỦA MỘT LƯỢT: mang ngữ cảnh của lượt vào từng lời gọi model.
 *
 * <p>Agent chính là {@code @Agent} của mô-đun agentic, và {@code AgentBuilder.streamingChatModel(
 * Function<AgenticScope, …>)} cho chọn model THEO LƯỢT — đây là chỗ duy nhất biết "lượt nào đang
 * gọi" ở tầng model. Hai việc làm ở đây, vì cả hai đều cần đúng thứ đó:
 * <ol>
 *   <li><b>Người dùng đăng nhập.</b> Lời gọi model sau một tool chạy trên ForkJoinPool của langchain4j,
 *       nơi {@code SecurityContextHolder} rỗng — {@code TokenUsageListener.onRequest} không biết ghi
 *       token cho ai (đo được: "Bỏ qua ghi tiêu thụ token" cho mọi lời gọi thứ hai trở đi). Ngữ cảnh
 *       bắt lúc dựng (trên luồng yêu cầu) rồi đặt lại quanh từng {@code chat()}.</li>
 *   <li><b>Chữ chạy dần ra SSE.</b> Mô-đun agentic tự tiêu thụ {@code TokenStream} của sub-agent nên
 *       không còn chỗ gắn {@code onPartialResponse}; nghe ở tầng model là đủ. Chữ phát ra là BẢN XEM
 *       TRƯỚC (gồm cả các vòng model đang chuẩn bị gọi tool, y như trước); câu trả lời chính thức là
 *       bản mô-đun gom xong. Lỗi ở người nghe bị nuốt — SSE đứt không được làm hỏng câu trả lời.</li>
 * </ol>
 */
public final class TurnStreamingChatModel implements StreamingChatModel {

    private final StreamingChatModel delegate;
    private final RequestContextBinder binder;
    private final SecurityContext security;
    /** {@code null} = không phát chữ (đường JSON, hoặc streaming tắt). */
    private final TurnListener listener;

    private TurnStreamingChatModel(StreamingChatModel delegate, RequestContextBinder binder,
                                   SecurityContext security, TurnListener listener) {
        this.delegate = delegate;
        this.binder = binder;
        this.security = security;
        this.listener = listener;
    }

    /** Gọi trên luồng yêu cầu (mô-đun agentic gọi khi bắt đầu chạy sub-agent) — ngữ cảnh bảo mật bắt ở đây. */
    public static StreamingChatModel forTurn(StreamingChatModel delegate, RequestContextBinder binder,
                                             AiTurn turn, boolean streamingEnabled) {
        TurnListener l = turn == null ? null : turn.getListener();
        boolean listening = streamingEnabled && l != null && l != TurnListener.NOOP;
        return new TurnStreamingChatModel(delegate, binder, binder.capture(), listening ? l : null);
    }

    /** Có phát chữ cho người nghe không — cho test. */
    boolean forwardsTokens() {
        return listener != null;
    }

    @Override
    public void chat(ChatRequest request, StreamingChatResponseHandler handler) {
        binder.runWithSecurity(security, () -> {
            delegate.chat(request, wrap(handler));
            return null;
        });
    }

    @Override
    public void chat(ChatRequest request, ChatRequestOptions options, StreamingChatResponseHandler handler) {
        binder.runWithSecurity(security, () -> {
            delegate.chat(request, options, wrap(handler));
            return null;
        });
    }

    private StreamingChatResponseHandler wrap(StreamingChatResponseHandler handler) {
        return listener == null ? handler : new Forwarding(handler);
    }

    @Override public ChatRequestParameters defaultRequestParameters() { return delegate.defaultRequestParameters(); }
    @Override public List<ChatModelListener> listeners() { return delegate.listeners(); }
    @Override public ModelProvider provider() { return delegate.provider(); }
    @Override public Set<Capability> supportedCapabilities() { return delegate.supportedCapabilities(); }

    /**
     * Mỗi cặp callback (có/không ngữ cảnh) ghi đè CẢ HAI và chuyển tiếp đúng bản: model gốc chỉ gọi
     * một trong hai, nên mỗi mẩu chữ phát ra đúng một lần và handler của langchain4j nhận đúng bản
     * nó mong.
     */
    private final class Forwarding implements StreamingChatResponseHandler {
        private final StreamingChatResponseHandler inner;

        Forwarding(StreamingChatResponseHandler inner) {
            this.inner = inner;
        }

        @Override
        public void onPartialResponse(String chunk) {
            forward(chunk);
            inner.onPartialResponse(chunk);
        }

        @Override
        public void onPartialResponse(PartialResponse partial, PartialResponseContext context) {
            forward(partial == null ? null : partial.text());
            inner.onPartialResponse(partial, context);
        }

        private void forward(String chunk) {
            if (chunk == null || chunk.isEmpty()) return;
            try {
                listener.token(chunk);
            } catch (Exception ignore) {
                // Người nghe hỏng (client đóng SSE) không được làm hỏng lượt.
            }
        }

        @Override public void onPartialThinking(PartialThinking t) { inner.onPartialThinking(t); }
        @Override public void onPartialThinking(PartialThinking t, PartialThinkingContext c) { inner.onPartialThinking(t, c); }
        @Override public void onPartialToolCall(PartialToolCall t) { inner.onPartialToolCall(t); }
        @Override public void onPartialToolCall(PartialToolCall t, PartialToolCallContext c) { inner.onPartialToolCall(t, c); }
        @Override public void onCompleteToolCall(CompleteToolCall c) { inner.onCompleteToolCall(c); }
        @Override public void onUnmappedRawEvent(Object e) { inner.onUnmappedRawEvent(e); }
        @Override public void onCompleteResponse(ChatResponse r) { inner.onCompleteResponse(r); }
        @Override public void onError(Throwable e) { inner.onError(e); }
    }
}
