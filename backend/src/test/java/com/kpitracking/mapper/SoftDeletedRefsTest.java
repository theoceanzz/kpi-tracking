package com.kpitracking.mapper;

import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.User;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Hồi quy prod 2026-09-15: bài nộp của người đã nghỉ / KPI thuộc đợt đã xoá mềm làm danh sách
 * bài nộp, dashboard và đánh giá đổ 500 vì proxy Hibernate ném EntityNotFoundException.
 */
class SoftDeletedRefsTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final SoftDeletedRefs refs = new SoftDeletedRefs(jdbc);

    /** Giả lập proxy của bản ghi đã bị @SQLRestriction lọc: id đọc được, thuộc tính khác thì ném. */
    private static User deletedUserProxy(UUID id) {
        return new User() {
            @Override public UUID getId() { return id; }
            @Override public String getFullName() { throw new EntityNotFoundException("Unable to find User with id " + id); }
        };
    }

    private static KpiPeriod deletedPeriodProxy(UUID id) {
        return new KpiPeriod() {
            @Override public UUID getId() { return id; }
            @Override public String getName() { throw new EntityNotFoundException("gone"); }
            @Override public Instant getStartDate() { throw new EntityNotFoundException("gone"); }
        };
    }

    @Test
    @DisplayName("người còn tồn tại: trả tên như thường, không đụng JDBC")
    void aliveUserReadsThroughProxy() {
        User u = new User();
        u.setFullName("Nguyễn Văn A");
        assertThat(refs.userName(u)).isEqualTo("Nguyễn Văn A");
    }

    @Test
    @DisplayName("người đã xoá mềm: đọc tên bằng JDBC (bỏ qua @SQLRestriction) và gắn nhãn")
    void deletedUserFallsBackToJdbc() {
        UUID id = UUID.randomUUID();
        when(jdbc.queryForObject(eq("SELECT full_name FROM users WHERE id = ?"), eq(String.class), eq(id)))
                .thenReturn("Trần B");
        assertThat(refs.userName(deletedUserProxy(id))).isEqualTo("Trần B (đã xoá)");
    }

    @Test
    @DisplayName("bản ghi đã bị xoá cứng luôn: vẫn không ném, trả nhãn")
    void hardDeletedUserStillDoesNotThrow() {
        when(jdbc.queryForObject(any(String.class), eq(String.class), any(UUID.class)))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(refs.userName(deletedUserProxy(UUID.randomUUID()))).isEqualTo("(đã xoá)");
    }

    @Test
    @DisplayName("null giữ null — MapStruct/FE phân biệt được 'không có' với 'đã xoá'")
    void nullStaysNull() {
        assertThat(refs.userName(null)).isNull();
        assertThat(refs.periodName(null)).isNull();
        assertThat(refs.periodStart(null)).isNull();
        assertThat(refs.periodAlive(null)).isFalse();
    }

    @Test
    @DisplayName("đợt đã xoá mềm: periodAlive=false, mốc thời gian null, tên có nhãn")
    void deletedPeriod() {
        UUID id = UUID.randomUUID();
        when(jdbc.queryForObject(eq("SELECT name FROM kpi_periods WHERE id = ?"), eq(String.class), eq(id)))
                .thenReturn("Quý 3");
        KpiPeriod p = deletedPeriodProxy(id);
        assertThat(refs.periodAlive(p)).isFalse();
        assertThat(refs.periodStart(p)).isNull();
        assertThat(refs.periodName(p)).isEqualTo("Quý 3 (đã xoá)");
    }

    @Test
    @DisplayName("orNull: chỉ nuốt EntityNotFoundException, lỗi khác vẫn ném")
    void orNullOnlySwallowsEntityNotFound() {
        Object swallowed = SoftDeletedRefs.orNull(() -> { throw new EntityNotFoundException("x"); });
        assertThat(swallowed).isNull();
        org.assertj.core.api.Assertions.assertThatThrownBy(
                () -> SoftDeletedRefs.orNull(() -> { throw new IllegalStateException("khác"); }))
                .isInstanceOf(IllegalStateException.class);
    }
}
