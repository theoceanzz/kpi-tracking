package com.kpitracking.ai.agent;

import com.kpitracking.service.ai.PlanStep;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Test cho bộ bóc kế hoạch — phần rộng rãi có chủ đích của {@code PlannerAgent}.
 *
 * <p>Model hay quên dấu {@code |}, đánh số dù đã dặn, hoặc bịa tên tool. Mọi lệch lạc đó giữ lại
 * bước (model chính vẫn đọc được việc cần làm), nhưng <b>tuyệt đối không đoán</b> tên tool gần
 * giống — đoán là mở đường cho định tuyến sai một cách âm thầm.
 */
class PlanParserTest {

    @Test
    @DisplayName("bóc được TÊN_TOOL | việc cần lấy")
    void parsesToolNameAndDescription() {
        List<PlanStep> steps = PlanParser.parse("get_people | Đếm nhân sự Phòng IT\nget_kpi | Liệt kê KPI");

        assertThat(steps).extracting(PlanStep::tool).containsExactly("get_people", "get_kpi");
        assertThat(steps).extracting(PlanStep::what).containsExactly("Đếm nhân sự Phòng IT", "Liệt kê KPI");
    }

    @Test
    @DisplayName("gọt bỏ dấu đầu dòng và số thứ tự model tự thêm dù đã dặn không")
    void stripsBulletsAndNumbering() {
        List<PlanStep> steps = PlanParser.parse(
                "1. get_people | Đếm nhân sự\n- get_kpi | Liệt kê KPI\n* get_analytics | Xem xu hướng");

        assertThat(steps).extracting(PlanStep::tool).containsExactly("get_people", "get_kpi", "get_analytics");
        assertThat(steps).extracting(PlanStep::what).containsExactly("Đếm nhân sự", "Liệt kê KPI", "Xem xu hướng");
    }

    @Test
    @DisplayName("tên tool KHÔNG có thật -> giữ bước nhưng không gán tool, tuyệt đối không đoán bừa")
    void unknownToolNameIsNotGuessed() {
        List<PlanStep> steps = PlanParser.parse("get_person | Đếm nhân sự\nget_kpi | Liệt kê KPI");

        assertThat(steps.get(0).tool()).isNull();
        assertThat(steps.get(0).what())
                .as("bước vẫn phải giữ để model đọc được việc cần làm")
                .isEqualTo("get_person | Đếm nhân sự");
        assertThat(steps.get(1).tool()).isEqualTo("get_kpi");
    }

    @Test
    @DisplayName("model quên dấu | -> vẫn giữ bước, chỉ là không có tool")
    void missingSeparatorStillKeepsStep() {
        List<PlanStep> steps = PlanParser.parse("Đếm nhân sự Phòng IT\nLiệt kê KPI");

        assertThat(steps).extracting(PlanStep::tool).containsOnlyNulls();
        assertThat(steps).extracting(PlanStep::what).containsExactly("Đếm nhân sự Phòng IT", "Liệt kê KPI");
    }

    @Test
    @DisplayName("tên tool viết hoa/thừa khoảng trắng vẫn nhận")
    void toolNameIsCaseAndSpaceInsensitive() {
        List<PlanStep> steps = PlanParser.parse("  GET_PEOPLE  | Đếm nhân sự\nGet_Kpi|Liệt kê KPI");

        assertThat(steps).extracting(PlanStep::tool).containsExactly("get_people", "get_kpi");
    }

    @Test
    @DisplayName("bước rỗng phần mô tả thì bỏ, không đẩy dòng rác vào prompt")
    void blankDescriptionIsDropped() {
        List<PlanStep> steps = PlanParser.parse("get_people |   \nget_kpi | Liệt kê KPI\nget_analytics | Xu hướng");

        assertThat(steps).extracting(PlanStep::tool).containsExactly("get_kpi", "get_analytics");
    }

    @Test
    @DisplayName("trần 4 bước — dài hơn gần như chắc chắn là model lan man")
    void capsNumberOfSteps() {
        List<PlanStep> steps = PlanParser.parse(
                "get_people | a\nget_kpi | b\nget_analytics | c\nrank | d\nsearch | e\nget_org_unit | f");

        assertThat(steps).hasSize(PlanParser.MAX_STEPS);
    }

    @Test
    @DisplayName("rỗng/null -> danh sách rỗng, không nổ")
    void emptyIsSafe() {
        assertThat(PlanParser.parse(null)).isEmpty();
        assertThat(PlanParser.parse("   \n  ")).isEmpty();
    }
}
