package com.kpitracking.security;

import com.kpitracking.logging.MdcKeys;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RequestContextFilterTest {

    private final MdcRequestContextFilter filter = new MdcRequestContextFilter();

    @BeforeEach
    @AfterEach
    void cleanMdc() {
        MDC.clear();
    }

    private static MockHttpServletRequest request() {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        req.setRemoteAddr("203.0.113.9");
        return req;
    }

    @Test
    @DisplayName("Trong chain có requestId/ip/method/path; header X-Request-Id được trả về")
    void putsContextAndHeader() throws Exception {
        MockHttpServletRequest req = request();
        MockHttpServletResponse res = new MockHttpServletResponse();
        AtomicReference<String> seen = new AtomicReference<>();

        filter.doFilter(req, res, (r, s) -> seen.set(MDC.get(MdcKeys.REQUEST_ID)
                + "|" + MDC.get(MdcKeys.IP) + "|" + MDC.get(MdcKeys.METHOD) + "|" + MDC.get(MdcKeys.PATH)));

        String[] parts = seen.get().split("\\|");
        assertThat(parts[0]).hasSize(36);                       // UUID
        assertThat(parts[1]).isEqualTo("203.0.113.9");
        assertThat(parts[2]).isEqualTo("POST");
        assertThat(parts[3]).isEqualTo("/api/v1/auth/login");
        assertThat(res.getHeader(MdcKeys.REQUEST_ID_HEADER)).isEqualTo(parts[0]);
    }

    @Test
    @DisplayName("X-Request-Id hợp lệ của client được giữ; giá trị bẩn bị thay bằng UUID")
    void honoursCleanClientIdOnly() throws Exception {
        MockHttpServletRequest clean = request();
        clean.addHeader(MdcKeys.REQUEST_ID_HEADER, "front-abc-12345");
        MockHttpServletResponse res1 = new MockHttpServletResponse();
        filter.doFilter(clean, res1, (r, s) -> { });
        assertThat(res1.getHeader(MdcKeys.REQUEST_ID_HEADER)).isEqualTo("front-abc-12345");

        MockHttpServletRequest dirty = request();
        dirty.addHeader(MdcKeys.REQUEST_ID_HEADER, "<script>alert(1)</script>");
        MockHttpServletResponse res2 = new MockHttpServletResponse();
        filter.doFilter(dirty, res2, (r, s) -> { });
        assertThat(res2.getHeader(MdcKeys.REQUEST_ID_HEADER)).hasSize(36).doesNotContain("<");
    }

    @Test
    @DisplayName("MDC rỗng sau filter kể cả khi chain ném exception")
    void clearsMdcEvenOnException() {
        MockHttpServletRequest req = request();
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain boom = (r, s) -> { throw new ServletException("boom"); };

        assertThatThrownBy(() -> filter.doFilter(req, res, boom)).isInstanceOf(ServletException.class);

        assertThat(MDC.getCopyOfContextMap()).isNullOrEmpty();
    }

    @Test
    @DisplayName("Dispatch REQUEST rồi ASYNC trên cùng request: requestId không đổi, header set một lần")
    void sameRequestIdAcrossAsyncRedispatch() throws IOException, ServletException {
        MockHttpServletRequest req = request();
        MockHttpServletResponse res = new MockHttpServletResponse();
        AtomicReference<String> first = new AtomicReference<>();
        AtomicReference<String> second = new AtomicReference<>();

        req.setDispatcherType(DispatcherType.REQUEST);
        filter.doFilter(req, res, (r, s) -> first.set(MDC.get(MdcKeys.REQUEST_ID)));
        assertThat(MDC.getCopyOfContextMap()).isNullOrEmpty();   // thread trả về pool sạch

        // Lần 2: Tomcat dispatch ASYNC trên thread khác — mô phỏng bằng cùng request, MDC trống.
        req.setDispatcherType(DispatcherType.ASYNC);
        req.setAsyncStarted(true);
        filter.doFilter(req, res, (r, s) -> second.set(MDC.get(MdcKeys.REQUEST_ID)));

        assertThat(second.get()).isEqualTo(first.get());
        assertThat(res.getHeaders(MdcKeys.REQUEST_ID_HEADER)).containsExactly(first.get());
        assertThat(filter.shouldNotFilterAsyncDispatch()).isFalse();
    }
}
