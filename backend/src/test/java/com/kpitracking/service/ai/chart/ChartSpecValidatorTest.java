package com.kpitracking.service.ai.chart;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.ai.agent.ChartAgent;
import com.kpitracking.dto.response.ai.ChartSpec;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.agent.AgentState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Lưới an toàn của biểu đồ: hình dạng đúng, và mọi con số phải có trong kết quả tool của lượt.
 * Bịa số ở biểu đồ nguy hiểm hơn ở câu chữ — người xem tin ngay vào cột cao.
 */
class ChartSpecValidatorTest {

    private ChartSpecValidator validator;
    private ChartCandidateDetector detector;
    private AgentState state;

    @BeforeEach
    void setUp() {
        ObjectMapper mapper = new ObjectMapper();
        validator = new ChartSpecValidator(mapper);
        detector = new ChartCandidateDetector(mapper);
        state = new AgentState(new AiTurn("Xếp hạng các đơn vị con theo hiệu suất", null, null));
        state.recordPayload("rank", """
                {"scopeNote":"Số liệu của đơn vị Chi nhánh Hà Nội","rows":[
                  {"rank":1,"orgUnitName":"Phòng IT","score":82.4},
                  {"rank":2,"orgUnitName":"Phòng Truyền Thông","score":61}]}""");
    }

    private ChartSpec bar(Map<String, Object>... rows) {
        return ChartSpec.builder()
                .type("bar").title("Hiệu suất theo đơn vị").categoryKey("name")
                .series(List.of(ChartSpec.Series.builder().key("value").label("Hiệu suất").color("series:0").build()))
                .data(List.of(rows)).build();
    }

    @Test
    @DisplayName("số khớp payload -> giữ, và được đánh id để client render")
    @SuppressWarnings("unchecked")
    void keepsChartWhoseNumbersExist() {
        List<ChartSpec> out = validator.validate(List.of(
                bar(Map.of("name", "Phòng IT", "value", 82.4), Map.of("name", "Phòng Truyền Thông", "value", 61))), state);

        assertThat(out).hasSize(1);
        assertThat(out.get(0).getId()).isEqualTo("chart-1");
    }

    @Test
    @DisplayName("số KHÔNG có trong kết quả tool -> bỏ biểu đồ (thà mất biểu đồ còn hơn vẽ số bịa)")
    @SuppressWarnings("unchecked")
    void dropsChartWithInventedNumber() {
        List<ChartSpec> out = validator.validate(List.of(
                bar(Map.of("name", "Phòng IT", "value", 82.4), Map.of("name", "Phòng Truyền Thông", "value", 95))), state);

        assertThat(out).isEmpty();
    }

    @Test
    @DisplayName("làm tròn nhẹ và tỉ lệ 0..1 đổi sang % vẫn được chấp nhận")
    @SuppressWarnings("unchecked")
    void toleratesRoundingAndPercentScaling() {
        state.recordPayload("get_analytics", "{\"ratio\":0.734}");

        List<ChartSpec> out = validator.validate(List.of(
                bar(Map.of("name", "Phòng IT", "value", 82.4), Map.of("name", "Tỉ lệ", "value", 73.4))), state);

        assertThat(out).hasSize(1);
    }

    @Test
    @DisplayName("loại lạ, quá 12 hạng mục, quá 4 chuỗi, màu hex -> bỏ")
    @SuppressWarnings("unchecked")
    void rejectsShapeProblems() {
        ChartSpec weird = bar(Map.of("name", "Phòng IT", "value", 82.4));
        weird.setType("pyramid3d");
        ChartSpec hex = bar(Map.of("name", "Phòng IT", "value", 82.4));
        hex.getSeries().get(0).setColor("#ff0000");
        ChartSpec many = bar(Map.of("name", "Phòng IT", "value", 82.4));
        many.setData(java.util.stream.IntStream.range(0, 13)
                .mapToObj(i -> Map.<String, Object>of("name", "u" + i, "value", 82.4)).toList());

        assertThat(validator.validate(List.of(weird, hex, many), state)).isEmpty();
    }

    @Test
    @DisplayName("nhiều hơn 2 biểu đồ -> chỉ giữ 2 cái đầu")
    @SuppressWarnings("unchecked")
    void keepsAtMostTwo() {
        ChartSpec c = bar(Map.of("name", "Phòng IT", "value", 82.4));
        assertThat(validator.validate(List.of(c, c, c), state)).hasSize(2);
    }

    @Test
    @DisplayName("detector: có mảng ≥2 dòng có nhãn + số -> đáng vẽ; chỉ một con số -> không")
    void detectorGatesTheLlmCall() {
        assertThat(detector.hasCandidate(state)).isTrue();

        AgentState single = new AgentState(new AiTurn("Phòng IT có bao nhiêu người?", null, null));
        single.recordPayload("get_people", "{\"orgUnitName\":\"Phòng IT\",\"total\":8}");
        assertThat(detector.hasCandidate(single)).isFalse();
    }

    @Test
    @DisplayName("parse: bóc được mảng trong rào ```json và lời dẫn; rác -> rỗng")
    void parsesFencedJson() {
        List<ChartSpec> charts = ChartAgent.parse("""
                Đây là biểu đồ phù hợp:
                ```json
                [{"type":"bar","title":"Hiệu suất theo đơn vị","categoryKey":"name",
                  "series":[{"key":"value","label":"Hiệu suất"}],
                  "data":[{"name":"Phòng IT","value":82.4}]}]
                ```""");

        assertThat(charts).hasSize(1);
        assertThat(charts.get(0).getType()).isEqualTo("bar");
        assertThat(ChartAgent.parse("Tôi không vẽ được gì cả")).isEmpty();
        assertThat(ChartAgent.parse(null)).isEmpty();
    }
}
