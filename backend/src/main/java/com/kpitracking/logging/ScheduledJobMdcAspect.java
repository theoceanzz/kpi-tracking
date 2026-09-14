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
 */
@Aspect
@Component
@Slf4j
public class ScheduledJobMdcAspect {

    @Around("@annotation(org.springframework.scheduling.annotation.Scheduled)")
    public Object aroundScheduled(ProceedingJoinPoint pjp) throws Throwable {
        String job = pjp.getSignature().getDeclaringType().getSimpleName() + "." + pjp.getSignature().getName();
        long start = System.nanoTime();
        MDC.put(MdcKeys.JOB, job);
        MDC.put(MdcKeys.JOB_ID, UUID.randomUUID().toString());
        try {
            log.info("Job bắt đầu");
            Object result = pjp.proceed();
            log.info("Job xong sau {} ms", (System.nanoTime() - start) / 1_000_000);
            return result;
        } catch (Throwable t) {
            log.error("Job thất bại sau {} ms: {}", (System.nanoTime() - start) / 1_000_000, t.toString(), t);
            throw t;
        } finally {
            MDC.clear();
        }
    }
}
