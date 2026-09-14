package com.kpitracking.logging;

import org.springframework.core.task.TaskDecorator;

/** TaskDecorator cho ThreadPoolTaskExecutor của @Async: propagate MDC sang thread chạy task. */
public final class MdcTaskDecorator implements TaskDecorator {

    @Override
    public Runnable decorate(Runnable runnable) {
        return MdcPropagatingExecutor.wrap(runnable);
    }
}
