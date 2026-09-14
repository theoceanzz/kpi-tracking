package com.kpitracking.config;

import org.flywaydb.core.api.exception.FlywayValidateException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FlywayConfig {

    private static final Logger log = LoggerFactory.getLogger(FlywayConfig.class);

    /**
     * Chạy migration; chỉ dọn sạch schema khi lịch sử migration thực sự hỏng.
     *
     * <p><b>Cái bẫy đã sập một lần.</b> Bản trước gọi {@code flyway.validate()} rồi bắt MỌI ngoại
     * lệ để {@code clean()}. Nhưng {@code validate()} coi "có migration chưa chạy" là một lỗi xác
     * thực — nghĩa là chỉ cần thêm một file {@code V…__*.sql} mới là lần khởi động kế tiếp XOÁ
     * TRẮNG cơ sở dữ liệu rồi gieo lại từ đầu. Không phải giả thuyết: đúng chuyện đó đã xảy ra khi
     * thêm {@code V3__dashboard_layout_scope.sql}.
     *
     * <p><b>Vì sao gọi thẳng {@code migrate()}.</b> {@code migrate()} bỏ qua migration đang chờ
     * (đó là việc của nó) nhưng vẫn tự xác thực các migration ĐÃ ÁP, và ném
     * {@link FlywayValidateException} nếu chúng lệch với mã nguồn (sai checksum, mất file). Nhờ vậy
     * phân biệt được hai chuyện vốn bị gộp làm một:
     *
     * <ul>
     *   <li>thêm migration mới → chạy tiếp, không đụng dữ liệu;
     *   <li>lịch sử migration hỏng → mới dọn và dựng lại.
     * </ul>
     *
     * <p>Ngoại lệ do LỖI SQL trong chính migration thì cố ý để nó nổ ra và chặn ứng dụng khởi
     * động: xoá sạch dữ liệu vì một câu SQL viết sai là cái giá không tương xứng, mà dọn xong chạy
     * lại cũng vẫn hỏng ở đúng chỗ đó.
     *
     * <p>Việc tự {@code clean()} chỉ còn ở môi trường phát triển. Production đặt
     * {@code spring.flyway.clean-disabled=true}: gặp lịch sử hỏng thì ứng dụng DỪNG khởi động và
     * một người phải vào xem — xoá trắng dữ liệu khách hàng để "cho chạy được" không bao giờ là
     * đáp án đúng. Hai nhánh dưới đây phải nói rõ mình đang ở nhánh nào, không thì log ở production
     * hứa "dựng lại từ đầu" rồi lại ném ngoại lệ.
     */
    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy() {
        return flyway -> {
            try {
                flyway.migrate();
            } catch (FlywayValidateException e) {
                if (flyway.getConfiguration().isCleanDisabled()) {
                    log.error("Lịch sử migration không khớp với mã nguồn ({}). Tự dọn schema đã bị TẮT ở môi trường này "
                            + "— cần người xử lý tay (flyway repair, hoặc khôi phục từ bản sao lưu). Ứng dụng sẽ không khởi động.",
                            e.getMessage());
                    throw e;
                }
                log.warn("Lịch sử migration không khớp với mã nguồn ({}). Dọn sạch schema và dựng lại từ đầu — TOÀN BỘ DỮ LIỆU SẼ MẤT.",
                        e.getMessage());
                flyway.clean();
                flyway.migrate();
            }
        };
    }
}
