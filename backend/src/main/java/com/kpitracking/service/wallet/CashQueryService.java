package com.kpitracking.service.wallet;

import com.kpitracking.dto.request.wallet.WalletConfigRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.wallet.CashTransactionResponse;
import com.kpitracking.dto.response.wallet.CashWalletResponse;
import com.kpitracking.dto.response.wallet.CashWalletSummaryResponse;
import com.kpitracking.dto.response.wallet.WalletConfigResponse;
import com.kpitracking.entity.CashTransaction;
import com.kpitracking.entity.CashWallet;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.User;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.CashTransactionRepository;
import com.kpitracking.repository.CashWalletRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.SepayWebhookEventRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.reward.RewardContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Đọc ví tiền, lịch sử bút toán và cấu hình. Tách khỏi
 * {@code CashWalletService} để lớp đó chỉ còn đúng một việc: ghi sổ cái.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CashQueryService {

    private final CashWalletRepository walletRepository;
    private final CashTransactionRepository transactionRepository;
    private final OrganizationRepository organizationRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final SepayWebhookEventRepository sepayEventRepository;
    private final PermissionChecker permissionChecker;
    private final RewardContext context;

    @Transactional(readOnly = true)
    public CashWalletResponse getMyWallet() {
        User me = context.getCurrentUser();
        UUID orgId = context.getOrgIdOf(me.getId());
        long rate = loadOrg(orgId).getPointExchangeRate();

        return walletRepository.findByOrganizationIdAndUserId(orgId, me.getId())
                .map(w -> toWalletResponse(w, rate))
                // Chưa có ví nghĩa là chưa từng phát sinh giao dịch — trả ví rỗng
                // thay vì 404, để màn hình hiện số 0 chứ không hiện lỗi.
                .orElseGet(() -> CashWalletResponse.builder()
                        .userId(me.getId())
                        .fullName(me.getFullName())
                        .email(me.getEmail())
                        .employeeCode(me.getEmployeeCode())
                        .avatarUrl(me.getAvatarUrl())
                        .balance(0L).lifetimeTopup(0L).lifetimeConverted(0L)
                        .pointExchangeRate(rate)
                        .convertiblePoints(0)
                        .build());
    }

    @Transactional(readOnly = true)
    public PageResponse<CashTransactionResponse> getMyTransactions(int page, int size) {
        User me = context.getCurrentUser();
        return toPage(transactionRepository.findByOrganizationIdAndUserIdOrderByCreatedAtDesc(
                context.getOrgIdOf(me.getId()), me.getId(), PageRequest.of(page, size)));
    }

    /** Tổng hợp toàn tổ chức cho dòng chỉ số ở đầu màn hình ví nhân sự. */
    @Transactional(readOnly = true)
    public CashWalletSummaryResponse getSummary() {
        UUID orgId = context.getCurrentOrgId();
        var totals = walletRepository.sumByOrg(orgId);

        return CashWalletSummaryResponse.builder()
                .walletCount(totals == null ? 0L : totals.getWalletCount())
                .totalBalance(totals == null ? 0L : totals.getTotalBalance())
                .totalTopup(totals == null ? 0L : totals.getTotalTopup())
                .totalConverted(totals == null ? 0L : totals.getTotalConverted())
                .inconsistentCount((long) walletRepository.findInconsistentWalletIds(orgId).size())
                .build();
    }

    /**
     * @param onlyInconsistent chỉ lấy ví có số dư lệch sổ cái. Con số cảnh báo ở
     *                         màn hình đối soát chỉ nói CÓ BAO NHIÊU ví lệch; đây
     *                         là đường duy nhất để xem chúng là ví nào.
     */
    @Transactional(readOnly = true)
    public PageResponse<CashWalletResponse> searchWallets(
            String keyword, UUID orgUnitId, boolean onlyInconsistent, int page, int size) {
        UUID orgId = context.getCurrentOrgId();
        long rate = loadOrg(orgId).getPointExchangeRate();
        var pageable = PageRequest.of(page, size);

        Page<CashWallet> result;
        if (onlyInconsistent) {
            // Ví lệch sổ là lỗi dữ liệu, không phải kết quả tìm kiếm — cố ý bỏ qua
            // cả từ khoá lẫn đơn vị để không ai lọc mất một ví đang hỏng.
            List<UUID> ids = walletRepository.findInconsistentWalletIds(orgId);
            result = ids.isEmpty() ? Page.empty(pageable) : walletRepository.findByIdIn(ids, pageable);
        } else {
            result = walletRepository.searchByOrg(
                    orgId,
                    (keyword == null || keyword.isBlank()) ? null : keyword.trim(),
                    resolveUnitPath(orgUnitId),
                    pageable);
        }

        return PageResponse.<CashWalletResponse>builder()
                .content(result.getContent().stream().map(w -> toWalletResponse(w, rate)).toList())
                .page(result.getNumber())
                .size(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .last(result.isLast())
                .build();
    }

    @Transactional(readOnly = true)
    public PageResponse<CashTransactionResponse> getUserTransactions(UUID userId, int page, int size) {
        assertCanViewOthers(userId);
        return toPage(transactionRepository.findByOrganizationIdAndUserIdOrderByCreatedAtDesc(
                context.getOrgIdOf(userId), userId, PageRequest.of(page, size)));
    }

    @Transactional(readOnly = true)
    public WalletConfigResponse getConfig() {
        return toConfigResponse(loadOrg(context.getCurrentOrgId()));
    }

    @Transactional
    public WalletConfigResponse updateConfig(WalletConfigRequest request) {
        Organization org = loadOrg(context.getCurrentOrgId());

        if (request.getTopupMaxAmount() < request.getTopupMinAmount()) {
            throw new BusinessException("Số tiền nạp tối đa phải lớn hơn hoặc bằng số tiền tối thiểu.");
        }

        // Tỉ giá cũ vẫn đúng với lịch sử: mỗi bút toán quy đổi đã chụp lại
        // rate_snapshot của chính nó, nên đổi ở đây không làm sai số liệu cũ.
        org.setPointExchangeRate(request.getPointExchangeRate());
        org.setTopupMinAmount(request.getTopupMinAmount());
        org.setTopupMaxAmount(request.getTopupMaxAmount());
        org.setTopupExpireMinutes(request.getTopupExpireMinutes());
        org.setSepayAccountNumber(trimToNull(request.getSepayAccountNumber()));
        org.setSepayBankCode(trimToNull(request.getSepayBankCode()));
        org.setSepayAccountHolder(trimToNull(request.getSepayAccountHolder()));

        Organization saved = organizationRepository.save(org);

        // Gán lại những webhook cũ về đúng số tài khoản vừa khai. Webhook thường về
        // TRƯỚC khi ai đó kịp điền cấu hình — SePay bắn mọi biến động số dư của tài
        // khoản đã liên kết bên đó, không chờ KeyGo — nên không có bước này thì đúng
        // nhóm giao dịch đầu tiên của hệ thống sẽ kẹt vĩnh viễn ở trạng thái chưa
        // xác định tổ chức và không ghi có cho ai được.
        String account = SepayAccountMatch.normalize(saved.getSepayAccountNumber());
        if (account != null) {
            int attached = sepayEventRepository.attachOrganizationByAccount(saved.getId(), account);
            if (attached > 0) {
                log.info("Gán {} sự kiện SePay cũ của tài khoản {} về tổ chức {}",
                        attached, saved.getSepayAccountNumber(), saved.getId());
            }
        }

        return toConfigResponse(saved);
    }

    /**
     * Xem ví người khác phải có {@code WALLET:VIEW} TẠI ĐƠN VỊ của người đó —
     * quyền toàn cục không đủ, nếu không một trưởng phòng sẽ xem được ví tiền của
     * cả công ty.
     */
    private void assertCanViewOthers(UUID targetUserId) {
        User me = context.getCurrentUser();
        if (me.getId().equals(targetUserId)) return;
        UUID targetUnitId = context.getPrimaryOrgUnit(targetUserId).getId();
        if (!permissionChecker.hasPermissionInOrgUnit(me.getId(), "WALLET:VIEW", targetUnitId)) {
            throw new ForbiddenException("Bạn không có quyền xem ví tiền của nhân viên này.");
        }
    }

    /**
     * Đổi id đơn vị thành tiền tố {@code path} để truy vấn bao được cả cây con.
     * Đơn vị không tồn tại thì coi như không lọc, thay vì ném lỗi: bộ lọc trên
     * giao diện không đáng để làm hỏng cả trang.
     */
    private String resolveUnitPath(UUID orgUnitId) {
        if (orgUnitId == null) return null;
        return orgUnitRepository.findById(orgUnitId).map(OrgUnit::getPath).orElse(null);
    }

    private Organization loadOrg(UUID orgId) {
        return organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));
    }

    private CashWalletResponse toWalletResponse(CashWallet w, long rate) {
        long balance = w.getBalance() == null ? 0L : w.getBalance();
        return CashWalletResponse.builder()
                .id(w.getId())
                .userId(w.getUser().getId())
                .fullName(w.getUser().getFullName())
                .email(w.getUser().getEmail())
                .employeeCode(w.getUser().getEmployeeCode())
                .avatarUrl(w.getUser().getAvatarUrl())
                .balance(balance)
                .lifetimeTopup(w.getLifetimeTopup())
                .lifetimeConverted(w.getLifetimeConverted())
                .pointExchangeRate(rate)
                .convertiblePoints((int) Math.min(balance / rate, Integer.MAX_VALUE))
                .build();
    }

    private WalletConfigResponse toConfigResponse(Organization org) {
        boolean bankOk = org.getSepayAccountNumber() != null && !org.getSepayAccountNumber().isBlank()
                && org.getSepayBankCode() != null && !org.getSepayBankCode().isBlank();
        return WalletConfigResponse.builder()
                .enableCashWallet(org.getEnableCashWallet())
                .pointExchangeRate(org.getPointExchangeRate())
                .topupMinAmount(org.getTopupMinAmount())
                .topupMaxAmount(org.getTopupMaxAmount())
                .topupExpireMinutes(org.getTopupExpireMinutes())
                .sepayAccountNumber(org.getSepayAccountNumber())
                .sepayBankCode(org.getSepayBankCode())
                .sepayAccountHolder(org.getSepayAccountHolder())
                .bankConfigured(bankOk)
                .lastWebhookAt(sepayEventRepository.findLastReceivedAt(org.getId()))
                .build();
    }

    private PageResponse<CashTransactionResponse> toPage(Page<CashTransaction> page) {
        return PageResponse.<CashTransactionResponse>builder()
                .content(page.getContent().stream().map(CashQueryService::toTransactionResponse).toList())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }

    static CashTransactionResponse toTransactionResponse(CashTransaction t) {
        return CashTransactionResponse.builder()
                .id(t.getId())
                .amount(t.getAmount())
                .type(t.getType())
                .sourceType(t.getSourceType())
                .balanceAfter(t.getBalanceAfter())
                .pointsGranted(t.getPointsGranted())
                .rateSnapshot(t.getRateSnapshot())
                .note(t.getNote())
                .actorUserId(t.getActor() != null ? t.getActor().getId() : null)
                .actorName(t.getActor() != null ? t.getActor().getFullName() : null)
                .createdAt(t.getCreatedAt())
                .build();
    }

    private String trimToNull(String v) {
        return (v == null || v.isBlank()) ? null : v.trim();
    }
}
