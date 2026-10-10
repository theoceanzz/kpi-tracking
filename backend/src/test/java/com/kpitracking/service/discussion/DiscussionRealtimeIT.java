package com.kpitracking.service.discussion;

import com.kpitracking.enums.DiscussionTargetType;
import com.kpitracking.security.JwtTokenProvider;
import com.kpitracking.service.CollabITSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import java.lang.reflect.Type;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Test 2 của đặc tả trên máy chủ THẬT (cổng ngẫu nhiên) với STOMP client thật: người khác đang mở cùng KPI nhận
 * được bình luận mới không cần tải lại; người không xem được KPI bị chặn ngay ở SUBSCRIBE.
 * Chạy tay: {@code ./mvnw test -Dtest=DiscussionRealtimeIT}.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class DiscussionRealtimeIT extends CollabITSupport {

    @LocalServerPort int port;
    @Autowired JwtTokenProvider jwt;
    @Autowired DiscussionService discussionService;

    private final BlockingQueue<Throwable> errors = new LinkedBlockingQueue<>();

    private StompSession connect(UUID userId) throws Exception {
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        client.setMessageConverter(new MappingJackson2MessageConverter());
        StompHeaders headers = new StompHeaders();
        String email = userRepository.findById(userId).orElseThrow().getEmail();
        headers.add("Authorization", "Bearer " + jwt.generateAccessToken(email, List.of()));
        return client.connectAsync("ws://localhost:" + port + "/ws", new WebSocketHttpHeaders(), headers,
                new StompSessionHandlerAdapter() {
                    @Override
                    public void handleException(StompSession s, StompCommand c, StompHeaders h, byte[] p, Throwable ex) {
                        errors.add(ex);
                    }

                    @Override
                    public void handleTransportError(StompSession s, Throwable ex) {
                        errors.add(ex);
                    }

                    @Override
                    public void handleFrame(StompHeaders h, Object payload) {
                        // Khung ERROR (vd. SUBSCRIBE bị từ chối) về đây.
                        errors.add(new IllegalStateException(String.valueOf(h.get("message"))));
                    }
                }).get(10, TimeUnit.SECONDS);
    }

    private BlockingQueue<Map<String, Object>> listen(StompSession session) {
        BlockingQueue<Map<String, Object>> inbox = new LinkedBlockingQueue<>();
        session.subscribe("/topic/discussion.KPI." + kpiId, new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return Map.class;
            }

            @Override
            @SuppressWarnings("unchecked")
            public void handleFrame(StompHeaders headers, Object payload) {
                inbox.add((Map<String, Object>) payload);
            }
        });
        return inbox;
    }

    @Test
    void test2_openViewerReceivesNewCommentLive() throws Exception {
        StompSession headSession = connect(head);
        BlockingQueue<Map<String, Object>> inbox = listen(headSession);
        Thread.sleep(500); // để SUBSCRIBE tới broker trước khi phát

        loginAs(employee);
        var comment = discussionService.create(DiscussionTargetType.KPI, kpiId, "Có ai online không?", null, null, null);

        Map<String, Object> msg = inbox.poll(10, TimeUnit.SECONDS);
        assertThat(msg).isNotNull();
        assertThat(msg).containsEntry("action", "CREATED").containsEntry("commentId", comment.getId().toString());
        headSession.disconnect();
    }

    @Test
    void subscribeIsRejectedForUserWhoCannotViewKpi() throws Exception {
        StompSession outsiderSession = connect(outsider);
        BlockingQueue<Map<String, Object>> inbox = listen(outsiderSession);
        Thread.sleep(500);

        loginAs(employee);
        discussionService.create(DiscussionTargetType.KPI, kpiId, "Nội bộ thôi", null, null, null);

        assertThat(inbox.poll(3, TimeUnit.SECONDS)).isNull();
        assertThat(errors.poll(5, TimeUnit.SECONDS)).isNotNull();
    }
}
