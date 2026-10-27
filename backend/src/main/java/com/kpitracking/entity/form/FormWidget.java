package com.kpitracking.entity.form;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.kpitracking.enums.WidgetType;
import lombok.Builder;

import java.util.List;

/**
 * Một widget của form đơn từ. Một record phẳng cho mọi loại: trường nào không áp cho loại đó thì null.
 *
 * @param defaultValue giá trị điền sẵn phía giao diện: chữ / số, id phương án (Chọn một), danh sách id
 *                     (Chọn nhiều), {@code "TODAY"} (Ngày), {@code "ME"} (Liên hệ), {@code "MY_UNIT"} (Phòng ban)
 * @param content      chữ tĩnh của widget Mô tả
 * @param expression   công thức: {@code {id}} trỏ widget số đứng trước, {@code SUM({bảng.cột})} cộng một cột bảng
 * @param display      Chọn một: {@code DROPDOWN} | {@code LIST}
 * @param dateFormat   {@code DATE} | {@code DATETIME}
 * @param durationUnit Khoảng ngày: {@code DAY} | {@code HOUR}
 * @param children     cột của Chi tiết/Bảng
 * @param maxCount     số tệp tối đa (Ảnh, Tệp)
 * @param multiple     Liên hệ / Phòng ban: chọn nhiều
 */
@Builder(toBuilder = true)
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record FormWidget(
        String id,
        WidgetType type,
        String title,
        String placeholder,
        Boolean required,
        Object defaultValue,
        Integer maxLength,
        String content,
        Integer decimals,
        String unit,
        Double min,
        Double max,
        String currency,
        String expression,
        List<FormOption> options,
        String display,
        String dateFormat,
        Boolean showDuration,
        String durationUnit,
        String durationLabel,
        List<FormWidget> children,
        String addLabel,
        Boolean showTotal,
        Integer maxCount,
        Boolean multiple,
        List<VisibilityRule> visibility) {

    public static final String DATETIME = "DATETIME";
    public static final String HOUR = "HOUR";

    public boolean isRequired() {
        return Boolean.TRUE.equals(required);
    }

    public boolean isMultiple() {
        return Boolean.TRUE.equals(multiple);
    }

    public boolean withTime() {
        return DATETIME.equals(dateFormat);
    }

    public List<FormOption> optionsOrEmpty() {
        return options == null ? List.of() : options;
    }

    public List<FormWidget> childrenOrEmpty() {
        return children == null ? List.of() : children;
    }

    public List<VisibilityRule> visibilityOrEmpty() {
        return visibility == null ? List.of() : visibility;
    }
}
