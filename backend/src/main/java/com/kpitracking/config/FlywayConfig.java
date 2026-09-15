package com.kpitracking.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FlywayConfig {

    private static final Logger log = LoggerFactory.getLogger(FlywayConfig.class);

    /**
     * Xử lý khi Flyway validate lỗi (checksum của file đã chạy bị đổi, hoặc file bị xoá):
     * <ul>
     *   <li>{@code fail} — dừng app và báo rõ. Mặc định cho dev từ khi V1/V2 đóng băng (2026-09-15):
     *       migration đã chạy thì không được sửa; muốn đổi schema thì thêm V{n} mới. Làm lại DB local
     *       khi cố ý: {@code ./mvnw flyway:clean flyway:migrate}.</li>
     *   <li>{@code repair} — sửa checksum trong {@code flyway_schema_history} rồi migrate tiếp. Prod dùng:
     *       V1/V2 trên prod được ghi với checksum cũ (trước khi đóng băng), cần repair đúng một lần.</li>
     *   <li>{@code clean} — xoá sạch DB rồi chạy lại từ V1. Hành vi dev cũ; chỉ bật tay khi cố ý và
     *       không bao giờ ở prod ({@code spring.flyway.clean-disabled=true} chặn thêm một lớp).</li>
     * </ul>
     */
    @Value("${app.flyway.on-validation-error:fail}")
    private String onValidationError;

    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy() {
        return flyway -> {
            try {
                flyway.validate();
            } catch (Exception e) {
                switch (onValidationError.toLowerCase()) {
                    case "repair" -> {
                        log.warn("Flyway validate lỗi: {} -> repair() rồi migrate, KHÔNG clean.", e.getMessage());
                        flyway.repair();
                    }
                    case "clean" -> {
                        log.warn("Flyway validate lỗi: {} -> CLEAN toàn bộ DB rồi chạy lại (app.flyway.on-validation-error=clean).",
                                e.getMessage());
                        flyway.clean();
                    }
                    default -> throw new IllegalStateException(
                            "Flyway validate lỗi: " + e.getMessage()
                            + " — migration đã chạy không được sửa; thêm file V{n} mới. Làm lại DB local: "
                            + "./mvnw flyway:clean flyway:migrate. (app.flyway.on-validation-error=fail)", e);
                }
            }
            flyway.migrate();
        };
    }
}
