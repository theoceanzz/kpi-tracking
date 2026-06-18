package com.kpitracking.util;

public final class AiUtils {
    private AiUtils() {
    }

    public static boolean isQuotaError(Exception e) {
        String msg = collectMessages(e).toLowerCase();
        return msg.contains("429") || msg.contains("quota") || msg.contains("rate limit")
                || msg.contains("payment required") || msg.contains("402") || msg.contains("exceeded");
    }

    private static String collectMessages(Throwable t) {
        StringBuilder sb = new StringBuilder();
        while (t != null) {
            if (t.getMessage() != null) {
                sb.append(t.getMessage()).append(" ");
            }
            t = t.getCause();
        }
        return sb.toString();
    }
}
