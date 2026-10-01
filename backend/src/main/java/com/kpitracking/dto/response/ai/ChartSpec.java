package com.kpitracking.dto.response.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Một biểu đồ mà trợ lý đề nghị vẽ cho câu trả lời — do {@code ChartAgent} chọn, {@code ChartSpecValidator}
 * kiểm, client dựng bằng bộ biểu đồ có sẵn của KeyGo.
 *
 * <p>Đây là BẢN MÔ TẢ, không phải ảnh: client quyết định vẽ bằng component nào, nên biểu đồ trong chat
 * và biểu đồ trên màn hình dùng chung một bộ quy tắc trình bày (màu, tooltip, nhãn trục).
 *
 * <p>Màu đi bằng TOKEN ({@code series:0}, {@code success}…) chứ không phải mã hex: client giải token
 * theo bảng màu và theme (sáng/tối, màu chủ đạo tổ chức chọn). Model cho hex là hỏng ở chế độ tối.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_EMPTY)
@JsonIgnoreProperties(ignoreUnknown = true)
public class ChartSpec {

    /** Khoá duy nhất trong lượt, để client đặt key khi render. */
    private String id;

    /**
     * Loại biểu đồ, lấy trong từ vựng client dựng được:
     * {@code bar | groupedBar | stackedBar | stacked100 | lollipop | line | area | bullet | donut |
     * histogram | metricCards}.
     */
    private String type;

    /** Tiêu đề: nói ĐO CÁI GÌ, chữ đầu nói chiều so sánh (chuẩn biểu đồ của dự án). */
    private String title;

    /** Phạm vi số liệu: đơn vị + kỳ/đợt. */
    private String subtitle;

    /** Đơn vị của giá trị: "%", "điểm", "KPI", "người"… */
    private String unit;

    private String xLabel;
    private String yLabel;

    /** Tên trường chứa nhãn hạng mục trong {@link #data}. */
    private String categoryKey;

    /** Các chuỗi số liệu; mỗi chuỗi là một trường số trong {@link #data}. */
    private List<Series> series;

    /** Dữ liệu đã sẵn sàng vẽ — mọi số phải lấy từ kết quả tool của lượt. */
    private List<Map<String, Object>> data;

    /** Đường tham chiếu (vd mốc 100 %). */
    private Reference reference;

    /** {@code number | percent | score5 | currency} — client định dạng theo. */
    private String valueFormat;

    /** Bảng màu: {@code series | rating | achievement | status | metric}. */
    private String palette;

    /** Các hạng mục cần tô nhấn (theo giá trị của {@link #categoryKey}). */
    private List<String> highlight;

    /** Một câu diễn giải dưới biểu đồ; không lặp lại tiêu đề. */
    private String note;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_EMPTY)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Series {
        /** Tên trường số trong {@code data}. */
        private String key;
        /** Nhãn hiển thị trong chú giải. */
        private String label;
        /** Token màu: {@code series:0..7 | success | warning | error | info | primary | ai | neutral}. */
        private String color;
        /** Vai trò trong biểu đồ bullet: {@code actual | target | minimum}. */
        private String role;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_EMPTY)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Reference {
        private Double value;
        private String label;
    }
}
