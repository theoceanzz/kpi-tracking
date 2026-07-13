package com.kpitracking.exception;

/**
 * Thrown when a user exceeds the AI request rate limit (per-minute or per-day).
 * Mapped to HTTP 429 (Too Many Requests). The message is user-facing.
 */
public class AiRateLimitException extends RuntimeException {
    public AiRateLimitException(String message) {
        super(message);
    }
}
