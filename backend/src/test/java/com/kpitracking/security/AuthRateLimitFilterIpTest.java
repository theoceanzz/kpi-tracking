package com.kpitracking.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AuthRateLimitFilterIpTest {

    @Test
    void privateRangesAreProxies() {
        assertTrue(AuthRateLimitFilter.isPrivate("10.0.1.5"));
        assertTrue(AuthRateLimitFilter.isPrivate("172.18.0.2"));   // docker bridge
        assertTrue(AuthRateLimitFilter.isPrivate("192.168.1.10"));
        assertTrue(AuthRateLimitFilter.isPrivate("127.0.0.1"));
        assertTrue(AuthRateLimitFilter.isPrivate("::1"));
        assertTrue(AuthRateLimitFilter.isPrivate("fd00::1"));
    }

    @Test
    void publicAndGarbageAreNotProxies() {
        assertFalse(AuthRateLimitFilter.isPrivate("8.8.8.8"));
        assertFalse(AuthRateLimitFilter.isPrivate("2001:4860:4860::8888"));
        assertFalse(AuthRateLimitFilter.isPrivate("evil.example.com")); // không tra DNS
        assertFalse(AuthRateLimitFilter.isPrivate("not an ip"));
    }
}
