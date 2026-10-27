package com.kpitracking.service.analytics;

import com.kpitracking.dto.response.stats.advanced.LeaderboardResponses.PersonRow;
import com.kpitracking.entity.evaluation.EvaluationLevel;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Hai quyết định của bảng xếp hạng mà sai thì không ai thấy ngay: ẩn danh ở cấp SELF, và tra mức
 * xếp loại theo ngưỡng của tổ chức.
 *
 * <p>Bảng xếp hạng sinh ra để NÊU TÊN, nên nó là chỗ dễ rò danh tính nhất trong cả trang Thống kê:
 * nhân viên chỉ được xem số của chính mình mà bảng vẫn in tên đồng nghiệp là một lỗi quyền, không
 * phải lỗi hiển thị.
 */
class LeaderboardServiceTest {

    private static final UUID VIEWER = UUID.randomUUID();
    private static final UUID OTHER = UUID.randomUUID();

    private static EvaluationLevel level(String name, double threshold) {
        EvaluationLevel l = new EvaluationLevel();
        l.setName(name);
        l.setThreshold(threshold);
        l.setColor("#000000");
        return l;
    }

    /** Đúng thứ tự mà `findByOrganizationIdOrderByThresholdDesc` trả về. */
    private static final List<EvaluationLevel> LEVELS = List.of(
            level("XUẤT SẮC", 90), level("TỐT", 80), level("KHÁ", 70),
            level("TRUNG BÌNH", 50), level("YẾU", 0));

    @Test
    @DisplayName("Cấp SELF: giữ tên của chính mình, bỏ tên và đơn vị của người khác")
    void anonymizesOthersButNotSelf() {
        PersonRow self = LeaderboardService.personRow(true, VIEWER, VIEWER, "Tôi", "Phòng IT", 91.0);
        PersonRow other = LeaderboardService.personRow(true, VIEWER, OTHER, "Người khác", "Phòng IT", 95.0);

        assertThat(self.getFullName()).isEqualTo("Tôi");
        assertThat(self.getOrgUnitName()).isEqualTo("Phòng IT");
        assertThat(self.getUserId()).isEqualTo(VIEWER);
        assertThat(self.getIsSelf()).isTrue();

        assertThat(other.getFullName()).isEqualTo("—");
        assertThat(other.getOrgUnitName()).isNull();
        // id cũng phải rụng: còn id là còn tra ngược ra người qua màn chi tiết.
        assertThat(other.getUserId()).isNull();
        // Con số vẫn giữ — người xem cần biết mình đứng đâu trong dải.
        assertThat(other.getKpiPercent()).isEqualTo(95.0);
    }

    @Test
    @DisplayName("Cấp ORG/UNIT: không ẩn gì")
    void keepsNamesWhenNotAnonymized() {
        PersonRow row = LeaderboardService.personRow(false, VIEWER, OTHER, "Người khác", "Phòng IT", 95.0);
        assertThat(row.getFullName()).isEqualTo("Người khác");
        assertThat(row.getOrgUnitName()).isEqualTo("Phòng IT");
        assertThat(row.getUserId()).isEqualTo(OTHER);
    }

    @Test
    @DisplayName("Xếp loại lấy mức CAO NHẤT mà điểm còn với tới")
    void picksHighestReachedLevel() {
        assertThat(LeaderboardService.levelOf(LEVELS, 95.0).getName()).isEqualTo("XUẤT SẮC");
        assertThat(LeaderboardService.levelOf(LEVELS, 90.0).getName()).isEqualTo("XUẤT SẮC");
        assertThat(LeaderboardService.levelOf(LEVELS, 89.9).getName()).isEqualTo("TỐT");
        assertThat(LeaderboardService.levelOf(LEVELS, 0.0).getName()).isEqualTo("YẾU");
        // Vượt trần vẫn là mức cao nhất, không rơi ra ngoài bảng.
        assertThat(LeaderboardService.levelOf(LEVELS, 150.0).getName()).isEqualTo("XUẤT SẮC");
    }

    @Test
    @DisplayName("Chưa có điểm thì không gán xếp loại nào")
    void noLevelWithoutScore() {
        assertThat(LeaderboardService.levelOf(LEVELS, null)).isNull();
        assertThat(LeaderboardService.levelOf(List.of(), 95.0)).isNull();
    }

    private static PersonRow person(String name, Double kpi, Double conduct) {
        return PersonRow.builder().fullName(name).kpiPercent(kpi).conductScore(conduct).build();
    }

    private static List<String> namesSorted(List<PersonRow> rows, String sortBy, String dir) {
        List<PersonRow> copy = new java.util.ArrayList<>(rows);
        copy.sort(LeaderboardService.by(LeaderboardService.keyOfPerson(sortBy), dir));
        return copy.stream().map(PersonRow::getFullName).toList();
    }

    @Test
    @DisplayName("Đổi chiều xếp: cao nhất ↔ thấp nhất, hàng CHƯA CÓ SỐ luôn ở cuối cả hai chiều")
    void sortsBothWaysAndKeepsBlanksLast() {
        List<PersonRow> rows = List.of(
                person("Giữa", 80.0, 3.0),
                person("Chưa chấm", null, null),
                person("Cao", 120.0, 2.0),
                person("Thấp", 40.0, 4.0));

        assertThat(namesSorted(rows, null, "desc")).containsExactly("Cao", "Giữa", "Thấp", "Chưa chấm");
        // Người chưa chấm KHÔNG phải người điểm thấp nhất — để họ đứng đầu bảng "thấp nhất" là vu oan.
        assertThat(namesSorted(rows, null, "asc")).containsExactly("Thấp", "Giữa", "Cao", "Chưa chấm");
    }

    @Test
    @DisplayName("Đổi cột xếp: giá trị cốt lõi cho thứ tự khác hiệu suất KPI")
    void sortsByChosenColumn() {
        List<PersonRow> rows = List.of(
                person("A", 120.0, 2.0),
                person("B", 40.0, 4.0));

        assertThat(namesSorted(rows, "kpi", "desc")).containsExactly("A", "B");
        assertThat(namesSorted(rows, "conduct", "desc")).containsExactly("B", "A");
    }
}
