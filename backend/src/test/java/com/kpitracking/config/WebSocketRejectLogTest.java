package com.kpitracking.config;

import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Log {@code ws_connect_rejected} mang IP / Origin / User-Agent lúc handshake (log prod 2026-10-06 chỉ có reason). */
class WebSocketRejectLogTest {

    @Test
    void describeClient_takesPublicIpBehindProxy_originAndUserAgent() {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setRemoteAddr("10.0.0.5");
        req.addHeader("X-Forwarded-For", "203.0.113.7, 10.0.0.2");
        req.addHeader("Origin", "https://app.keygo.vn");
        req.addHeader("User-Agent", "Mozilla/5.0 Chrome/129");

        assertThat(WebSocketConfig.describeClient(req))
                .isEqualTo("ip=203.0.113.7 origin=https://app.keygo.vn ua=\"Mozilla/5.0 Chrome/129\"");
    }

    @Test
    void headerValues_cannotForgeLogLines_andAreTruncated() {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader("User-Agent", "x\r\nSECURITY login_ok user=admin \"" + "a".repeat(500));

        String line = WebSocketConfig.describeClient(req);
        assertThat(line).doesNotContain("\r").doesNotContain("\n").contains("origin=-");
        assertThat(line.length()).isLessThan(260);
    }

    @Test
    void clientOf_readsWhatHandshakeStored_orPlaceholder() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        assertThat(WebSocketConfig.clientOf(accessor)).isEqualTo("ip=? origin=? ua=?");

        Map<String, Object> attrs = new HashMap<>();
        attrs.put(WebSocketConfig.CLIENT_ATTRIBUTE, "ip=1.2.3.4 origin=- ua=\"curl/8\"");
        accessor.setSessionAttributes(attrs);
        assertThat(WebSocketConfig.clientOf(accessor)).isEqualTo("ip=1.2.3.4 origin=- ua=\"curl/8\"");
    }
}
