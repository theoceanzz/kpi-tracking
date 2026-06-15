package com.kpitracking.exception;

public class AiQuotaExceededException extends RuntimeException {
    public AiQuotaExceededException(String message, Throwable cause) {
        super(message, cause);
    }
}
