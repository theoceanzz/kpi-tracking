package com.kpitracking.mapper;

import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.User;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.mapstruct.Named;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Đọc tên / mốc thời gian từ quan hệ trỏ tới bản ghi <b>đã xoá mềm</b> mà không vỡ.
 *
 * <p>{@code User} và {@code KpiPeriod} có {@code @SQLRestriction("deleted_at IS NULL")}: bản ghi
 * xoá mềm vẫn còn trong bảng nhưng Hibernate coi như không tồn tại. Một bài nộp của nhân viên đã
 * nghỉ, hay một KPI thuộc đợt đã xoá, vẫn giữ FK tới bản ghi đó — lazy proxy KHÁC null, nhưng
 * chạm vào bất kỳ thuộc tính nào ngoài {@code id} là ném {@link EntityNotFoundException} và cả
 * màn hình (danh sách bài nộp, dashboard, đánh giá) đổ 500. Đã xảy ra trên prod 2026-09-15 với
 * dữ liệu xoá từ tháng 7.
 *
 * <p>Ở đây: thử đọc qua proxy; nếu bản ghi đã bị lọc thì đọc thẳng bằng JDBC (bỏ qua
 * {@code @SQLRestriction}) và gắn nhãn "(đã xoá)" cho tên. Chỉ tốn thêm một câu SQL khi thật sự
 * gặp bản ghi đã xoá — trường hợp hiếm. Dùng trong MapStruct qua {@code uses = SoftDeletedRefs.class}
 * và ở các service đọc dữ liệu tổng hợp.
 */
@Component
@RequiredArgsConstructor
public class SoftDeletedRefs {

    public static final String DELETED_SUFFIX = " (đã xoá)";

    private final JdbcTemplate jdbc;

    /** Tên người dùng; người đã bị xoá mềm vẫn trả tên kèm nhãn. {@code null} nếu không có quan hệ. */
    @Named("userName")
    public String userName(User user) {
        if (user == null) return null;
        try {
            return user.getFullName();
        } catch (EntityNotFoundException e) {
            String name = scalar("SELECT full_name FROM users WHERE id = ?", user.getId());
            return name == null ? DELETED_SUFFIX.trim() : name + DELETED_SUFFIX;
        }
    }

    /** Tên đợt KPI; đợt đã xoá mềm vẫn trả tên kèm nhãn. */
    @Named("periodName")
    public String periodName(KpiPeriod period) {
        if (period == null) return null;
        try {
            return period.getName();
        } catch (EntityNotFoundException e) {
            String name = scalar("SELECT name FROM kpi_periods WHERE id = ?", period.getId());
            return name == null ? DELETED_SUFFIX.trim() : name + DELETED_SUFFIX;
        }
    }

    /** Ngày bắt đầu đợt; {@code null} nếu đợt đã xoá mềm (coi như không có mốc). */
    public Instant periodStart(KpiPeriod period) {
        return period == null ? null : orNull(period::getStartDate);
    }

    /** Ngày kết thúc đợt; {@code null} nếu đợt đã xoá mềm. */
    public Instant periodEnd(KpiPeriod period) {
        return period == null ? null : orNull(period::getEndDate);
    }

    /** Đợt còn tồn tại (không bị xoá mềm) hay không — dùng để lọc trước khi sort/gộp. */
    public boolean periodAlive(KpiPeriod period) {
        return period != null && orNull(period::getName) != null;
    }

    /** Chạy {@code supplier}; bản ghi đã xoá mềm (proxy không nạp được) thì trả {@code null}. */
    public static <T> T orNull(Supplier<T> supplier) {
        try {
            return supplier.get();
        } catch (EntityNotFoundException e) {
            return null;
        }
    }

    private String scalar(String sql, UUID id) {
        try {
            return jdbc.queryForObject(sql, String.class, id);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }
}
