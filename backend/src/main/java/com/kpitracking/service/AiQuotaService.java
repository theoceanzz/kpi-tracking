package com.kpitracking.service;

import com.kpitracking.entity.AiTokenQuota;
import com.kpitracking.entity.AiTokenUsage;
import com.kpitracking.entity.User;
import com.kpitracking.exception.AiTokenQuotaExceededException;
import com.kpitracking.repository.AiTokenQuotaRepository;
import com.kpitracking.repository.AiTokenUsageRepository;
import com.kpitracking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.NumberFormat;
import java.util.Locale;
import java.util.UUID;

/**
 * Cổng chặn hạn mức token, chạy <b>trước</b> mỗi lượt gọi LLM.
 *
 * <p>Vì tổng hạn mức phân bổ luôn ≤ ngân sách công ty (kiểm ở {@link AiQuotaAllocationService}),
 * chỉ cần kiểm hạn mức cá nhân ở đây là cả công ty tự khắc không vượt ngân sách. Không phải
 * kiểm hai tầng, và không có cảnh "hạn mức riêng còn mà bị cắt vì công ty hết".
 *
 * <p><b>Hạn chế cố hữu:</b> chi phí token chỉ biết được sau khi gọi, mà cổng chặn phải chạy trước,
 * nên lượt cuối cùng có thể vượt hạn mức đôi chút. Đây là đánh đổi của mọi hệ thống hạn mức token.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiQuotaService {

    private final AiTokenQuotaRepository quotaRepository;
    private final AiTokenUsageRepository usageRepository;
    private final UserRepository userRepository;

    /** Hạn mức, phần đã chia đi, đã tiêu và còn lại của một người trong tháng hiện tại. */
    public record QuotaStatus(long monthlyLimit, long allocatedToOthers, long spendable, long used) {
        public long remaining() {
            return Math.max(0, spendable - used);
        }
    }

    @Transactional(readOnly = true)
    public QuotaStatus getStatus(UUID userId) {
        AiTokenQuota quota = quotaRepository.findById(userId).orElse(null);
        long limit = quota != null ? quota.getMonthlyLimit() : 0L;
        long allocatedAway = quotaRepository.sumAllocatedBy(userId);
        long spendable = Math.max(0, limit - allocatedAway);
        long used = usageRepository.sumTotalTokensByUser(userId, AiTokenUsage.currentPeriod());
        return new QuotaStatus(limit, allocatedAway, spendable, used);
    }

    /** Chặn nếu người dùng đã hết hạn mức tháng này. */
    @Transactional(readOnly = true)
    public void checkAndThrow(String email) {
        if (email == null || email.isBlank()) return;

        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) return;

        QuotaStatus status = getStatus(user.getId());

        if (status.spendable() <= 0) {
            throw new AiTokenQuotaExceededException(
                    "Bạn chưa được cấp hạn mức token AI cho tháng này. Vui lòng liên hệ quản lý của bạn.");
        }
        if (status.used() >= status.spendable()) {
            throw new AiTokenQuotaExceededException(String.format(
                    "Bạn đã dùng hết hạn mức token AI tháng này (%s/%s token). "
                            + "Hạn mức sẽ được làm mới vào đầu tháng sau, hoặc liên hệ quản lý để được cấp thêm.",
                    format(status.used()), format(status.spendable())));
        }
    }

    private static String format(long value) {
        return NumberFormat.getInstance(new Locale("vi", "VN")).format(value);
    }
}
