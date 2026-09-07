package com.kpitracking.service.wallet;

import com.kpitracking.dto.request.wallet.ConvertToPointsRequest;
import com.kpitracking.dto.response.wallet.ConversionQuoteResponse;
import com.kpitracking.entity.CashTransaction;
import com.kpitracking.entity.CashWallet;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.User;
import com.kpitracking.enums.CashSourceType;
import com.kpitracking.enums.CashTransactionType;
import com.kpitracking.enums.RewardSourceType;
import com.kpitracking.enums.RewardTransactionType;
import com.kpitracking.event.WalletEvents;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.service.CashWalletService;
import com.kpitracking.service.RewardWalletService;
import com.kpitracking.service.reward.RewardContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;
import java.util.UUID;

/**
 * Quy đổi tiền trong ví sang điểm thưởng — cây cầu DUY NHẤT giữa hai module.
 *
 * <p>Cắm vào đúng những chỗ mà module điểm thưởng đã chừa sẵn từ đầu:
 * {@code RewardSourceType.EXTERNAL}, {@code externalSystem = "CASH_WALLET"},
 * {@code externalRef} là id bút toán tiền, và khoá dạng
 * {@code ext:{system}:{ref}}. Không sửa một dòng nào của module điểm.
 *
 * <p><b>Thứ tự khoá: ví TIỀN trước, ví ĐIỂM sau.</b> Đây là bất biến của toàn hệ
 * thống, không phải chi tiết cục bộ — một luồng ngược trong tương lai mà khoá
 * theo thứ tự đảo sẽ ôm chéo khoá với luồng này và treo cả hai tới timeout.
 *
 * <p>Người dùng nhập SỐ ĐIỂM muốn đổi chứ không nhập số tiền, nên
 * {@code cost = points × rate} luôn chia chẵn và không bao giờ phát sinh dư lẻ —
 * cả module không cần một chính sách làm tròn nào.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PointConversionService {

    private final CashWalletService cashWalletService;
    private final RewardWalletService rewardWalletService;
    private final OrganizationRepository organizationRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final RewardContext context;

    @Transactional(readOnly = true)
    public ConversionQuoteResponse quote(int points) {
        User me = context.getCurrentUser();
        UUID orgId = context.getOrgIdOf(me.getId());
        Organization org = loadOrg(orgId);

        long rate = org.getPointExchangeRate();
        CashWallet wallet = cashWalletService.getWalletOrEmpty(orgId, me.getId());
        long balance = wallet.getBalance() == null ? 0L : wallet.getBalance();
        long cost = (long) points * rate;

        return ConversionQuoteResponse.builder()
                .points(points)
                .rate(rate)
                .cost(cost)
                .balanceBefore(balance)
                .balanceAfter(balance - cost)
                .affordable(cost <= balance)
                .maxPoints(toIntSafe(balance / rate))
                .build();
    }

    @Transactional
    public ConversionQuoteResponse convert(ConvertToPointsRequest request) {
        User me = context.getCurrentUser();
        UUID orgId = context.getOrgIdOf(me.getId());
        Organization org = loadOrg(orgId);

        if (!Boolean.TRUE.equals(org.getEnableCashWallet())) {
            throw new BusinessException("Tổ chức của bạn chưa bật tính năng ví tiền.");
        }
        if (!Boolean.TRUE.equals(org.getEnableReward())) {
            throw new BusinessException("Tổ chức của bạn chưa bật tính năng điểm thưởng, "
                    + "nên chưa thể quy đổi tiền sang điểm.");
        }

        int points = request.getPoints();
        long rate = org.getPointExchangeRate();
        long cost = (long) points * rate;

        // Bước 1: trừ ví TIỀN. Ném BusinessException nếu không đủ số dư, và vì cả
        // hàm nằm trong một transaction nên khi đó không có gì được ghi ở cả hai ví.
        CashTransaction cashTx = cashWalletService.applyTransaction(
                CashWalletService.CashLedgerEntry.builder()
                        .organizationId(orgId)
                        .userId(me.getId())
                        .amount(-cost)
                        .type(CashTransactionType.CONVERT)
                        .sourceType(CashSourceType.CONVERSION)
                        .pointsGranted(points)
                        .rateSnapshot(rate)
                        .idempotencyKey(CashWalletService.key("convert", request.getRequestId()))
                        .note("Đổi " + points + " điểm ở tỉ giá "
                                + CashWalletService.formatVnd(rate) + "/điểm")
                        .actor(me)
                        .build());

        // Khoá chống ghi trùng chỉ gồm requestId, KHÔNG gồm số điểm — cố ý. Nếu nhét
        // số điểm vào khoá thì một lần gọi lại với số điểm khác sẽ tạo bút toán MỚI,
        // tức trừ tiền hai lần. Đổi lại phải tự kiểm: bản ghi vừa nhận về có đúng là
        // của yêu cầu này không, hay là kết quả cũ của một lần đổi khác cùng mã.
        if (!Objects.equals(cashTx.getPointsGranted(), points)
                || !Objects.equals(cashTx.getRateSnapshot(), rate)) {
            throw new BusinessException("Mã yêu cầu này đã được dùng cho một giao dịch quy đổi khác ("
                    + cashTx.getPointsGranted() + " điểm ở tỉ giá "
                    + CashWalletService.formatVnd(cashTx.getRateSnapshot())
                    + "/điểm). Vui lòng tải lại trang và thử lại.");
        }

        // Bước 2: cộng ví ĐIỂM. Khoá suy ra từ id bút toán tiền, nên khi gọi lại với
        // cùng requestId thì bước 1 trả về đúng bút toán cũ, id không đổi, khoá không
        // đổi, và bước này cũng thành no-op. Toàn bộ luồng an toàn khi retry.
        rewardWalletService.applyTransaction(RewardWalletService.LedgerEntry.builder()
                .organizationId(orgId)
                .userId(me.getId())
                .amount(points)
                .type(RewardTransactionType.EARN)
                .sourceType(RewardSourceType.EXTERNAL)
                .sourceRefId(cashTx.getId())
                .externalSystem("CASH_WALLET")
                .externalRef(cashTx.getId().toString())
                .idempotencyKey(RewardWalletService.key("ext", "CASH_WALLET", cashTx.getId()))
                .note("Quy đổi từ ví tiền: " + CashWalletService.formatVnd(cost)
                        + " ở tỉ giá " + CashWalletService.formatVnd(rate) + "/điểm")
                .actor(me)
                .build());

        eventPublisher.publishEvent(new WalletEvents.CashConvertedEvent(this, me, cost, points, rate));
        log.info("User {} đổi {} đồng lấy {} điểm (tỉ giá {})", me.getId(), cost, points, rate);

        long balanceAfter = cashTx.getBalanceAfter();
        return ConversionQuoteResponse.builder()
                .points(points)
                .rate(rate)
                .cost(cost)
                .balanceBefore(balanceAfter + cost)
                .balanceAfter(balanceAfter)
                .affordable(true)
                .maxPoints(toIntSafe(balanceAfter / rate))
                .build();
    }

    private Organization loadOrg(UUID orgId) {
        return organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));
    }

    private int toIntSafe(long v) {
        return (int) Math.min(v, Integer.MAX_VALUE);
    }
}
