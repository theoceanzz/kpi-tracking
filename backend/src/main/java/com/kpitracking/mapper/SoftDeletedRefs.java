package com.kpitracking.mapper;

import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.User;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.hibernate.proxy.HibernateProxy;
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
            String name = scalar("SELECT full_name FROM users WHERE id = ?", idOf(user, user::getId));
            return name == null ? DELETED_SUFFIX.trim() : name + DELETED_SUFFIX;
        }
    }

    /**
     * Id người dùng, an toàn với proxy của bản ghi đã xoá mềm. Cần vì sau một lần nạp thất bại
     * (vd. {@link #userName} đã bắt {@link EntityNotFoundException}) proxy bị đánh dấu "đã nạp"
     * và cả {@code getId()} thông thường cũng ném — cùng một người xoá mềm xuất hiện ở hai bài
     * nộp trong một phiên là dùng chung một proxy, bài thứ hai sẽ vỡ ở dòng map id.
     */
    @Named("userId")
    public UUID userId(User user) {
        return user == null ? null : idOf(user, user::getId);
    }

    /** Id đợt KPI, an toàn với proxy của đợt đã xoá mềm (xem {@link #userId}). */
    @Named("periodId")
    public UUID periodId(KpiPeriod period) {
        return period == null ? null : idOf(period, period::getId);
    }

    /** Tên đợt KPI; đợt đã xoá mềm vẫn trả tên kèm nhãn. */
    @Named("periodName")
    public String periodName(KpiPeriod period) {
        if (period == null) return null;
        try {
            return period.getName();
        } catch (EntityNotFoundException e) {
            String name = scalar("SELECT name FROM kpi_periods WHERE id = ?", idOf(period, period::getId));
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

    /**
     * Khoá chính của một quan hệ mà KHÔNG nạp proxy. Với cấu hình JPA hiện tại, ngay cả
     * {@code getId()} trên proxy của bản ghi đã xoá mềm cũng kích hoạt nạp và ném
     * {@link EntityNotFoundException} (gặp trên danh sách bài nộp 2026-09-22), nên đọc id
     * từ lazy initializer — id luôn có sẵn trong proxy vì đó là FK đã đọc từ bảng cha.
     */
    public static UUID idOf(Object entity, Supplier<UUID> getter) {
        if (entity instanceof HibernateProxy proxy) {
            Object id = proxy.getHibernateLazyInitializer().getIdentifier();
            if (id instanceof UUID uuid) return uuid;
        }
        return getter.get();
    }

    private String scalar(String sql, UUID id) {
        try {
            return jdbc.queryForObject(sql, String.class, id);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }
}
