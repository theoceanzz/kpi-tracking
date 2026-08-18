package com.kpitracking.service.ai.stage;

import com.kpitracking.entity.Organization;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.service.AiQuotaService;
import com.kpitracking.service.AiRateLimiter;
import com.kpitracking.service.ManagerContextResolver;
import com.kpitracking.service.ManagerContextResolver.ManagerContext;
import com.kpitracking.service.ai.AiStage;
import com.kpitracking.service.ai.AiStageChain;
import com.kpitracking.service.ai.AiTurn;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Ba công đoạn canh cổng, chạy trước mọi thứ khác. Gom vào một file vì chúng ngắn và cùng một
 * nhiệm vụ — chặn lượt hỏi không hợp lệ trước khi tốn bất kỳ tài nguyên nào.
 */
public final class GuardStages {

    private GuardStages() {}

    private static String currentUserEmail() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    /** Chặn tần suất. Chuyển từ {@code AiController} vào chuỗi để mọi lối vào đều đi qua. */
    @Component
    @Order(100)
    @RequiredArgsConstructor
    public static class RateLimitStage implements AiStage {
        private final AiRateLimiter aiRateLimiter;

        @Override
        public String handle(AiTurn turn, AiStageChain next) {
            aiRateLimiter.check(currentUserEmail());
            return next.proceed(turn);
        }

        @Override
        public int getOrder() { return 100; }
    }

    /** Kiểm hạn mức token còn lại. Đặt sau chặn tần suất vì nó phải truy vấn cơ sở dữ liệu. */
    @Component
    @Order(200)
    @RequiredArgsConstructor
    public static class QuotaStage implements AiStage {
        private final AiQuotaService aiQuotaService;

        @Override
        public String handle(AiTurn turn, AiStageChain next) {
            aiQuotaService.checkAndThrow(currentUserEmail());
            return next.proceed(turn);
        }

        @Override
        public int getOrder() { return 200; }
    }

    /**
     * Quyền dùng tính năng: phải là trưởng/phó đơn vị, và tổ chức phải đang bật AI.
     * Đây cũng là nơi {@link ManagerContext} — gốc của mọi phép kiểm phạm vi phía sau — được nạp.
     */
    @Component
    @Order(300)
    @RequiredArgsConstructor
    public static class AuthScopeStage implements AiStage {
        private final ManagerContextResolver managerContextResolver;
        private final OrganizationRepository organizationRepository;

        @Override
        public String handle(AiTurn turn, AiStageChain next) {
            ManagerContext ctx = managerContextResolver.resolve();
            if (ctx == null) {
                // Cắt ngắn: trả thẳng câu giải thích, không chạy tiếp phần còn lại của chuỗi.
                return "Bạn không có quyền sử dụng tính năng AI phân tích. "
                        + "Chỉ trưởng đơn vị hoặc phó đơn vị mới có thể truy cập tính năng này.";
            }
            Organization org = organizationRepository.findById(ctx.orgId()).orElse(null);
            if (org == null || Boolean.FALSE.equals(org.getEnableAi())) {
                throw new ForbiddenException("Tính năng AI đã bị tắt cho tổ chức của bạn.");
            }
            turn.setManager(ctx);
            turn.setOrg(org);
            return next.proceed(turn);
        }

        @Override
        public int getOrder() { return 300; }
    }
}
