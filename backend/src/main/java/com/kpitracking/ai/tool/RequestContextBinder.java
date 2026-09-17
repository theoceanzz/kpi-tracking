package com.kpitracking.ai.tool;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import lombok.RequiredArgsConstructor;
import org.springframework.orm.jpa.EntityManagerFactoryUtils;
import org.springframework.orm.jpa.EntityManagerHolder;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.function.Supplier;

/**
 * Chạy một việc trên luồng BẤT KỲ với ngữ cảnh của luồng yêu cầu: người dùng đăng nhập và một
 * phạm vi Session JPA.
 *
 * <p><b>Vì sao cần.</b> langchain4j chạy tool trên luồng của nó (ForkJoinPool), kể cả khi không
 * streaming. Ở đó {@code SecurityContextHolder} rỗng — mọi dịch vụ đọc "người dùng hiện tại" ném
 * NPE (đo được: {@code review_submissions} hỏng ở D10 ngay lượt đầu trên lõi mới) — và không có
 * Session của {@code open-in-view}, nên mọi lời gọi nạp lười ném {@code LazyInitializationException}
 * (đúng lỗi đã gặp ở S01 khi bật streaming trên lõi cũ). Hai lỗi cùng gốc, một chỗ vá.
 *
 * <p>Ngữ cảnh bảo mật được BẮT lúc dựng bộ tool (trên luồng yêu cầu) rồi đặt lại trước khi chạy
 * tool; Session chỉ mở khi luồng hiện tại chưa có (chạy trên chính luồng yêu cầu thì dùng cái đang
 * có). Không mở giao dịch: tool đọc là chính, và giữ một kết nối suốt lúc chờ model là lãng phí.
 */
@Component
@RequiredArgsConstructor
public class RequestContextBinder {

    private final EntityManagerFactory entityManagerFactory;

    /** Ảnh chụp ngữ cảnh bảo mật của luồng hiện tại, để mang sang luồng khác. */
    public SecurityContext capture() {
        return SecurityContextHolder.getContext();
    }

    public <T> T runWith(SecurityContext security, Supplier<T> body) {
        SecurityContext previous = SecurityContextHolder.getContext();
        SecurityContextHolder.setContext(security);
        boolean opened = false;
        EntityManager em = null;
        if (!TransactionSynchronizationManager.hasResource(entityManagerFactory)) {
            em = entityManagerFactory.createEntityManager();
            TransactionSynchronizationManager.bindResource(entityManagerFactory, new EntityManagerHolder(em));
            opened = true;
        }
        try {
            return body.get();
        } finally {
            if (opened) {
                TransactionSynchronizationManager.unbindResource(entityManagerFactory);
                EntityManagerFactoryUtils.closeEntityManager(em);
            }
            SecurityContextHolder.setContext(previous);
        }
    }
}
