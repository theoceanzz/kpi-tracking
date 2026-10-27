package com.kpitracking.service.analytics;

import com.kpitracking.dto.response.stats.BscOverviewResponses.PerspectiveRef;
import com.kpitracking.dto.response.stats.advanced.UnitDetailResponses.BscAxisPoint;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Trục radar BSC của trang chi tiết đơn vị.
 *
 * <p>Radar chỉ có BỐN lĩnh vực kinh điển và luôn đủ bốn trục: thiếu trục thì hình của hai đơn vị
 * không chồng lên nhau để so được nữa, còn thêm trục "chưa phân loại" thì cũng vậy.
 */
class UnitDetailServiceTest {

    private static final List<PerspectiveRef> REFS = List.of(
            PerspectiveRef.builder().code("FINANCIAL").name("Tài chính (tuỳ biến)").color("#111").build(),
            PerspectiveRef.builder().code("CUSTOMER").name("Khách hàng").color("#222").build(),
            PerspectiveRef.builder().code("INTERNAL_PROCESS").name("Quy trình nội bộ").color("#333").build(),
            PerspectiveRef.builder().code("LEARNING_GROWTH").name("Học hỏi & phát triển").color("#444").build());

    @Test
    @DisplayName("Đủ 4 trục, đúng thứ tự cố định của BSC")
    void fourAxesInFixedOrder() {
        List<BscAxisPoint> axes = UnitDetailService.axes(REFS, Map.of(
                "LEARNING_GROWTH", 70.0, "FINANCIAL", 90.0,
                "CUSTOMER", 80.0, "INTERNAL_PROCESS", 60.0));

        assertThat(axes).extracting(BscAxisPoint::getCode)
                .containsExactly("FINANCIAL", "CUSTOMER", "INTERNAL_PROCESS", "LEARNING_GROWTH");
        assertThat(axes).extracting(BscAxisPoint::getPercent)
                .containsExactly(90.0, 80.0, 60.0, 70.0);
    }

    @Test
    @DisplayName("Lĩnh vực chưa có số trả null, KHÔNG phải 0")
    void missingStaysNull() {
        List<BscAxisPoint> axes = UnitDetailService.axes(REFS, Map.of("FINANCIAL", 90.0));

        assertThat(axes.get(0).getPercent()).isEqualTo(90.0);
        assertThat(axes.subList(1, 4)).extracting(BscAxisPoint::getPercent)
                .containsOnlyNulls();
    }

    @Test
    @DisplayName("Rổ UNCLASSIFIED và mã lạ không chen vào radar")
    void unclassifiedDropped() {
        List<BscAxisPoint> axes = UnitDetailService.axes(REFS, Map.of(
                "FINANCIAL", 90.0, "UNCLASSIFIED", 55.0, "SOMETHING_ELSE", 44.0));

        assertThat(axes).hasSize(4);
        assertThat(axes).extracting(BscAxisPoint::getCode).doesNotContain("UNCLASSIFIED", "SOMETHING_ELSE");
    }

    @Test
    @DisplayName("Không có bản lĩnh vực của tổ chức thì rơi về tên và màu mặc định")
    void fallsBackToDefaultNames() {
        List<BscAxisPoint> axes = UnitDetailService.axes(List.of(), Map.of());

        assertThat(axes).hasSize(4);
        assertThat(axes.get(0).getName()).isEqualTo("Tài chính");
        assertThat(axes.get(0).getColor()).isNotBlank();
    }

    @Test
    @DisplayName("Chưa có mốc nào thì vẫn trả đủ 4 trục rỗng, không ném lỗi")
    void nullMapIsSafe() {
        assertThat(UnitDetailService.axes(REFS, null)).hasSize(4)
                .extracting(BscAxisPoint::getPercent).containsOnlyNulls();
    }
}
