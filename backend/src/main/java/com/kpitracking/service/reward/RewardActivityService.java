package com.kpitracking.service.reward;

import com.kpitracking.dto.response.reward.RewardActivityResponse;
import com.kpitracking.entity.RewardBudget;
import com.kpitracking.entity.RewardRedemption;
import com.kpitracking.entity.RewardTransaction;
import com.kpitracking.entity.User;
import com.kpitracking.enums.RewardActivityType;
import com.kpitracking.enums.RewardSourceType;
import com.kpitracking.repository.RewardBudgetRepository;
import com.kpitracking.repository.RewardRedemptionRepository;
import com.kpitracking.repository.RewardTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * Bảng tin điểm thưởng: dải tin chạy ngang cho cả tổ chức cùng thấy ai vừa được thưởng,
 * ai vừa được cấp hạn mức, ai vừa đổi quà.
 *
 * <h2>Ai xem được gì</h2>
 * Bảng tin cố ý KHÔNG lọc theo đơn vị của người xem, khác với
 * {@link RewardQueryService#getUserTransactions} vốn đòi {@code REWARD:VIEW} tại đúng
 * đơn vị. Hai thứ phục vụ hai mục đích: kia là tra cứu ví của một cá nhân, đây là lời
 * loan báo — cả công ty biết mới là điểm của tính năng. Đổi lại, bảng tin chỉ nói
 * "ai — bao nhiêu điểm — vì việc gì", không hé số dư ví của bất kỳ ai.
 *
 * <p>Vẫn giới hạn trong MỘT tổ chức: đây là hệ đa tổ chức, không có ngoại lệ nào cho
 * dữ liệu chạy qua ranh giới đó.
 */
@Service
@RequiredArgsConstructor
public class RewardActivityService {

    /**
     * Trần cứng số dòng trả về. Bảng tin là thứ chạy qua để liếc, không phải trang tra
     * cứu — ai cần đầy đủ thì đã có sổ cái và danh sách đề nghị.
     */
    private static final int MAX_LIMIT = 50;
    private static final int DEFAULT_LIMIT = 30;

    private final RewardTransactionRepository transactionRepository;
    private final RewardBudgetRepository budgetRepository;
    private final RewardRedemptionRepository redemptionRepository;
    private final RewardContext context;

    @Transactional(readOnly = true)
    public List<RewardActivityResponse> getRecentActivity(Integer limit) {
        int size = clamp(limit);
        UUID orgId = context.getCurrentOrgId();

        // Lấy đủ `size` ở MỖI nguồn rồi mới trộn, chứ không chia size/3. Một tuần công ty
        // chỉ thưởng điểm mà không ai đổi quà là chuyện bình thường; chia đều sẽ làm bảng
        // tin ngắn đi dù dữ liệu vẫn còn thừa.
        Pageable page = PageRequest.of(0, size);

        Stream<RewardActivityResponse> awards =
                transactionRepository.findRecentAwardsForFeed(orgId, page).stream().map(this::toAward);
        Stream<RewardActivityResponse> budgets =
                budgetRepository.findRecentForFeed(orgId, page).stream().map(this::toBudgetGrant);
        Stream<RewardActivityResponse> redemptions =
                redemptionRepository.findRecentForFeed(orgId, page).stream().map(this::toRedemption);

        return Stream.of(awards, budgets, redemptions)
                .flatMap(s -> s)
                .sorted(Comparator.comparing(RewardActivityResponse::getOccurredAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(size)
                .toList();
    }

    private int clamp(Integer limit) {
        if (limit == null) return DEFAULT_LIMIT;
        return Math.min(Math.max(limit, 1), MAX_LIMIT);
    }

    private RewardActivityResponse toAward(RewardTransaction t) {
        User recipient = t.getUser();
        // Thưởng theo chương trình tự động không có người trao — để trống actor thay vì
        // bịa ra "Hệ thống", giao diện sẽ tự chọn cách diễn đạt không cần chủ ngữ.
        User actor = t.getSourceType() == RewardSourceType.AUTO_RANKING ? null : t.getActor();
        return RewardActivityResponse.builder()
                .id(t.getId())
                .type(RewardActivityType.POINTS_AWARDED)
                .userId(recipient.getId())
                .userName(recipient.getFullName())
                .userAvatarUrl(recipient.getAvatarUrl())
                .actorUserId(actor != null ? actor.getId() : null)
                .actorName(actor != null ? actor.getFullName() : null)
                .points(Math.abs(t.getAmount()))
                .note(t.getNote())
                .occurredAt(t.getCreatedAt())
                .build();
    }

    private RewardActivityResponse toBudgetGrant(RewardBudget b) {
        User grantor = b.getGrantor();
        return RewardActivityResponse.builder()
                .id(b.getId())
                .type(RewardActivityType.BUDGET_GRANTED)
                // Người được cấp hạn mức là nhân vật chính của dòng tin, không phải người ký cấp.
                .userId(grantor.getId())
                .userName(grantor.getFullName())
                .userAvatarUrl(grantor.getAvatarUrl())
                .points(b.getAllocatedPoints())
                .note(b.getNote())
                .occurredAt(b.getCreatedAt())
                .build();
    }

    private RewardActivityResponse toRedemption(RewardRedemption r) {
        User user = r.getUser();
        return RewardActivityResponse.builder()
                .id(r.getId())
                .type(RewardActivityType.GIFT_REDEEMED)
                .userId(user.getId())
                .userName(user.getFullName())
                .userAvatarUrl(user.getAvatarUrl())
                .points(r.getPointsSpent())
                // Bản chụp lúc đổi, không phải tên/ảnh hiện tại của món quà — xem javadoc
                // của RewardRedemption.
                .giftName(r.getGiftNameSnapshot())
                .giftImageUrl(r.getGiftImageSnapshot())
                .occurredAt(firstNonNull(r.getCreatedAt(), r.getUpdatedAt()))
                .build();
    }

    private Instant firstNonNull(Instant a, Instant b) {
        return a != null ? a : b;
    }
}
