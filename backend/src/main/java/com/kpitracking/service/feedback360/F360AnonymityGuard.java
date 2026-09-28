package com.kpitracking.service.feedback360;

import com.kpitracking.dto.response.feedback360.F360ResultSnapshot;
import com.kpitracking.enums.F360Relationship;

import java.util.*;

/**
 * Nơi DUY NHẤT quyết định nhóm người chấm nào được hiện trên báo cáo 360 (§6.1).
 *
 * <ol>
 *   <li>{@code SELF} và {@code MANAGER} (khi không bật ẩn danh cấp trên) là nhóm có tên, hiện
 *       riêng khi có phiếu.</li>
 *   <li>Mỗi nhóm ẩn danh có ≥ k phiếu đã nộp thì hiện riêng.</li>
 *   <li>Các nhóm ẩn danh dưới ngưỡng được GỘP thành "Người khác"; nhóm gộp vẫn dưới ngưỡng thì
 *       bị ẩn hoàn toàn.</li>
 * </ol>
 *
 * Nhóm bị ẩn không đóng góp vào BẤT KỲ con số nào (kể cả điểm tổng) — {@link F360ScoreCalculator}
 * chỉ đọc các nhóm {@code visible}. Nhờ vậy không cần luật "chống trừ ngược" riêng: không có tổng
 * nào chứa dữ liệu bị ẩn để mà trừ.
 *
 * Thuần hàm, không đụng DB.
 */
public final class F360AnonymityGuard {

    private F360AnonymityGuard() {}

    public static final String MERGED_KEY = "OTHERS";
    public static final String MERGED_LABEL = "Người khác";

    /** Kế hoạch nhóm: danh sách nhóm hiển thị + quan hệ nào thuộc nhóm nào. */
    public record Plan(List<F360ResultSnapshot.Group> groups, Map<F360Relationship, String> groupOf) {

        public F360ResultSnapshot.Group group(String key) {
            return groups.stream().filter(g -> g.getKey().equals(key)).findFirst().orElse(null);
        }

        /** Khoá nhóm HIỆN chứa quan hệ này; null nếu quan hệ bị ẩn hoặc không có phiếu. */
        public String visibleGroupOf(F360Relationship r) {
            String key = groupOf.get(r);
            if (key == null) return null;
            F360ResultSnapshot.Group g = group(key);
            return g != null && Boolean.TRUE.equals(g.getVisible()) ? key : null;
        }

        public boolean isAnonymous(String key) {
            F360ResultSnapshot.Group g = group(key);
            return g != null && Boolean.TRUE.equals(g.getAnonymous());
        }
    }

    /** Nhóm này có được bảo vệ ẩn danh không. */
    public static boolean isAnonymousRelationship(F360Relationship r, boolean managerAnonymous) {
        return switch (r) {
            case SELF -> false;
            case MANAGER -> managerAnonymous;
            case PEER, DIRECT_REPORT, OTHER -> true;
        };
    }

    /**
     * @param submitted số phiếu ĐÃ NỘP theo quan hệ
     * @param k         ngưỡng ẩn danh
     * @param weights   trọng số theo quan hệ
     */
    public static Plan plan(Map<F360Relationship, Integer> submitted, int k, boolean managerAnonymous,
                            Map<F360Relationship, Double> weights) {
        List<F360ResultSnapshot.Group> groups = new ArrayList<>();
        Map<F360Relationship, String> groupOf = new EnumMap<>(F360Relationship.class);
        List<F360Relationship> belowThreshold = new ArrayList<>();

        for (F360Relationship r : F360Relationship.values()) {
            int n = submitted.getOrDefault(r, 0);
            if (n <= 0) continue;
            boolean anonymous = isAnonymousRelationship(r, managerAnonymous);
            if (!anonymous || n >= k) {
                groups.add(F360ResultSnapshot.Group.builder()
                        .key(r.name())
                        .label(r.label())
                        .relationships(new ArrayList<>(List.of(r.name())))
                        .raterCount(n)
                        .visible(true)
                        .anonymous(anonymous)
                        .weight(weights.getOrDefault(r, 0.0))
                        .build());
                groupOf.put(r, r.name());
            } else {
                belowThreshold.add(r);
            }
        }

        if (!belowThreshold.isEmpty()) {
            int total = belowThreshold.stream().mapToInt(r -> submitted.getOrDefault(r, 0)).sum();
            double weight = belowThreshold.stream().mapToDouble(r -> weights.getOrDefault(r, 0.0)).sum();
            groups.add(F360ResultSnapshot.Group.builder()
                    .key(MERGED_KEY)
                    .label(com.kpitracking.i18n.ErrorMessages.text("f360.relationship.MERGED", MERGED_LABEL))
                    .relationships(new ArrayList<>(belowThreshold.stream().map(Enum::name).toList()))
                    .raterCount(total)
                    .visible(total >= k)
                    .anonymous(true)
                    .weight(weight)
                    .build());
            belowThreshold.forEach(r -> groupOf.put(r, MERGED_KEY));
        }
        return new Plan(groups, groupOf);
    }

    /**
     * Ô (nhóm × câu hỏi) có được hiện điểm không: nhóm ẩn danh cần ≥ k câu trả lời có điểm cho
     * riêng câu đó — nhiều người chọn "Không đánh giá được" có thể kéo một câu xuống dưới ngưỡng
     * dù cả nhóm đủ người.
     */
    public static boolean cellVisible(boolean anonymousGroup, int answeredCount, int k) {
        if (answeredCount <= 0) return false;
        return !anonymousGroup || answeredCount >= k;
    }
}
