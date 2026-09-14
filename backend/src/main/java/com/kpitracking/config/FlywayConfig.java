package com.kpitracking.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FlywayConfig {

    /**
     * Chỉ dev mới được phép xoá sạch DB khi validate lỗi. Mặc định TẮT: bản cũ gọi
     * {@code flyway.clean()} ở mọi môi trường — một file migration bị sửa vài ký tự (checksum lệch)
     * là toàn bộ dữ liệu khách hàng trên prod bị drop rồi seed lại từ đầu.
     */
    @Value("${app.flyway.clean-on-validation-error:false}")
    private boolean cleanOnValidationError;

    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy() {
        return flyway -> {
            try {
                flyway.validate();
            } catch (Exception e) {
                if (cleanOnValidationError) {
                    System.out.println("Flyway validation failed (dev): cleaning and re-migrating...");
                    flyway.clean();
                } else {
                    // Prod: sửa checksum/mark failed trong schema_history rồi đi tiếp. Nếu vẫn không
                    // migrate được thì để ứng dụng dừng — không bao giờ tự xoá dữ liệu.
                    System.out.println("Flyway validation failed: " + e.getMessage()
                            + " -> repair() rồi migrate, KHÔNG clean.");
                    flyway.repair();
                }
            }
            flyway.migrate();
        };
    }
}
