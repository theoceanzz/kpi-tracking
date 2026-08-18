package com.kpitracking.service;

import com.kpitracking.entity.CashTransaction;
import com.kpitracking.entity.CashWallet;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.User;
import com.kpitracking.enums.CashSourceType;
import com.kpitracking.enums.CashTransactionType;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.CashTransactionRepository;
import com.kpitracking.repository.CashWalletRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.UserRepository;
import lombok.Builder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Lõi sổ cái ví tiền — NƠI DUY NHẤT được phép ghi vào {@code cash_wallets} và
 * {@code cash_transactions}.
 *
 * <h2>Vì sao phải một cửa</h2>
 * Đây là tiền thật. Hai bất biến sau phải luôn đúng, và chỉ đúng nếu mọi thay đổi
 * đi qua {@link #applyTransaction}:
 * <pre>
 *   balance = SUM(cash_transactions.amount)
 *   balance = lifetimeTopup - lifetimeConverted
 * </pre>
 * Ba cột tổng của {@link CashWallet} không có setter công khai, nên đây không
 * phải quy ước lỏng lẻo mà là ràng buộc ở mức cấu trúc.
 *
 * <h2>Công thức cập nhật theo loại bút toán</h2>
 * <pre>
 * type              amount   balance   topup      converted
 * TOPUP               +      +=amount  +=amount      -
 * CONVERT             -      +=amount     -       +=|amount|
 * ADJUST (dương)      +      +=amount  +=amount      -
 * ADJUST (âm)         -      +=amount  -=|amount|    -
 * </pre>
 * {@code ADJUST} cộng/trừ vào {@code lifetimeTopup} chứ không mở cột riêng: một
 * khoản điều chỉnh dương thực chất là tiền vào ví, khoản âm là huỷ bỏ một khoản
 * tiền vào trước đó. Giữ nguyên {@code lifetimeTopup} khi điều chỉnh âm sẽ khiến
 * tổng đã nạp đếm cả những khoản đã bị rút lại.
 *
 * <h2>Khác ví điểm ở chỗ nào</h2>
 * Số dư ví tiền KHÔNG được phép âm ở bất kỳ đường nào. Ví điểm cho phép âm vì có
 * đường thu hồi thưởng sau khi người nhận đã tiêu; ví tiền không có đường tương
 * tự, và DB có {@code CHECK (balance >= 0)} làm lưới cuối.
 *
 * <h2>Bất biến thứ tự khoá</h2>
 * Luồng nào chạm cả hai ví thì <b>LUÔN khoá ví TIỀN trước, ví ĐIỂM sau</b>. Hiện
 * chỉ {@code PointConversionService} chạm cả hai nên chưa thể deadlock, nhưng một
 * luồng ngược trong tương lai (đổi điểm lấy tiền, hoàn điểm về ví) mà khoá theo
 * thứ tự đảo sẽ ôm chéo khoá với luồng quy đổi và treo cả hai tới timeout.
 *
 * <h2>Bảng đăng ký khoá chống ghi trùng</h2>
 * <pre>
 *   Nạp qua SePay          topup:{topupOrderId}     (webhook VÀ gán tay dùng chung)
 *   Ghi có tay từ sự kiện  sepay_resolve:{eventId}
 *   Quy đổi sang điểm      convert:{requestId}      (requestId do client sinh)
 * </pre>
 * Khoá phải suy ra được HOÀN TOÀN từ (loại nghiệp vụ, id bản ghi). Tuyệt đối
 * không chèn timestamp hay số ngẫu nhiên sinh phía server: lần retry sẽ sinh khoá
 * khác và lớp bảo vệ thành vô nghĩa. Xem {@link #key(String, Object...)}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CashWalletService {

    private final CashWalletRepository walletRepository;
    private final CashTransactionRepository transactionRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;

    /**
     * Mô tả một bút toán. Gom tham số vào đây để lời gọi đọc được, không phải
     * mười đối số.
     *
     * @param amount có dấu — người gọi chịu trách nhiệm đặt đúng dấu theo
     *               {@code type} (TOPUP dương, CONVERT âm, ADJUST tuỳ ý nghĩa)
     */
    @Builder
    public record CashLedgerEntry(
            UUID organizationId,
            UUID userId,
            long amount,
            CashTransactionType type,
            CashSourceType sourceType,
            UUID sourceRefId,
            String idempotencyKey,
            Integer pointsGranted,
            Long rateSnapshot,
            String note,
            User actor
    ) {}

    /**
     * Ghép khoá chống ghi trùng theo đúng bảng đăng ký ở javadoc của class. Dùng
     * hàm này thay vì nối chuỗi tay để khoá luôn cùng một dạng.
     */
    public static String key(String prefix, Object... parts) {
        StringBuilder sb = new StringBuilder(prefix);
        for (Object p : parts) {
            sb.append(':').append(p);
        }
        return sb.toString();
    }

    /** Định dạng tiền cho thông điệp lỗi hiện ra cho người dùng. */
    public static String formatVnd(long amount) {
        return NumberFormat.getInstance(new Locale("vi", "VN")).format(amount) + "đ";
    }

    /**
     * Ghi một bút toán và cập nhật ví. CỬA DUY NHẤT chạm vào tiền.
     *
     * <p>Chạy trong transaction của người gọi ({@code MANDATORY} về mặt ý nghĩa —
     * việc ghi có phải nguyên tử cùng với việc đổi trạng thái nghiệp vụ; nếu tách
     * transaction riêng thì một lỗi ở bước sau sẽ để lại tiền đã ghi mà đơn nạp
     * vẫn đang chờ).
     *
     * <p><b>Chống ghi trùng hai lớp:</b>
     * <ol>
     *   <li>Tra {@code idempotencyKey} trước. Lớp này xử lý gần như toàn bộ
     *       trường hợp thực tế: người dùng bấm lại sau vài giây, SePay gửi lại
     *       webhook, client retry khi mạng chập chờn. Lần lặp là no-op, trả về
     *       đúng bút toán cũ.</li>
     *   <li>Ràng buộc duy nhất ở DB. Chỉ bắt trường hợp hai request chạy song
     *       song khít đến mức cả hai cùng vượt qua bước tra ở trên.
     *       <b>Lưu ý:</b> khi lớp này kích hoạt, PostgreSQL huỷ toàn bộ
     *       transaction — không thể bắt lỗi rồi trả về bút toán cũ trong cùng
     *       transaction. Request đó nhận 409. Đây là hành vi ĐÚNG: không có gì bị
     *       ghi hai lần, và lần thử lại sẽ đi vào lớp 1 và nhận kết quả bình
     *       thường.</li>
     * </ol>
     */
    @Transactional
    public CashTransaction applyTransaction(CashLedgerEntry entry) {
        if (entry.idempotencyKey() == null || entry.idempotencyKey().isBlank()) {
            throw new IllegalStateException(
                    "Thiếu idempotencyKey — mọi luồng ghi tiền đều phải khai khoá chống ghi trùng");
        }
        if (entry.amount() == 0) {
            throw new IllegalStateException("Bút toán 0 đồng là vô nghĩa, không được ghi vào sổ cái");
        }

        // Lớp 1: lần gọi lặp là no-op.
        var existing = transactionRepository.findByIdempotencyKey(entry.idempotencyKey());
        if (existing.isPresent()) {
            log.debug("Bỏ qua bút toán tiền lặp, khoá={}", entry.idempotencyKey());
            return existing.get();
        }

        UUID walletId = getOrCreateWallet(entry.organizationId(), entry.userId()).getId();

        // Khoá bi quan dòng ví. Đây là cơ chế chính chống đua ghi, không phải cột version.
        CashWallet wallet = walletRepository.findByIdForUpdate(walletId)
                .orElseThrow(() -> new ResourceNotFoundException("Ví tiền", "id", walletId));

        long amount = entry.amount();
        long deltaTopup = 0L, deltaConverted = 0L;

        switch (entry.type()) {
            case TOPUP -> deltaTopup = amount;
            case CONVERT -> deltaConverted = -amount;   // amount âm ⇒ converted tăng
            case ADJUST -> deltaTopup = amount;         // dương như nạp, âm là huỷ khoản đã nạp
        }

        // Chặn âm ở MỌI đường, khác hẳn ví điểm. Không có nghiệp vụ nào của tiền
        // thật cần số dư âm, nên số dư âm luôn là lỗi chứ không phải trạng thái hợp lệ.
        if (wallet.getBalance() + amount < 0) {
            throw new BusinessException("Số dư ví tiền không đủ. Hiện có "
                    + formatVnd(wallet.getBalance()) + ", cần " + formatVnd(Math.abs(amount)) + ".");
        }

        wallet.applyDelta(amount, deltaTopup, deltaConverted);
        walletRepository.save(wallet);

        CashTransaction tx = CashTransaction.builder()
                .wallet(wallet)
                .organization(wallet.getOrganization())
                .user(wallet.getUser())
                .amount(amount)
                .type(entry.type())
                .sourceType(entry.sourceType())
                .sourceRefId(entry.sourceRefId())
                .idempotencyKey(entry.idempotencyKey())
                .balanceAfter(wallet.getBalance())
                .pointsGranted(entry.pointsGranted())
                .rateSnapshot(entry.rateSnapshot())
                .note(entry.note())
                .actor(entry.actor())
                .build();

        // Lớp 2: nếu khoá đụng nhau ở đây thì transaction bị huỷ và request nhận 409.
        return transactionRepository.save(tx);
    }

    /**
     * Ví của một người, tạo lười nếu chưa có.
     *
     * <p>Tạo lười thay vì tạo sẵn cho toàn bộ nhân sự lúc bật tính năng: tổ chức
     * vài nghìn người sẽ có hàng nghìn ví số dư 0 chẳng ai đụng tới.
     */
    @Transactional
    public CashWallet getOrCreateWallet(UUID organizationId, UUID userId) {
        return walletRepository.findByOrganizationIdAndUserId(organizationId, userId)
                .orElseGet(() -> {
                    Organization org = organizationRepository.findById(organizationId)
                            .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", organizationId));
                    User user = userRepository.findById(userId)
                            .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "id", userId));
                    return walletRepository.save(CashWallet.builder()
                            .organization(org)
                            .user(user)
                            .build());
                });
    }

    @Transactional(readOnly = true)
    public CashWallet getWalletOrEmpty(UUID organizationId, UUID userId) {
        return walletRepository.findByOrganizationIdAndUserId(organizationId, userId)
                .orElseGet(() -> CashWallet.builder().build());
    }

    /**
     * Đối soát: ví nào của tổ chức này có số dư lệch so với sổ cái. Kết quả phải
     * luôn rỗng — đây là phép kiểm giá trị nhất với dữ liệu kiểu tiền tệ.
     */
    @Transactional(readOnly = true)
    public List<UUID> findInconsistentWallets(UUID organizationId) {
        return walletRepository.findInconsistentWalletIds(organizationId);
    }
}
