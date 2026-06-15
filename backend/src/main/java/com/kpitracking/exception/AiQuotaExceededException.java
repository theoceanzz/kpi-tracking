package com.kpitracking.exception;

/**
 * Thrown when AI service (LLM/model API) returns quota/rate-limit error.
 * Backend should catch this and return HTTP 402 (Payment Required) to the client
 * with a user-friendly message about token limit being exceeded.
 */
public class AiQuotaExceededException extends RuntimeException {
    public AiQuotaExceededException(String message, Throwable cause) {
        super(message, cause);
    }
}
