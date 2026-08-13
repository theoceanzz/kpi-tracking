package com.kpitracking.service.reward;

import com.kpitracking.dto.request.reward.CreateRewardGrantRequest;
import com.kpitracking.dto.request.reward.GrantDecisionRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.reward.RewardGrantResponse;
import com.kpitracking.dto.response.reward.RevokePreviewResponse;
import com.kpitracking.entity.*;
import com.kpitracking.enums.RewardApprovalMode;
import com.kpitracking.enums.RewardGrantStatus;
import com.kpitracking.enums.RewardSourceType;
import com.kpitracking.enums.RewardTransactionType;
import com.kpitracking.enums.UserStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.*;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.RewardWalletService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Thưởng thủ công: sếp tự chọn người, nhập điểm và lý do.
 *
 * <h2>Hạn mức và duyệt</h2>
 * Trong hạn mức ⇒ duyệt tự động, phát điểm ngay. Vượt hạn mức hoặc vượt mức tối đa
 * mỗi lần ⇒ chờ người có {@code REWARD:APPROVE}. Không có hạn mức cũng rơi vào nhánh
 * chờ duyệt: "chưa được cấp hạn mức" KHÔNG có nghĩa là "không giới hạn" (fail closed).
 *
 * <h2>Vì sao không có cột đếm hạn mức đã dùng</h2>
 * Hạn mức đã dùng tính bằng tổng các đề nghị đang chờ duyệt và đã duyệt. Một cột đếm
 * sẽ phải hoàn lại ở ba đường (từ chối, huỷ, thu hồi); cách suy ra thì ba trạng thái
 * đó tự rơi khỏi tổng.
 *
 * <h2>Chống đua ghi hạn mức</h2>
 * Toàn bộ việc kiểm hạn mức nằm sau {@code SELECT ... FOR UPDATE} trên dòng ngân sách.
 * Vì mỗi người tại một thời điểm chỉ có tối đa một ngân sách (exclusion constraint ở DB),
 * khoá này tuần tự hoá mọi đề nghị của cùng một người: request thứ hai chờ ở đó và khi
 * chạy sẽ nhìn thấy đề nghị mà request thứ nhất vừa ghi.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RewardGrantService {

    /** Trần người nhận mỗi lần, chặn một transaction chạy hoang vì thao tác nhầm. */
    private static final int MAX_RECIPIENTS = 200;

    private final RewardGrantRepository grantRepository;
    private final RewardGrantItemRepository grantItemRepository;
    private final RewardBudgetRepository budgetRepository;
    private final RewardBudgetService budgetService;
    private final RewardWalletService walletService;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final PermissionChecker permissionChecker;
    private final RewardContext context;

    // ────────────────────────────── TẠO ──────────────────────────────

    @Transactional
    public RewardGrantResponse createGrant(CreateRewardGrantRequest request) {
        User grantor = context.getCurrentUser();
        UUID orgId = context.getOrgIdOf(grantor.getId());
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));

        Map<UUID, Integer> pointsByUser = validateRecipients(request, grantor);
        int total = pointsByUser.values().stream().mapToInt(Integer::intValue).sum();
        int maxPerPerson = pointsByUser.values().stream().mapToInt(Integer::intValue).max().orElse(0);

        // Khoá ngân sách TRƯỚC khi tính — đây là điểm tuần tự hoá đóng race condition.
        Optional<RewardBudget> budgetOpt =
                budgetRepository.findActiveForUpdate(orgId, grantor.getId(), RewardBudgetService.today());

        // Người có REWARD:APPROVE_OWN (cấp cao nhất) được duyệt thẳng, bỏ qua hạn mức.
        // Họ là người ĐẶT hạn mức cho người khác nên thường không tự cấp cho mình; nếu
        // bắt họ chờ duyệt thì đề nghị sẽ kẹt vĩnh viễn vì không còn ai cấp trên.
        // Cùng cách làm với KPI:APPROVE_OWN ở KpiCriteriaService.
        boolean canApproveOwn = permissionChecker.hasPermission(grantor.getId(), "REWARD:APPROVE_OWN");

        String withinBudgetReason =
                decideApprovalReason(budgetOpt, total, maxPerPerson, orgId, grantor.getId());
        String approvalReason = canApproveOwn ? null : withinBudgetReason;
        boolean autoApproved = approvalReason == null;

        // Chỉ tính vào hạn mức khi đề nghị THỰC SỰ nằm trong hạn mức. Người có
        // APPROVE_OWN vượt hạn mức thì ghi budget = null: cộng vào hạn mức sẽ đẩy
        // "đã dùng" vượt "được cấp" và làm báo cáo hạn mức thành vô nghĩa.
        RewardBudget chargedBudget = withinBudgetReason == null ? budgetOpt.orElse(null) : null;

        RewardGrant grant = RewardGrant.builder()
                .organization(org)
                .orgUnit(context.getPrimaryOrgUnit(grantor.getId()))
                .grantor(grantor)
                .budget(chargedBudget)
                .pointsPerRecipient(request.getPointsPerRecipient())
                .totalPoints(total)
                .reason(request.getReason())
                .status(autoApproved ? RewardGrantStatus.APPROVED : RewardGrantStatus.PENDING_APPROVAL)
                .approvalMode(autoApproved ? RewardApprovalMode.AUTO : RewardApprovalMode.MANUAL)
                .approvalReason(approvalReason)
                .approvedAt(autoApproved ? Instant.now() : null)
                .build();
        grantRepository.save(grant);

        List<RewardGrantItem> items = pointsByUser.entrySet().stream()
                .map(e -> RewardGrantItem.builder()
                        .grant(grant)
                        .user(userRepository.getReferenceById(e.getKey()))
                        .points(e.getValue())
                        .build())
                .collect(Collectors.toList());
        grantItemRepository.saveAll(items);
        grant.setItems(items);

        if (autoApproved) {
            issuePoints(grant, items, grantor);
        }

        RewardGrantResponse response = toResponse(grant, items);
        response.setRequiresApproval(!autoApproved);
        return response;
    }

    /**
     * Vì sao đề nghị phải qua duyệt, hoặc {@code null} nếu được duyệt tự động.
     *
     * <p>Trả về chuỗi mô tả thay vì boolean để người trao đọc được LÝ DO cụ thể kèm con số
     * — "vượt hạn mức" mà không nói còn bao nhiêu thì họ không biết phải làm gì tiếp.
     */
    private String decideApprovalReason(Optional<RewardBudget> budgetOpt, int total, int maxPerPerson,
                                        UUID orgId, UUID grantorId) {
        if (budgetOpt.isEmpty()) {
            // Phân biệt "chưa từng được cấp" với "có nhưng đã hết hiệu lực". Gộp thành
            // một câu khiến người dùng nhìn thấy hạn mức của mình trong danh sách mà
            // hệ thống lại bảo chưa có — tưởng là lỗi.
            var all = budgetRepository.findByOrganizationIdAndGrantorIdOrderByPeriodStartDesc(orgId, grantorId);
            if (!all.isEmpty()) {
                LocalDate today = RewardBudgetService.today();
                RewardBudget nearest = all.get(0);
                boolean notStarted = nearest.getPeriodStart().isAfter(today);
                return notStarted
                        ? "Hạn mức của bạn chưa tới ngày hiệu lực (bắt đầu từ "
                          + fmt(nearest.getPeriodStart()) + ") nên đề nghị cần cấp trên duyệt."
                        : "Hạn mức của bạn đã hết hiệu lực (đến " + fmt(nearest.getPeriodEnd())
                          + ") nên đề nghị cần cấp trên duyệt. Hãy đề nghị cấp hạn mức cho kỳ hiện tại.";
            }
            return "Bạn chưa được cấp hạn mức điểm thưởng nên đề nghị cần cấp trên duyệt.";
        }
        RewardBudget budget = budgetOpt.get();

        if (budget.getMaxPerAward() != null && maxPerPerson > budget.getMaxPerAward()) {
            return "Vượt mức tối đa mỗi lần thưởng (" + maxPerPerson
                    + " điểm/người, tối đa cho phép " + budget.getMaxPerAward() + " điểm).";
        }

        int used = grantRepository.sumUsedPointsByBudgetId(budget.getId());
        int remaining = budget.getAllocatedPoints() - used;
        if (total > remaining) {
            return "Vượt hạn mức: đã dùng " + used + "/" + budget.getAllocatedPoints()
                    + " điểm, còn " + remaining + " điểm nhưng đề nghị này cần " + total + " điểm.";
        }
        return null;
    }

    private static String fmt(LocalDate d) {
        return d.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"));
    }

    /**
     * Kiểm danh sách người nhận và trả về map (người → điểm) đã khử trùng.
     *
     * <p>{@code UNIQUE (grant_id, user_id)} ở DB chỉ là lưới cuối; để lỗi rơi xuống đó
     * thì người dùng nhận một thông báo vi phạm ràng buộc chẳng nói lên điều gì.
     */
    private Map<UUID, Integer> validateRecipients(CreateRewardGrantRequest request, User grantor) {
        List<CreateRewardGrantRequest.Recipient> recipients = request.getRecipients();

        if (recipients.size() > MAX_RECIPIENTS) {
            throw new BusinessException("Mỗi lần thưởng tối đa " + MAX_RECIPIENTS
                    + " nhân viên. Danh sách hiện có " + recipients.size() + " người.");
        }

        // Trùng người nhận: gom lại rồi báo bằng HỌ TÊN, không phải UUID.
        List<UUID> ids = recipients.stream().map(CreateRewardGrantRequest.Recipient::getUserId).toList();
        List<UUID> duplicated = ids.stream()
                .collect(Collectors.groupingBy(id -> id, Collectors.counting()))
                .entrySet().stream()
                .filter(e -> e.getValue() > 1)
                .map(Map.Entry::getKey)
                .toList();
        if (!duplicated.isEmpty()) {
            String names = userRepository.findAllById(duplicated).stream()
                    .map(User::getFullName)
                    .collect(Collectors.joining(", "));
            throw new BusinessException("Danh sách có nhân viên bị trùng: " + names);
        }

        List<User> users = userRepository.findAllById(ids);
        if (users.size() != ids.size()) {
            throw new BusinessException("Có nhân viên trong danh sách không còn tồn tại trong hệ thống.");
        }
        Map<UUID, User> userById = users.stream().collect(Collectors.toMap(User::getId, u -> u));

        for (User u : users) {
            if (u.getStatus() != UserStatus.ACTIVE) {
                throw new BusinessException("Nhân viên " + u.getFullName() + " không còn hoạt động.");
            }
        }

        assertWithinGrantScope(grantor, userById);

        Map<UUID, Integer> result = new LinkedHashMap<>();
        for (CreateRewardGrantRequest.Recipient r : recipients) {
            result.put(r.getUserId(), r.getPoints());
        }
        return result;
    }

    /**
     * Người trao chỉ được thưởng cho nhân sự trong phạm vi quản lý của mình.
     *
     * <p>Nạp path các đơn vị gốc của người trao MỘT LẦN rồi so tiền tố, thay vì gọi
     * {@code hasPermissionInOrgUnit} cho từng người nhận — cách kia nạp lại toàn bộ
     * phân quyền của người trao đúng N lần.
     */
    private void assertWithinGrantScope(User grantor, Map<UUID, User> recipients) {
        if (permissionChecker.isGlobalAdmin(grantor.getId())) return;

        List<UUID> baseUnitIds = permissionChecker.getOrgUnitsWithPermission(grantor.getId(), "REWARD:GRANT");
        if (baseUnitIds.isEmpty()) {
            throw new ForbiddenException("Bạn không có quyền thưởng điểm cho nhân viên nào.");
        }
        List<String> basePaths = orgUnitRepository.findAllById(baseUnitIds).stream()
                .map(OrgUnit::getPath)
                .filter(Objects::nonNull)
                .toList();

        for (Map.Entry<UUID, User> entry : recipients.entrySet()) {
            boolean inScope = userRoleOrgUnitRepository.findByUserId(entry.getKey()).stream()
                    .map(UserRoleOrgUnit::getOrgUnit)
                    .filter(u -> u != null && u.getPath() != null)
                    .anyMatch(u -> basePaths.stream().anyMatch(p -> u.getPath().startsWith(p)));
            if (!inScope) {
                throw new ForbiddenException(
                        "Bạn không có quyền thưởng cho nhân viên " + entry.getValue().getFullName() + ".");
            }
        }
    }

    // ──────────────────────────── QUYẾT ĐỊNH ────────────────────────────

    @Transactional
    public RewardGrantResponse approve(UUID grantId, GrantDecisionRequest request) {
        RewardGrant grant = loadPending(grantId);
        User approver = context.getCurrentUser();
        assertCanApprove(grant, approver);

        grant.setStatus(RewardGrantStatus.APPROVED);
        // Khoản vượt hạn mức là ngoại lệ do cấp trên cho, KHÔNG tính vào hạn mức cá nhân
        // của người trao — nên budget vẫn để null.
        grant.setApprovalMode(RewardApprovalMode.MANUAL);
        grant.setApprover(approver);
        grant.setApprovedAt(Instant.now());
        grant.setDecisionNote(request != null ? request.getNote() : null);
        grantRepository.save(grant);

        List<RewardGrantItem> items = grantItemRepository.findByGrantId(grantId);
        issuePoints(grant, items, approver);

        return toResponse(grant, items);
    }

    @Transactional
    public RewardGrantResponse reject(UUID grantId, GrantDecisionRequest request) {
        RewardGrant grant = loadPending(grantId);
        User approver = context.getCurrentUser();
        assertCanApprove(grant, approver);

        grant.setStatus(RewardGrantStatus.REJECTED);
        grant.setApprover(approver);
        grant.setApprovedAt(Instant.now());
        grant.setDecisionNote(request != null ? request.getNote() : null);
        grantRepository.save(grant);

        // Không cần trả lại hạn mức: đề nghị REJECTED tự rơi khỏi tổng đang tính.
        return toResponse(grant, grantItemRepository.findByGrantId(grantId));
    }

    @Transactional
    public RewardGrantResponse cancel(UUID grantId) {
        RewardGrant grant = loadPending(grantId);
        User me = context.getCurrentUser();
        if (!grant.getGrantor().getId().equals(me.getId())) {
            throw new ForbiddenException("Chỉ người tạo đề nghị mới huỷ được đề nghị này.");
        }
        grant.setStatus(RewardGrantStatus.CANCELLED);
        grantRepository.save(grant);
        return toResponse(grant, grantItemRepository.findByGrantId(grantId));
    }

    /**
     * Xem trước hậu quả thu hồi: ai bị trừ bao nhiêu, số dư sau đó còn bao nhiêu, ai âm.
     *
     * <p>Tách thành một lời gọi riêng thay vì dựa vào ngoại lệ ở lần thử đầu: thao tác
     * thu hồi ghi thẳng vào sổ cái và không hoàn tác được, nên người quản trị phải nhìn
     * thấy con số cụ thể của từng người TRƯỚC khi bấm, chứ không phải một câu cảnh báo
     * chung rồi tự đoán.
     */
    @Transactional(readOnly = true)
    public RevokePreviewResponse previewRevoke(UUID grantId) {
        RewardGrant grant = grantRepository.findById(grantId)
                .orElseThrow(() -> new ResourceNotFoundException("Đề nghị thưởng", "id", grantId));
        UUID orgId = grant.getOrganization().getId();

        List<RevokePreviewResponse.Item> items = grantItemRepository.findByGrantId(grantId).stream()
                .map(it -> {
                    Integer balance = walletService
                            .getWalletOrEmpty(orgId, it.getUser().getId()).getBalance();
                    int current = balance == null ? 0 : balance;
                    int after = current - it.getPoints();
                    return RevokePreviewResponse.Item.builder()
                            .userId(it.getUser().getId())
                            .fullName(it.getUser().getFullName())
                            .email(it.getUser().getEmail())
                            .points(it.getPoints())
                            .currentBalance(current)
                            .balanceAfter(after)
                            .goesNegative(after < 0)
                            .build();
                })
                .toList();

        return RevokePreviewResponse.builder()
                .grantId(grantId)
                .totalPoints(grant.getTotalPoints())
                .anyGoesNegative(items.stream().anyMatch(RevokePreviewResponse.Item::getGoesNegative))
                .items(items)
                .build();
    }

    /**
     * Thu hồi một đề nghị ĐÃ PHÁT: ghi bút toán âm bù trừ cho từng người nhận.
     *
     * <p>Mặc định CHẶN nếu có người đã tiêu hết số điểm đó, kèm tên cụ thể. Giao diện gọi
     * {@link #previewRevoke} trước và chỉ đặt {@code force} sau khi người quản trị đã
     * nhìn thấy danh sách — cờ này là sự đồng ý có hiểu biết, không phải để bỏ qua kiểm tra.
     *
     * <p>Khi force, số dư được phép xuống ÂM: kẹp về 0 sẽ phá bất biến
     * {@code balanceAfter = trước + amount} của sổ cái và làm sai tổng đã nhận.
     */
    @Transactional
    public RewardGrantResponse revoke(UUID grantId, GrantDecisionRequest request) {
        RewardGrant grant = grantRepository.findById(grantId)
                .orElseThrow(() -> new ResourceNotFoundException("Đề nghị thưởng", "id", grantId));
        if (grant.getStatus() != RewardGrantStatus.APPROVED) {
            throw new BusinessException("Chỉ thu hồi được đề nghị đã duyệt và đã phát điểm.");
        }
        User actor = context.getCurrentUser();
        assertCanApprove(grant, actor);

        List<RewardGrantItem> items = grantItemRepository.findByGrantId(grantId);
        boolean force = request != null && Boolean.TRUE.equals(request.getForce());

        if (!force) {
            UUID orgId = grant.getOrganization().getId();
            String shortOf = items.stream()
                    .filter(it -> {
                        Integer balance = walletService
                                .getWalletOrEmpty(orgId, it.getUser().getId()).getBalance();
                        return balance == null || balance < it.getPoints();
                    })
                    .map(it -> it.getUser().getFullName())
                    .collect(Collectors.joining(", "));
            if (!shortOf.isEmpty()) {
                throw new BusinessException("Không thể thu hồi vì các nhân viên sau đã tiêu số điểm này: "
                        + shortOf + ". Thu hồi vẫn được nhưng số dư của họ sẽ âm — hãy xác nhận lại để tiếp tục.");
            }
        }

        for (RewardGrantItem item : items) {
            walletService.applyTransaction(RewardWalletService.LedgerEntry.builder()
                    .organizationId(grant.getOrganization().getId())
                    .userId(item.getUser().getId())
                    .amount(-item.getPoints())
                    .type(RewardTransactionType.ADJUST)
                    .sourceType(RewardSourceType.MANUAL_GRANT)
                    .sourceRefId(item.getId())
                    .reversalOfTransactionId(item.getTransactionId())
                    .idempotencyKey(RewardWalletService.key("grant_revoke", grantId, item.getUser().getId()))
                    .note("Thu hồi thưởng: " + grant.getReason())
                    .actor(actor)
                    .build());
        }

        grant.setStatus(RewardGrantStatus.REVOKED);
        grant.setDecisionNote(request != null ? request.getNote() : null);
        grantRepository.save(grant);
        // Hạn mức tự trả lại: REVOKED rơi khỏi tổng đang tính.
        return toResponse(grant, items);
    }

    /** Phát điểm cho từng người nhận, mỗi người một bút toán có khoá chống ghi trùng. */
    private void issuePoints(RewardGrant grant, List<RewardGrantItem> items, User actor) {
        for (RewardGrantItem item : items) {
            RewardTransaction tx = walletService.applyTransaction(RewardWalletService.LedgerEntry.builder()
                    .organizationId(grant.getOrganization().getId())
                    .userId(item.getUser().getId())
                    .amount(item.getPoints())
                    .type(RewardTransactionType.EARN)
                    .sourceType(RewardSourceType.MANUAL_GRANT)
                    .sourceRefId(item.getId())
                    .idempotencyKey(RewardWalletService.key("grant", grant.getId(), item.getUser().getId()))
                    .note(grant.getReason())
                    .actor(actor)
                    .build());
            item.setTransactionId(tx.getId());
        }
        grantItemRepository.saveAll(items);
    }

    private RewardGrant loadPending(UUID grantId) {
        RewardGrant grant = grantRepository.findById(grantId)
                .orElseThrow(() -> new ResourceNotFoundException("Đề nghị thưởng", "id", grantId));
        if (grant.getStatus() != RewardGrantStatus.PENDING_APPROVAL) {
            throw new BusinessException("Đề nghị này không còn ở trạng thái chờ duyệt.");
        }
        return grant;
    }

    /**
     * Kiểm quyền duyệt theo ĐƠN VỊ của đề nghị, không chỉ theo mã quyền toàn cục —
     * một trưởng phòng có {@code REWARD:APPROVE} ở phòng mình không nên duyệt được
     * đề nghị của phòng khác.
     */
    private void assertCanApprove(RewardGrant grant, User approver) {
        if (!permissionChecker.hasPermissionInOrgUnit(
                approver.getId(), "REWARD:APPROVE", grant.getOrgUnit().getId())) {
            throw new ForbiddenException("Bạn không có quyền duyệt thưởng cho đơn vị này.");
        }
        // Tự duyệt đề nghị của chính mình sẽ vô hiệu hoá cơ chế hạn mức: ai vượt hạn
        // mức chỉ cần bấm duyệt là xong. Nhưng luật này KHÔNG áp cho người có
        // REWARD:APPROVE_OWN — họ là cấp cao nhất, là người đặt hạn mức cho người
        // khác, và không còn ai ở trên để duyệt hộ. Chặn họ nghĩa là đề nghị kẹt vĩnh viễn.
        if (grant.getGrantor().getId().equals(approver.getId())
                && !permissionChecker.hasPermission(approver.getId(), "REWARD:APPROVE_OWN")
                && !permissionChecker.isGlobalAdmin(approver.getId())) {
            throw new ForbiddenException("Bạn không thể tự duyệt đề nghị thưởng của chính mình.");
        }
    }

    // ──────────────────────────── ĐỌC ────────────────────────────

    @Transactional(readOnly = true)
    public PageResponse<RewardGrantResponse> search(RewardGrantStatus status, UUID grantorId,
                                                    int page, int size) {
        UUID orgId = context.getCurrentOrgId();
        Page<RewardGrant> result = grantRepository.search(
                orgId, status, grantorId, null, PageRequest.of(page, size));

        Map<UUID, List<RewardGrantItem>> itemsByGrant = grantItemRepository
                .findByGrantIdIn(result.getContent().stream().map(RewardGrant::getId).toList())
                .stream().collect(Collectors.groupingBy(i -> i.getGrant().getId()));

        List<RewardGrantResponse> content = result.getContent().stream()
                .map(g -> toResponse(g, itemsByGrant.getOrDefault(g.getId(), List.of())))
                .toList();

        return PageResponse.<RewardGrantResponse>builder()
                .content(content)
                .page(result.getNumber())
                .size(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .last(result.isLast())
                .build();
    }

    @Transactional(readOnly = true)
    public RewardGrantResponse getById(UUID grantId) {
        RewardGrant grant = grantRepository.findById(grantId)
                .orElseThrow(() -> new ResourceNotFoundException("Đề nghị thưởng", "id", grantId));
        return toResponse(grant, grantItemRepository.findByGrantId(grantId));
    }

    private RewardGrantResponse toResponse(RewardGrant grant, List<RewardGrantItem> items) {
        return RewardGrantResponse.builder()
                .id(grant.getId())
                .orgUnitId(grant.getOrgUnit() != null ? grant.getOrgUnit().getId() : null)
                .orgUnitName(grant.getOrgUnit() != null ? grant.getOrgUnit().getName() : null)
                .grantorUserId(grant.getGrantor().getId())
                .grantorName(grant.getGrantor().getFullName())
                .totalPoints(grant.getTotalPoints())
                .pointsPerRecipient(grant.getPointsPerRecipient())
                .reason(grant.getReason())
                .status(grant.getStatus())
                .approvalMode(grant.getApprovalMode())
                .approvalReason(grant.getApprovalReason())
                .approverUserId(grant.getApprover() != null ? grant.getApprover().getId() : null)
                .approverName(grant.getApprover() != null ? grant.getApprover().getFullName() : null)
                .approvedAt(grant.getApprovedAt())
                .decisionNote(grant.getDecisionNote())
                .createdAt(grant.getCreatedAt())
                .recipients(items.stream().map(i -> RewardGrantResponse.Recipient.builder()
                        .userId(i.getUser().getId())
                        .fullName(i.getUser().getFullName())
                        .email(i.getUser().getEmail())
                        .employeeCode(i.getUser().getEmployeeCode())
                        .avatarUrl(i.getUser().getAvatarUrl())
                        .points(i.getPoints())
                        .transactionId(i.getTransactionId())
                        .build()).toList())
                .build();
    }
}
