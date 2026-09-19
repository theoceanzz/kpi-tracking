package com.kpitracking.config;

import org.flywaydb.core.api.ErrorCode;
import org.flywaydb.core.api.output.ValidateOutput;
import org.flywaydb.core.api.output.ValidateResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

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

    /** Mã lỗi "có file mà DB chưa chạy" — không phải lỗi, migrate() sẽ áp ngay sau. */
    private static final Set<ErrorCode> PENDING_CODES = EnumSet.of(
            ErrorCode.RESOLVED_VERSIONED_MIGRATION_NOT_APPLIED,
            ErrorCode.RESOLVED_REPEATABLE_MIGRATION_NOT_APPLIED);

    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy() {
        return flyway -> {
            // validate() coi migration MỚI CHƯA CHẠY (pending) cũng là lỗi — mà thêm V{n} mới chính
            // là cách duy nhất để đổi schema, nên phải lọc riêng: pending là việc của migrate() ngay
            // bên dưới; chỉ checksum lệch / file đã chạy bị xoá mới là lỗi thật.
            ValidateResult result = flyway.validateWithResult();
            List<ValidateOutput> real = result.invalidMigrations == null ? List.of()
                    : result.invalidMigrations.stream()
                        .filter(m -> m.errorDetails == null || !PENDING_CODES.contains(m.errorDetails.errorCode))
                        .toList();
            if (!real.isEmpty()) {
                String detail = real.stream()
                        .map(m -> m.version + " " + m.description + ": "
                                + (m.errorDetails != null ? m.errorDetails.errorMessage : "?"))
                        .collect(Collectors.joining("; "));
                switch (onValidationError.toLowerCase()) {
                    case "repair" -> {
                        log.warn("Flyway validate lỗi: {} -> repair() rồi migrate, KHÔNG clean.", detail);
                        flyway.repair();
                    }
                    case "clean" -> {
                        log.warn("Flyway validate lỗi: {} -> CLEAN toàn bộ DB rồi chạy lại (app.flyway.on-validation-error=clean).",
                                detail);
                        flyway.clean();
                    }
                    default -> throw new IllegalStateException(
                            "Flyway validate lỗi: " + detail
                            + " — migration đã chạy không được sửa; thêm file V{n} mới. Làm lại DB local: "
                            + "./mvnw flyway:clean flyway:migrate. (app.flyway.on-validation-error=fail)");
                }
            }
            flyway.migrate();
        };
    }
}
