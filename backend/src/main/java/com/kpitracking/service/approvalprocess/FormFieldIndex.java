package com.kpitracking.service.approvalprocess;

import java.util.Map;
import java.util.Set;

/**
 * Widget của một đơn từ mà điều kiện duyệt đọc được — để kiểm sơ đồ của đơn: điều kiện {@code FORM_NUMBER}
 * phải trỏ widget số còn tồn tại, {@code FORM_OPTION} trỏ widget chọn và chỉ dùng phương án của widget đó.
 *
 * @param numbers id các widget số (Số, Tiền, Công thức, Khoảng ngày)
 * @param options id widget chọn → id các phương án của nó
 */
public record FormFieldIndex(Set<String> numbers, Map<String, Set<String>> options) {}
