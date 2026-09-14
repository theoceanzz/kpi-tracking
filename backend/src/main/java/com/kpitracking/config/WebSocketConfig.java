package com.kpitracking.config;

import com.kpitracking.security.AuthCookieService;
import com.kpitracking.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.util.StringUtils;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Arrays;
import java.util.Map;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
@Slf4j
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    /** Khoá đặt token vào attributes của handshake để tầng STOMP đọc lại ở frame CONNECT. */
    private static final String TOKEN_ATTRIBUTE = "kg.accessToken";

    private final JwtTokenProvider jwtTokenProvider;
    private final UserDetailsService userDetailsService;
    private final AuthCookieService authCookieService;

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(o -> !o.isEmpty())
                .toArray(String[]::new);

        registry.addEndpoint("/ws")
                .setAllowedOrigins(origins)
                .addInterceptors(cookieHandshakeInterceptor());
    }

    /**
     * Token nằm trong cookie HttpOnly nên JavaScript không thể tự đặt header Authorization
     * vào frame STOMP CONNECT nữa. Bù lại, handshake WebSocket là một request HTTP same-origin
     * nên trình duyệt tự gửi cookie — ta lấy token ở đây rồi chuyển sang session attributes.
     */
    private HandshakeInterceptor cookieHandshakeInterceptor() {
        return new HandshakeInterceptor() {
            @Override
            public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                           WebSocketHandler wsHandler, Map<String, Object> attributes) {
                if (request instanceof ServletServerHttpRequest servletRequest) {
                    String token = authCookieService.readAccessToken(servletRequest.getServletRequest());
                    if (StringUtils.hasText(token)) {
                        attributes.put(TOKEN_ATTRIBUTE, token);
                    }
                }
                return true;
            }

            @Override
            public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                       WebSocketHandler wsHandler, Exception exception) {
                // không cần xử lý
            }
        };
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor == null) return message;

                // Frame STOMP chạy trên thread broker, không đi qua MdcRequestContextFilter nên không có
                // requestId; gắn phiên STOMP + user để log WebSocket vẫn tra được. Dọn ở finally.
                try {
                    if (accessor.getSessionId() != null) {
                        org.slf4j.MDC.put(com.kpitracking.logging.MdcKeys.WS_SESSION, accessor.getSessionId());
                    }
                    if (accessor.getUser() != null) {
                        org.slf4j.MDC.put(com.kpitracking.logging.MdcKeys.USER, accessor.getUser().getName());
                    }
                    return handleFrame(message, accessor);
                } finally {
                    org.slf4j.MDC.remove(com.kpitracking.logging.MdcKeys.WS_SESSION);
                    org.slf4j.MDC.remove(com.kpitracking.logging.MdcKeys.USER);
                }
            }

            private Message<?> handleFrame(Message<?> message, StompHeaderAccessor accessor) {
                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String token = resolveToken(accessor);
                    if (StringUtils.hasText(token)) {
                        if (jwtTokenProvider.isTokenValid(token)) {
                            String email = jwtTokenProvider.extractEmail(token);
                            UserDetails userDetails = userDetailsService.loadUserByUsername(email);
                            UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                                    userDetails, null, userDetails.getAuthorities());
                            accessor.setUser(auth);
                            org.slf4j.MDC.put(com.kpitracking.logging.MdcKeys.USER, email);
                            log.debug("WebSocket authenticated: {}", email);
                        } else {
                            log.warn("SECURITY ws_connect_rejected reason=invalid_token");
                            throw new org.springframework.messaging.MessageDeliveryException(
                                    message, "Phiên đăng nhập không hợp lệ");
                        }
                    } else {
                        // Không có token thì không có kết nối: kênh /queue mang thông báo
                        // riêng của từng người, không phục vụ khách ẩn danh.
                        log.warn("SECURITY ws_connect_rejected reason=no_credentials");
                        throw new org.springframework.messaging.MessageDeliveryException(
                                message, "Chưa đăng nhập");
                    }
                }
                return message;
            }
        });
    }

    /** Cookie (qua handshake attributes) là nguồn chính; native header giữ cho client không phải trình duyệt. */
    private String resolveToken(StompHeaderAccessor accessor) {
        Map<String, Object> attributes = accessor.getSessionAttributes();
        if (attributes != null && attributes.get(TOKEN_ATTRIBUTE) instanceof String token
                && StringUtils.hasText(token)) {
            return token;
        }

        String authHeader = accessor.getFirstNativeHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }

        return null;
    }
}
