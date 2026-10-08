package com.kpitracking.security.audit;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Dòng log {@code SECURITY event=…}: bỏ trường null, che email, không chèn được dòng log giả. */
class SecurityAuditLogLineTest {

    @Test
    void omitsNullFields() {
        String line = SecurityAuditService.logLine(SecurityAuditEvent.LOGIN_SUCCESS, SecurityAuditService.OK,
                "nguyenvana@gmail.com", null, "203.0.113.7", null, null, null, null);
        assertThat(line).isEqualTo("SECURITY event=LOGIN_SUCCESS outcome=SUCCESS user=ng***@gmail.com ip=203.0.113.7");
        assertThat(line).doesNotContain("null");
    }

    @Test
    void keepsTargetAndDetail_whenPresent() {
        UUID org = UUID.fromString("00000000-0000-0000-0000-000000000001");
        String line = SecurityAuditService.logLine(SecurityAuditEvent.ACCESS_DENIED, SecurityAuditService.FAIL,
                null, org, null, "req-12345678", "HTTP", "GET /api/v1/submissions", "line1\nSECURITY event=FAKE");
        assertThat(line).isEqualTo("SECURITY event=ACCESS_DENIED outcome=FAILURE org=" + org
                + " requestId=req-12345678 target=HTTP:GET /api/v1/submissions detail=line1_SECURITY event=FAKE");
    }

    @Test
    void maskEmail() {
        assertThat(SecurityAuditService.maskEmail("nguyenvana@gmail.com")).isEqualTo("ng***@gmail.com");
        assertThat(SecurityAuditService.maskEmail("ab@x.vn")).isEqualTo("a***@x.vn");
        assertThat(SecurityAuditService.maskEmail("@x.vn")).isEqualTo("***@x.vn");
        assertThat(SecurityAuditService.maskEmail(null)).isNull();
        assertThat(SecurityAuditService.maskEmail("not-an-email")).isEqualTo("no***");
    }
}
