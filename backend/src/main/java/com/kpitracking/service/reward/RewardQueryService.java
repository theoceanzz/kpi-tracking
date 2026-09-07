package com.kpitracking.service.reward;

import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.reward.RewardTransactionResponse;
import com.kpitracking.dto.response.reward.RewardWalletResponse;
import com.kpitracking.entity.RewardTransaction;
import com.kpitracking.entity.RewardWallet;
import com.kpitracking.entity.User;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.RewardTransactionRepository;
import com.kpitracking.repository.RewardWalletRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.security.PermissionChecker;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Đọc ví và lịch sử giao dịch. Tách khỏi {@code RewardWalletService} để cái đó chỉ
 * còn đúng một việc: ghi sổ cái.
 */
@Service
@RequiredArgsConstructor
public class RewardQueryService {

    private final RewardWalletRepository walletRepository;
    private final RewardTransactionRepository transactionRepository;
    private final UserRepository userRepository;
    private final PermissionChecker permissionChecker;
    private final RewardContext context;

    @Transactional(readOnly = true)
    public RewardWalletResponse getMyWallet() {
        User me = context.getCurrentUser();
        return getWalletOf(context.getOrgIdOf(me.getId()), me);
    }

    @Transactional(readOnly = true)
    public PageResponse<RewardTransactionResponse> getMyTransactions(int page, int size) {
        User me = context.getCurrentUser();
        return toPage(transactionRepository.findByUserIdAndOrganizationIdOrderByCreatedAtDesc(
                me.getId(), context.getOrgIdOf(me.getId()), PageRequest.of(page, size)));
    }

    @Transactional(readOnly = true)
    public PageResponse<RewardWalletResponse> searchWallets(String keyword, int page, int size) {
        UUID orgId = context.getCurrentOrgId();
        Page<RewardWallet> result = walletRepository.searchByOrg(
                orgId, (keyword == null || keyword.isBlank()) ? null : keyword.trim(),
                PageRequest.of(page, size));

        return PageResponse.<RewardWalletResponse>builder()
                .content(result.getContent().stream().map(this::toWalletResponse).toList())
                .page(result.getNumber())
                .size(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .last(result.isLast())
                .build();
    }

    @Transactional(readOnly = true)
    public PageResponse<RewardTransactionResponse> getUserTransactions(UUID userId, int page, int size) {
        assertCanViewOthers(userId);
        return toPage(transactionRepository.findByUserIdAndOrganizationIdOrderByCreatedAtDesc(
                userId, context.getOrgIdOf(userId), PageRequest.of(page, size)));
    }

    /**
     * Xem ví người khác phải có {@code REWARD:VIEW} TẠI ĐƠN VỊ của người đó — quyền toàn
     * cục không đủ, nếu không một trưởng phòng sẽ xem được ví của cả công ty.
     */
    private void assertCanViewOthers(UUID targetUserId) {
        User me = context.getCurrentUser();
        if (me.getId().equals(targetUserId)) return;
        UUID targetUnitId = context.getPrimaryOrgUnit(targetUserId).getId();
        if (!permissionChecker.hasPermissionInOrgUnit(me.getId(), "REWARD:VIEW", targetUnitId)) {
            throw new ForbiddenException("Bạn không có quyền xem điểm thưởng của nhân viên này.");
        }
    }

    private RewardWalletResponse getWalletOf(UUID orgId, User user) {
        return walletRepository.findByOrganizationIdAndUserId(orgId, user.getId())
                .map(this::toWalletResponse)
                // Chưa có ví nghĩa là chưa từng phát sinh điểm — trả về ví rỗng thay vì
                // 404, để màn hình "Điểm của tôi" hiện số 0 chứ không hiện lỗi.
                .orElseGet(() -> RewardWalletResponse.builder()
                        .userId(user.getId())
                        .fullName(user.getFullName())
                        .email(user.getEmail())
                        .employeeCode(user.getEmployeeCode())
                        .avatarUrl(user.getAvatarUrl())
                        .balance(0).lifetimeEarned(0).lifetimeSpent(0)
                        .negative(false)
                        .build());
    }

    private RewardWalletResponse toWalletResponse(RewardWallet w) {
        return RewardWalletResponse.builder()
                .id(w.getId())
                .userId(w.getUser().getId())
                .fullName(w.getUser().getFullName())
                .email(w.getUser().getEmail())
                .employeeCode(w.getUser().getEmployeeCode())
                .avatarUrl(w.getUser().getAvatarUrl())
                .balance(w.getBalance())
                .lifetimeEarned(w.getLifetimeEarned())
                .lifetimeSpent(w.getLifetimeSpent())
                .negative(w.getBalance() != null && w.getBalance() < 0)
                .build();
    }

    private PageResponse<RewardTransactionResponse> toPage(Page<RewardTransaction> page) {
        return PageResponse.<RewardTransactionResponse>builder()
                .content(page.getContent().stream().map(t -> RewardTransactionResponse.builder()
                        .id(t.getId())
                        .amount(t.getAmount())
                        .type(t.getType())
                        .sourceType(t.getSourceType())
                        .balanceAfter(t.getBalanceAfter())
                        .note(t.getNote())
                        .actorUserId(t.getActor() != null ? t.getActor().getId() : null)
                        .actorName(t.getActor() != null ? t.getActor().getFullName() : null)
                        .createdAt(t.getCreatedAt())
                        .build()).toList())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }
}
