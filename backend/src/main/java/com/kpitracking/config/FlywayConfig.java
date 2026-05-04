package com.kpitracking.config;

import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
public class FlywayConfig {

    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy() {
        return flyway -> {
            try {
                // Thử thực hiện validate trước
                flyway.validate();
            } catch (Exception e) {
                // Nếu validate lỗi (sai checksum, mất file...), thực hiện clean và migrate lại từ đầu
                System.out.println("Flyway validation failed. Cleaning and re-migrating database...");
                flyway.clean();
            }
            flyway.migrate();
        };
    }
}
