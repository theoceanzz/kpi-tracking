package com.kpitracking.service;

import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.ai.AiQuotaAllocationResponse;
import com.kpitracking.dto.response.ai.AiQuotaOverviewResponse;
import com.kpitracking.entity.*;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.*;
import com.kpitracking.security.PermissionChecker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.NumberFormat;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Phân bổ hạn mức token theo cấp.
 *
 * <p>Toàn bộ nghiệp vụ quy về hai bất biến, kiểm ở {@link #setUserLimit}:
 * <pre>
 * (1)  SUM(monthly_limit) WHERE allocated_by IS NULL AND org = O  ≤  O.aiMonthlyTokenLimit
 * (2)  SUM(monthly_limit) WHERE allocated_by = M                  ≤  M.monthlyLimit
 * </pre>
 *
 * <p>Phần tự tiêu được của một người = hạn mức trừ đi phần đã chia cho cấp dưới. Quản lý chia hết
 * cho nhân viên thì chính họ không còn gì để dùng.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiQuotaAllocationService {

    private final AiTokenQuotaRepository quotaRepository;
    private final AiTokenUsageRepository usageRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final OrganizationRepository organizationRepository;
    private final PermissionChecker permissionChecker;
    private final AiQuotaService aiQuotaService;

    // ===== Đọc =====

    @Transactional(readOnly = true)
    public AiQuotaOverviewResponse getOverview() {
        User me = currentUser();
        Organization org = organizationOf(me.getId());
        boolean isTopManager = permissionChecker.isGlobalAdmin(me.getId());

        long pool;
        long allocated;
        if (isTopManager) {
            // Quản lý cao nhất chia từ ngân sách công ty
            pool = org.getAiMonthlyTokenLimit() != null ? org.getAiMonthlyTokenLimit() : 0L;
            allocated = quotaRepository.sumAllocatedFromCompanyBudget(org.getId());
        } else {
            // Quản lý cấp dưới chia từ hạn mức của chính mình
            pool = quotaRepository.findById(me.getId())
                    .map(AiTokenQuota::getMonthlyLimit).orElse(0L);
            allocated = quotaRepository.sumAllocatedBy(me.getId());
        }

        return AiQuotaOverviewResponse.builder()
                .canAllocate(canAllocate(me, org))
                .isTopManager(isTopManager)
                .subDelegationEnabled(Boolean.TRUE.equals(org.getAiAllowSubDelegation()))
                .companyMonthlyLimit(org.getAiMonthlyTokenLimit())
                .allocatablePool(pool)
                .allocated(allocated)
                .remainingToAllocate(Math.max(0, pool - allocated))
                .availableRoles(canAllocate(me, org)
                        ? userRoleOrgUnitRepository.findRoleNamesInScope(org.getId(), scopePaths(me))
                                .toArray(String[]::new)
                        : new String[0])
                .build();
    }

    /** Danh sách người mà người đang đăng nhập được phép cấp hạn mức, có phân trang và lọc. */
    @Transactional(readOnly = true)
    public PageResponse<AiQuotaAllocationResponse> getAllocatableUsers(
            String keyword, String roleName, String status, int page, int size) {

        User me = currentUser();
        Organization org = organizationOf(me.getId());
        requireCanAllocate(me, org);

        Collection<String> paths = scopePaths(me);
        Page<User> pageResult = userRoleOrgUnitRepository.searchAllocatableUsers(
                org.getId(), paths, keyword, roleName, status, AiTokenUsage.currentPeriod(),
                // Sort gắn vào alias gốc của truy vấn (uro), nên phải đi qua "user." mới tới
                // được thuộc tính của User — để "fullName" trơn sẽ lỗi UnknownPathException.
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                        Sort.by("user.fullName").ascending()));

        List<User> targets = pageResult.getContent();
        List<AiQuotaAllocationResponse> content = targets.isEmpty()
                ? List.of()
                : toRows(me, targets);

        return PageResponse.<AiQuotaAllocationResponse>builder()
                .content(content)
                .page(pageResult.getNumber())
                .size(pageResult.getSize())
                .totalElements(pageResult.getTotalElements())
                .totalPages(pageResult.getTotalPages())
                .last(pageResult.isLast())
                .build();
    }

    /** Ghép hạn mức, tiêu thụ và vai trò cho một trang người dùng — mỗi thứ đúng một truy vấn. */
    private List<AiQuotaAllocationResponse> toRows(User me, List<User> targets) {
        List<UUID> ids = targets.stream().map(User::getId).toList();

        Map<UUID, AiTokenQuota> quotas = quotaRepository.findByUserIdIn(ids).stream()
                .collect(Collectors.toMap(AiTokenQuota::getUserId, q -> q));
        Map<UUID, Long> used = usageRepository
                .sumTotalTokensByUsers(ids, AiTokenUsage.currentPeriod()).stream()
                .collect(Collectors.toMap(r -> (UUID) r[0], r -> ((Number) r[1]).longValue()));

        // findByUserIdInWithUnit đã JOIN FETCH cả role lẫn orgUnit -> không phát sinh N+1.
        // Một người có thể giữ nhiều vai trò; lấy vai trò rank nhỏ nhất (chức vụ cao nhất).
        Map<UUID, UserRoleOrgUnit> primaryRole = userRoleOrgUnitRepository.findByUserIdInWithUnit(ids).stream()
                .collect(Collectors.toMap(
                        a -> a.getUser().getId(),
                        a -> a,
                        (a, b) -> rankOf(a) <= rankOf(b) ? a : b));

        boolean iAmTopManager = permissionChecker.isGlobalAdmin(me.getId());

        // Những người đã cấp hạn mức cho trang này: lấy tên để hiện, lấy đơn vị để biết họ có
        // nằm dưới quyền mình không. Gom một lần cho cả trang thay vì hỏi từng dòng.
        List<UUID> funderIds = quotas.values().stream()
                .map(AiTokenQuota::getAllocatedBy)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<UUID, String> funderNames = funderIds.isEmpty() ? Map.of()
                : userRepository.findAllById(funderIds).stream()
                        .collect(Collectors.toMap(User::getId, User::getFullName));
        Map<UUID, Boolean> funderUnderMe =
                underMyScope(funderIds, iAmTopManager ? Set.of() : managedPaths(me), iAmTopManager);

        return targets.stream().map(u -> {
            AiTokenQuota q = quotas.get(u.getId());
            UserRoleOrgUnit assignment = primaryRole.get(u.getId());
            UUID funder = q != null ? q.getAllocatedBy() : null;

            // Phần vốn đã thuộc quyền mình: chưa ai cấp, dòng rỗng, mình cấp, hoặc ngân sách
            // công ty mà mình là quản lý cao nhất.
            boolean alreadyMine = q == null
                    || q.getMonthlyLimit() == 0L
                    || Objects.equals(funder, me.getId())
                    || (funder == null && iAmTopManager);
            // Phần do một người dưới quyền mình cấp: sửa được, nhưng là giành quyền cấp từ họ.
            boolean canSeize = !alreadyMine && funder != null
                    && Boolean.TRUE.equals(funderUnderMe.get(funder));

            return AiQuotaAllocationResponse.builder()
                    .userId(u.getId())
                    .fullName(u.getFullName())
                    .email(u.getEmail())
                    .roleName(assignment != null ? assignment.getRole().getName() : null)
                    .orgUnitName(assignment != null ? assignment.getOrgUnit().getName() : null)
                    .monthlyLimit(q != null ? q.getMonthlyLimit() : 0L)
                    .editable(alreadyMine || canSeize)
                    .allocatedByName(funder != null ? funderNames.get(funder) : null)
                    .takeover(canSeize)
                    .usedThisMonth(used.getOrDefault(u.getId(), 0L))
                    .build();
        }).toList();
    }

    private static int rankOf(UserRoleOrgUnit a) {
        return a.getRole().getRank() != null ? a.getRole().getRank() : 99;
    }

    // ===== Ghi =====

    @Transactional
    public void setUserLimit(UUID targetUserId, long newLimit) {
        if (newLimit < 0) throw new BusinessException("Hạn mức không được là số âm.");

        User me = currentUser();
        Organization org = organizationOf(me.getId());
        requireCanAllocate(me, org);

        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "id", targetUserId));

        boolean isTopManager = permissionChecker.isGlobalAdmin(me.getId());

        // Không tin userId client gửi lên: kiểm target có thật nằm trong phạm vi của mình không.
        requireTargetInScope(me, target, org, isTopManager);

        AiTokenQuota quota = quotaRepository.findById(targetUserId).orElse(null);
        long oldLimit = quota != null ? quota.getMonthlyLimit() : 0L;
        UUID myAllocator = isTopManager ? null : me.getId();
        UUID currentFunder = quota != null ? quota.getAllocatedBy() : myAllocator;

        // Hạn mức đang do người khác cấp: chỉ cấp trên của người đó mới được giành quyền cấp.
        // Hai quản lý ngang cấp vẫn không ghi đè được nhau — đó là lý do luật này tồn tại.
        //
        // Dòng 0 token không tính là của ai: không có đồng nào trong túi người cấp cũ để mà giành,
        // nên bất kỳ quản lý nào có người đó trong phạm vi đều cấp được. Thiếu điều kiện này thì
        // sau khi cấp trên nhả một người về 0, cấp dưới sẽ bị khoá vĩnh viễn không cấp lại được.
        boolean takeover = quota != null && oldLimit > 0
                && !Objects.equals(currentFunder, myAllocator);
        if (takeover && !canOverride(me, currentFunder, isTopManager)) {
            throw new BusinessException(currentFunder == null
                    ? "Hạn mức của người này được cấp thẳng từ ngân sách công ty. "
                            + "Chỉ quản lý cấp cao nhất mới thay đổi được."
                    : String.format(
                            "Hạn mức của người này do %s cấp. Bạn không phải cấp trên của "
                                    + "%s nên không thay đổi được.",
                            funderName(currentFunder), funderName(currentFunder)));
        }

        // Hạ xuống dưới phần chính người đó đã chia cho cấp dưới là làm hỏng bất biến (2). Không
        // phụ thuộc dấu của delta: khi giành quyền cấp, hạn mức mới có thể tăng mà vẫn thấp hơn
        // phần đã chia đi.
        long theyAllocatedAway = quotaRepository.sumAllocatedBy(targetUserId);
        if (newLimit < theyAllocatedAway) {
            throw new BusinessException(String.format(
                    "Không thể đặt %s token: %s đã chia %s token cho cấp dưới. "
                            + "Hãy thu hồi bớt phần đã chia trước.",
                    num(newLimit), target.getFullName(), num(theyAllocatedAway)));
        }

        // Sửa phần vốn đã của mình thì chỉ khoản tăng thêm mới tốn ngân sách. Giành lấy phần của
        // người khác thì TOÀN BỘ hạn mức mới là khoản mới với túi mình, vì trước đó không đồng nào
        // trong đó là của mình.
        long charge = takeover ? newLimit : Math.max(0, newLimit - oldLimit);
        if (charge > 0) {
            long remaining = remainingPool(me, org, isTopManager);
            if (charge > remaining) {
                throw new BusinessException(
                        insufficientPoolMessage(target, charge, remaining, isTopManager, takeover, currentFunder));
            }
        }

        if (quota == null) {
            quota = AiTokenQuota.builder().userId(targetUserId).build();
        }
        quota.setMonthlyLimit(newLimit);
        // Sau bước này hạn mức tính vào túi mình; phần cũ tự rời túi người cấp cũ vì sumAllocatedBy
        // chỉ đếm theo allocated_by.
        quota.setAllocatedBy(myAllocator);
        quota.setUpdatedAt(Instant.now());
        quotaRepository.save(quota);

        log.info("Đặt hạn mức token {} cho {} (người cấp: {}{})",
                newLimit, target.getEmail(), me.getEmail(), takeover ? ", giành từ người khác" : "");
    }

    /**
     * Người đang đăng nhập có đứng trên người đã cấp hạn mức không.
     *
     * <p>{@code funderId == null} nghĩa là cấp thẳng từ ngân sách công ty — chỉ quản lý cao nhất
     * mới đụng vào được, để cấp dưới không ghi đè phần do cấp trên cấp.
     */
    private boolean canOverride(User me, UUID funderId, boolean isTopManager) {
        if (funderId == null) return isTopManager;
        if (funderId.equals(me.getId())) return true;
        if (isTopManager) return true;
        return Boolean.TRUE.equals(
                underMyScope(List.of(funderId), managedPaths(me), false).get(funderId));
    }

    /**
     * Định dạng số theo kiểu Việt (30.000) cho khớp với giao diện. Không dùng {@code %,d} của
     * String.format vì nó theo locale mặc định của máy chủ nên ra 30,000.
     */
    private static String num(long value) {
        return NumberFormat.getInstance(new Locale("vi", "VN")).format(value);
    }

    private String funderName(UUID funderId) {
        if (funderId == null) return "ngân sách công ty";
        return userRepository.findById(funderId).map(User::getFullName).orElse("người khác");
    }

    /** Thông báo hết ngân sách phải chỉ ra được việc cần làm, nếu không người dùng sẽ bế tắc. */
    private String insufficientPoolMessage(User target, long charge, long remaining,
                                           boolean isTopManager, boolean takeover, UUID currentFunder) {
        String pool = isTopManager ? "Ngân sách công ty" : "Hạn mức của bạn";
        StringBuilder msg = new StringBuilder(String.format(
                "%s chỉ còn %s token, không đủ %s token để cấp cho %s. ",
                pool, num(remaining), num(charge), target.getFullName()));

        if (takeover) {
            // Giành lấy tính trọn hạn mức mới chứ không tính phần chênh, nên rất dễ chạm trần.
            // Người cấp cũ chính là chỗ nên thu hồi trước.
            msg.append(String.format(
                    "Hạn mức này đang do %s cấp và sẽ chuyển sang bạn cấp, nên tính trọn %s token. "
                            + "Hãy hạ hạn mức của %s để giải phóng ngân sách trước.",
                    funderName(currentFunder), num(charge), funderName(currentFunder)));
        } else {
            msg.append("Hãy hạ hạn mức của người khác để giải phóng ngân sách trước.");
        }
        return msg.toString();
    }

    @Transactional
    public void setSubDelegation(boolean enabled) {
        User me = currentUser();
        if (!permissionChecker.isGlobalAdmin(me.getId())) {
            throw new ForbiddenException("Chỉ quản lý cấp cao nhất mới bật/tắt được quyền phân bổ của cấp dưới.");
        }
        Organization org = organizationOf(me.getId());
        org.setAiAllowSubDelegation(enabled);
        organizationRepository.save(org);
    }

    // ===== Nội bộ =====

    /** Phần còn lại có thể chia: ngân sách công ty với quản lý cao nhất, hạn mức riêng với cấp dưới. */
    private long remainingPool(User me, Organization org, boolean isTopManager) {
        if (isTopManager) {
            long budget = org.getAiMonthlyTokenLimit() != null ? org.getAiMonthlyTokenLimit() : 0L;
            return Math.max(0, budget - quotaRepository.sumAllocatedFromCompanyBudget(org.getId()));
        }
        return aiQuotaService.getStatus(me.getId()).spendable();
    }

    private boolean canAllocate(User me, Organization org) {
        if (permissionChecker.isGlobalAdmin(me.getId())) return true;
        // Cấp dưới chỉ phân bổ được khi công ty đã bật uỷ quyền
        return Boolean.TRUE.equals(org.getAiAllowSubDelegation())
                && permissionChecker.hasPermission(me.getId(), "AI_QUOTA:ALLOCATE");
    }

    private void requireCanAllocate(User me, Organization org) {
        if (!canAllocate(me, org)) {
            throw new ForbiddenException("Bạn không có quyền phân bổ hạn mức token AI.");
        }
    }

    /**
     * Quản lý cao nhất cấp được cho mọi người trong công ty; cấp dưới chỉ trong subtree của mình.
     * Kiểm theo {@code OrgUnit.path} giống {@code OrgUnitStatisticTool.validateUserAccess}.
     */
    private void requireTargetInScope(User me, User target, Organization org, boolean isTopManager) {
        List<UserRoleOrgUnit> targetAssignments = userRoleOrgUnitRepository.findByUserId(target.getId());
        if (targetAssignments.isEmpty()) {
            throw new BusinessException("Người dùng này chưa thuộc đơn vị nào.");
        }

        boolean sameOrg = targetAssignments.stream().anyMatch(a ->
                a.getOrgUnit().getOrgHierarchyLevel().getOrganization().getId().equals(org.getId()));
        if (!sameOrg) {
            throw new ForbiddenException("Người dùng này không thuộc tổ chức của bạn.");
        }
        if (isTopManager) return;

        boolean inSubtree = targetAssignments.stream()
                .anyMatch(a -> startsWithAny(a.getOrgUnit().getPath(), managedPaths(me)));
        if (!inSubtree) {
            throw new ForbiddenException("Người dùng này không thuộc phạm vi quản lý của bạn.");
        }
    }

    /** Đường dẫn các đơn vị mà người này đứng đầu (trưởng hoặc phó) — gốc của mọi phép kiểm phạm vi. */
    private Set<String> managedPaths(User me) {
        return userRoleOrgUnitRepository.findByUserId(me.getId()).stream()
                .filter(a -> a.getRole().getRank() != null && a.getRole().getRank() <= 1)
                .map(a -> a.getOrgUnit().getPath())
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
    }

    private static boolean startsWithAny(String path, Set<String> prefixes) {
        return path != null && prefixes.stream().anyMatch(path::startsWith);
    }

    /**
     * Với mỗi người trong danh sách: họ có nằm trong phạm vi quản lý của mình không.
     * Gộp thành một truy vấn để dùng được trong vòng lặp dựng bảng mà không phát sinh N+1.
     */
    private Map<UUID, Boolean> underMyScope(Collection<UUID> userIds, Set<String> myPaths, boolean isTopManager) {
        if (userIds.isEmpty()) return Map.of();
        // Quản lý cao nhất đứng trên mọi người trong công ty; danh sách đã được lọc theo tổ chức.
        if (isTopManager) {
            return userIds.stream().distinct().collect(Collectors.toMap(id -> id, id -> true));
        }
        if (myPaths.isEmpty()) return Map.of();

        Map<UUID, Boolean> result = new HashMap<>();
        for (UserRoleOrgUnit a : userRoleOrgUnitRepository.findByUserIdInWithUnit(userIds)) {
            // Một người có thể giữ nhiều vai trò ở nhiều đơn vị; chỉ cần một đơn vị nằm trong
            // phạm vi của mình là đủ.
            result.merge(a.getUser().getId(),
                    startsWithAny(a.getOrgUnit().getPath(), myPaths),
                    (x, y) -> x || y);
        }
        return result;
    }

    /**
     * Giới hạn phạm vi cho truy vấn: {@code null} nghĩa là cả công ty (quản lý cao nhất),
     * ngược lại là tập đường dẫn các đơn vị mà người này quản lý.
     */
    private Collection<String> scopePaths(User me) {
        if (permissionChecker.isGlobalAdmin(me.getId())) {
            return null;
        }
        Set<String> myPaths = managedPaths(me);
        // Không quản lý đơn vị nào -> trả tập rỗng chứ KHÔNG trả null, nếu không sẽ vô tình
        // mở phạm vi ra cả công ty.
        return myPaths.isEmpty() ? List.of("__none__") : List.copyOf(myPaths);
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }

    private Organization organizationOf(UUID userId) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        if (assignments.isEmpty()) {
            throw new ForbiddenException("Bạn không thuộc tổ chức nào.");
        }
        return assignments.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization();
    }
}
