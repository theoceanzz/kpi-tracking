package com.kpitracking.security.audit;

import com.kpitracking.entity.User;
import com.kpitracking.enums.UserStatus;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.service.EmailService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Email cảnh báo 403 dồn dập — prod (Coolify) không có chỗ gom log nên đây là kênh báo duy nhất. */
class ForbiddenBurstAlerterTest {

    private final EmailService email = mock(EmailService.class);
    private final UserRepository users = mock(UserRepository.class);
    private final ForbiddenBurstDetector.Burst burst =
            new ForbiddenBurstDetector.Burst("nv@co.vn", 12, 60, "GET /api/v1/submissions x9, GET /api/v1/users x3");

    {
        when(email.recipientLocale(anyString())).thenReturn(Locale.forLanguageTag("vi"));
    }

    @Test
    void configuredRecipients_receiveOneMailEach() {
        ForbiddenBurstAlerter alerter = new ForbiddenBurstAlerter(email, users, "ops@keygo.vn, dev@keygo.vn");

        alerter.send(burst, "org-1", "1.2.3.4");

        verify(email).sendEmail(eq("ops@keygo.vn"), contains("nv@co.vn"), contains("GET /api/v1/submissions x9"));
        verify(email).sendEmail(eq("dev@keygo.vn"), anyString(), anyString());
        verify(users, never()).findByIsPlatformAdminTrueAndStatus(any());
    }

    @Test
    void noConfiguredRecipients_fallBackToActivePlatformAdmins() {
        when(users.findByIsPlatformAdminTrueAndStatus(UserStatus.ACTIVE))
                .thenReturn(List.of(User.builder().email("admin@keygo.vn").build()));
        ForbiddenBurstAlerter alerter = new ForbiddenBurstAlerter(email, users, "");

        assertThat(alerter.recipients()).containsExactly("admin@keygo.vn");
        alerter.send(burst, "org-1", "1.2.3.4");
        verify(email).sendEmail(eq("admin@keygo.vn"), anyString(), anyString());
    }

    @Test
    void noRecipientAtAll_sendsNothing_doesNotThrow() {
        when(users.findByIsPlatformAdminTrueAndStatus(UserStatus.ACTIVE)).thenReturn(List.of());
        new ForbiddenBurstAlerter(email, users, "").send(burst, null, null);
        verify(email, never()).sendEmail(anyString(), anyString(), anyString());
    }

    @Test
    void body_escapesHtml_andListsEndpoints() {
        ForbiddenBurstAlerter alerter = new ForbiddenBurstAlerter(email, users, "ops@keygo.vn");
        ForbiddenBurstDetector.Burst evil = new ForbiddenBurstDetector.Burst("<script>@x", 10, 60, "GET /a<b> x10");

        String html = alerter.body(Locale.forLanguageTag("vi"), evil, "org", "ip", "06/10/2026 15:23:35");

        assertThat(html).doesNotContain("<script>").contains("&lt;script&gt;").contains("GET /a&lt;b&gt; x10");
        assertThat(html).contains("10").contains("60");
    }
}
