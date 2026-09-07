package com.kpitracking.service;

import com.kpitracking.entity.Organization;
import com.kpitracking.entity.RewardTransaction;
import com.kpitracking.entity.RewardWallet;
import com.kpitracking.entity.User;
import com.kpitracking.enums.RewardSourceType;
import com.kpitracking.enums.RewardTransactionType;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.RewardTransactionRepository;
import com.kpitracking.repository.RewardWalletRepository;
import com.kpitracking.repository.UserRepository;
import lombok.Builder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Lõi sổ cái điểm thưởng — NƠI DUY NHẤT được phép ghi vào {@code reward_wallets}
 * và {@code reward_transactions}.
 *
 * <h2>Vì sao phải một cửa</h2>
 * Điểm là thứ giống tiền. Hai bất biến sau phải luôn đúng, và chỉ đúng nếu mọi
 * thay đổi đi qua {@link #applyTransaction}:
 * <pre>
 *   balance = SUM(reward_transactions.amount)
 *   balance = lifetimeEarned - lifetimeSpent - lifetimeExpired
 * </pre>
 * Bốn cột tổng của {@link RewardWallet} không có setter công khai, nên đây không
 * phải quy ước lỏng lẻo mà là ràng buộc ở mức cấu trúc.
 *
 * <h2>Công thức cập nhật theo loại giao dịch</h2>
 * <pre>
 * type              amount   balance   earned    spent     expired
 * EARN                +      +=amount  +=amount    -          -
 * SPEND               -      +=amount     -     +=|amount|    -
 * REFUND              +      +=amount     -     -=|amount|    -
 * ADJUST (dương)      +      +=amount  +=amount    -          -
 * ADJUST (âm)         -      +=amount  -=|amount|  -          -
 * EXPIRE              -      +=amount     -          -     +=|amount|
 * </pre>
 * Hai lựa chọn đáng chú ý:
 * <ul>
 *   <li>{@code REFUND} trừ ngược {@code spent} chứ không cộng {@code earned} — hoàn
 *       điểm do từ chối đổi quà không phải là "được nhận thêm". Nếu cộng vào
 *       {@code earned} thì người đặt rồi huỷ mười lần sẽ hiện đã nhận rất nhiều
 *       điểm trong khi chưa từng được thưởng đồng nào.</li>
 *   <li>{@code ADJUST} âm trừ ngược {@code earned} — thưởng bị thu hồi coi như khoản
 *       đó bị huỷ bỏ, không phải "đã nhận rồi tiêu đi". Giữ nguyên {@code earned} sẽ
 *       khiến bảng vinh danh đếm cả những khoản đã bị rút lại.</li>
 * </ul>
 *
 * <h2>Bảng đăng ký khoá chống ghi trùng</h2>
 * <pre>
 *   Phát thưởng thủ công       grant:{grantId}:{userId}
 *   Thu hồi thưởng thủ công    grant_revoke:{grantId}:{userId}
 *   Phát thưởng chương trình   run:{runId}:{userId}
 *   Thu hồi chương trình       run_revert:{runId}:{userId}
 *   Đổi quà - trừ điểm         redeem:{redemptionId}
 *   Đổi quà - hoàn điểm        redeem_refund:{redemptionId}
 *   Điều chỉnh tay             adjust:{requestId}      (requestId do client sinh)
 *   Nạp từ hệ thống ngoài      ext:{externalSystem}:{externalRef}
 * </pre>
 * Khoá phải suy ra được HOÀN TOÀN từ (loại nghiệp vụ, id bản ghi, người nhận).
 * Tuyệt đối không chèn timestamp hay số ngẫu nhiên sinh phía server: lần retry sẽ
 * sinh khoá khác và lớp bảo vệ thành vô nghĩa. Xem {@link #key(String, Object...)}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RewardWalletService {

    private final RewardWalletRepository walletRepository;
    private final RewardTransactionRepository transactionRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;

    /**
     * Mô tả một bút toán. Gom tham số vào đây để lời gọi đọc được, không phải mười đối số.
     *
     * @param amount có dấu — người gọi chịu trách nhiệm đặt đúng dấu theo {@code type}
     *               (EARN/REFUND dương, SPEND/EXPIRE âm, ADJUST tuỳ ý nghĩa)
     */
    @Builder
    public record LedgerEntry(
            UUID organizationId,
            UUID userId,
            int amount,
            RewardTransactionType type,
            RewardSourceType sourceType,
            UUID sourceRefId,
            UUID reversalOfTransactionId,
            String idempotencyKey,
            String note,
            User actor,
            String externalSystem,
            String externalRef
    ) {}

    /**
     * Ghép khoá chống ghi trùng theo đúng bảng đăng ký ở javadoc của class.
     * Dùng hàm này thay vì nối chuỗi tay để khoá luôn cùng một dạng.
     */
    public static String key(String prefix, Object... parts) {
        StringBuilder sb = new StringBuilder(prefix);
        for (Object p : parts) {
            sb.append(':').append(p);
        }
        return sb.toString();
    }

    /**
     * Ghi một bút toán và cập nhật ví. CỬA DUY NHẤT chạm vào điểm.
     *
     * <p>Chạy trong transaction của người gọi ({@code MANDATORY} về mặt ý nghĩa —
     * việc phát điểm phải nguyên tử cùng với việc đổi trạng thái nghiệp vụ; nếu tách
     * transaction riêng thì một lỗi ở bước sau sẽ để lại điểm đã phát mà đề nghị vẫn
     * đang chờ duyệt).
     *
     * <p><b>Chống ghi trùng hai lớp:</b>
     * <ol>
     *   <li>Tra {@code idempotencyKey} trước. Lớp này xử lý gần như toàn bộ trường hợp
     *       thực tế: người dùng bấm lại sau vài giây, client retry khi mạng chập chờn.
     *       Lần lặp là no-op, trả về đúng giao dịch cũ.</li>
     *   <li>Ràng buộc duy nhất ở DB. Chỉ bắt trường hợp hai request chạy song song
     *       khít nhau đến mức cả hai cùng vượt qua bước tra ở trên.
     *       <b>Lưu ý:</b> khi lớp này kích hoạt, PostgreSQL huỷ toàn bộ transaction —
     *       không thể bắt lỗi rồi trả về giao dịch cũ trong cùng transaction. Request
     *       đó sẽ nhận 409. Đây là hành vi ĐÚNG: không có gì bị ghi hai lần, và lần
     *       client thử lại sẽ đi vào lớp 1 và nhận kết quả bình thường.</li>
     * </ol>
     */
    @Transactional
    public RewardTransaction applyTransaction(LedgerEntry entry) {
        if (entry.idempotencyKey() == null || entry.idempotencyKey().isBlank()) {
            throw new IllegalStateException(
                    "Thiếu idempotencyKey — mọi luồng ghi điểm đều phải khai khoá chống ghi trùng");
        }
        if (entry.amount() == 0) {
            throw new IllegalStateException("Bút toán 0 điểm là vô nghĩa, không được ghi vào sổ cái");
        }

        // Lớp 1: lần gọi lặp là no-op.
        var existing = transactionRepository.findByIdempotencyKey(entry.idempotencyKey());
        if (existing.isPresent()) {
            log.debug("Bỏ qua bút toán lặp, khoá={}", entry.idempotencyKey());
            return existing.get();
        }

        UUID walletId = getOrCreateWallet(entry.organizationId(), entry.userId()).getId();

        // Khoá bi quan dòng ví. Đây là cơ chế chính chống đua ghi, không phải cột version.
        RewardWallet wallet = walletRepository.findByIdForUpdate(walletId)
                .orElseThrow(() -> new ResourceNotFoundException("Ví điểm", "id", walletId));

        int amount = entry.amount();
        int deltaEarned = 0, deltaSpent = 0, deltaExpired = 0;

        switch (entry.type()) {
            case EARN -> deltaEarned = amount;
            case SPEND -> deltaSpent = -amount;          // amount âm ⇒ spent tăng
            case REFUND -> deltaSpent = -amount;         // amount dương ⇒ spent giảm
            case EXPIRE -> deltaExpired = -amount;       // amount âm ⇒ expired tăng
            case ADJUST -> deltaEarned = amount;         // dương thì như nhận, âm thì huỷ khoản đã nhận
        }

        // Chặn âm CHỈ ở đường tiêu điểm. Thu hồi thưởng (ADJUST âm) được phép đẩy số dư
        // xuống âm: kẹp về 0 sẽ phá bất biến balanceAfter = trước + amount của sổ cái,
        // và làm sai lệch tổng đã nhận của người bị thu hồi.
        if (entry.type() == RewardTransactionType.SPEND && wallet.getBalance() + amount < 0) {
            throw new BusinessException("Số dư điểm không đủ. Hiện có " + wallet.getBalance()
                    + " điểm, cần " + Math.abs(amount) + " điểm.");
        }

        wallet.applyDelta(amount, deltaEarned, deltaSpent, deltaExpired);
        walletRepository.save(wallet);

        RewardTransaction tx = RewardTransaction.builder()
                .wallet(wallet)
                .organization(wallet.getOrganization())
                .user(wallet.getUser())
                .amount(amount)
                .type(entry.type())
                .sourceType(entry.sourceType())
                .sourceRefId(entry.sourceRefId())
                .reversalOfTransactionId(entry.reversalOfTransactionId())
                .externalSystem(entry.externalSystem())
                .externalRef(entry.externalRef())
                .idempotencyKey(entry.idempotencyKey())
                .balanceAfter(wallet.getBalance())
                .note(entry.note())
                .actor(entry.actor())
                .build();

        // Lớp 2: nếu khoá đụng nhau ở đây thì transaction bị huỷ và request nhận 409.
        return transactionRepository.save(tx);
    }

    /**
     * Ví của một người, tạo lười nếu chưa có.
     *
     * <p>Tạo lười thay vì tạo sẵn cho toàn bộ nhân sự lúc bật tính năng: tổ chức vài
     * nghìn người sẽ có hàng nghìn ví số dư 0 chẳng ai đụng tới.
     */
    @Transactional
    public RewardWallet getOrCreateWallet(UUID organizationId, UUID userId) {
        return walletRepository.findByOrganizationIdAndUserId(organizationId, userId)
                .orElseGet(() -> {
                    Organization org = organizationRepository.findById(organizationId)
                            .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", organizationId));
                    User user = userRepository.findById(userId)
                            .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "id", userId));
                    return walletRepository.save(RewardWallet.builder()
                            .organization(org)
                            .user(user)
                            .build());
                });
    }

    @Transactional(readOnly = true)
    public RewardWallet getWalletOrEmpty(UUID organizationId, UUID userId) {
        return walletRepository.findByOrganizationIdAndUserId(organizationId, userId)
                .orElseGet(() -> RewardWallet.builder().build());
    }

    /**
     * Đối soát: ví nào có số dư lệch so với sổ cái. Kết quả phải luôn rỗng — đây là
     * phép kiểm giá trị nhất với dữ liệu kiểu tiền tệ, nên có endpoint riêng cho quản trị.
     */
    @Transactional(readOnly = true)
    public List<UUID> findInconsistentWallets() {
        return walletRepository.findInconsistentWalletIds();
    }
}
