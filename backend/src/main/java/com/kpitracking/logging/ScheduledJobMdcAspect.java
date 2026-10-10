package com.kpitracking.logging;

import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Mọi method {@code @Scheduled} chạy trong ngữ cảnh MDC riêng ({@code job}, {@code jobId}) và được log
 * bắt đầu / kết thúc / thất bại kèm thời lượng. Job chạy ở scheduler thread — không có request nên không
 * có requestId; {@code jobId} là mã để tra toàn bộ log của một lượt chạy.
 *
 * <p>Bắt đầu / xong ở DEBUG: job 1–5 phút một lần từng chiếm phần lớn log prod mà không nói gì. Chỉ lượt chạy
 * lâu hơn {@link #SLOW_JOB_MS} mới lên INFO (đáng xem), lỗi vẫn ERROR.
 */
@Aspect
@Component
@Slf4j
public class ScheduledJobMdcAspect {

    static final long SLOW_JOB_MS = 1_000;

    @Around("@annotation(org.springframework.scheduling.annotation.Scheduled)")
    public Object aroundScheduled(ProceedingJoinPoint pjp) throws Throwable {
        String job = pjp.getSignature().getDeclaringType().getSimpleName() + "." + pjp.getSignature().getName();
        long start = System.nanoTime();
        MDC.put(MdcKeys.JOB, job);
        MDC.put(MdcKeys.JOB_ID, UUID.randomUUID().toString());
        try {
            log.debug("Job bắt đầu");
            Object result = pjp.proceed();
            long ms = (System.nanoTime() - start) / 1_000_000;
            if (ms >= SLOW_JOB_MS) log.info("Job xong sau {} ms (chậm)", ms);
            else log.debug("Job xong sau {} ms", ms);
            return result;
        } catch (Throwable t) {
            log.error("Job thất bại sau {} ms: {}", (System.nanoTime() - start) / 1_000_000, t.toString(), t);
            throw t;
        } finally {
            MDC.clear();
        }
    }
}
