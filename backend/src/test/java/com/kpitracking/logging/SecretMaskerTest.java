package com.kpitracking.logging;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SecretMaskerTest {

    @Test
    void masksJwt() {
        String jwt = "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhQGIuY29tIiwiZXhwIjoxfQ.abcdefghijklmnopqrstuvwxyz0123456789";
        assertThat(SecretMasker.mask("token " + jwt + " end")).isEqualTo("token *** end");
    }

    @Test
    void masksBearerAndKnownPrefixes() {
        // "Bearer <token>" bị che, rồi mẫu "authorization: <giá trị>" che tiếp -> chỉ còn dấu ***
        assertThat(SecretMasker.mask("Authorization: Bearer abcdef123456.xyz"))
                .startsWith("Authorization: ").contains("***").doesNotContain("abcdef");
        assertThat(SecretMasker.mask("header Bearer abcdef123456.xyz sent")).isEqualTo("header Bearer *** sent");
        assertThat(SecretMasker.mask("key sk-ant-api03-FAKEFAKEFAKEFAKEFAKEFAKE")).isEqualTo("key ***");
        assertThat(SecretMasker.mask("g=AIzaSyFAKE0000000000000000000000000FAKE")).isEqualTo("g=***");
        assertThat(SecretMasker.mask("hf_FAKEfakeFAKEfakeFAKEfakeFAKEfake")).isEqualTo("***");
        assertThat(SecretMasker.mask("AKIAIOSFODNN7EXAMPLE")).isEqualTo("***");
    }

    @Test
    void masksNamedFields() {
        assertThat(SecretMasker.mask("login password=Secret123! ok")).isEqualTo("login password=*** ok");
        assertThat(SecretMasker.mask("{\"refreshToken\":\"9f1c-uuid-value\",\"x\":1}"))
                .isEqualTo("{\"refreshToken\":\"***\",\"x\":1}");
        assertThat(SecretMasker.mask("otp: 7K3Q9Z")).isEqualTo("otp: ***");
        assertThat(SecretMasker.mask("app_secret = 53447362c5885945")).isEqualTo("app_secret = ***");
    }

    @Test
    void leavesOrdinaryTextAlone() {
        String s = "Chốt kỳ đánh giá cycleId=1f2e orgUnitId=abcd by userId=9";
        assertThat(SecretMasker.mask(s)).isEqualTo(s);
        assertThat(SecretMasker.mask(null)).isNull();
        assertThat(SecretMasker.mask("")).isEmpty();
    }
}
