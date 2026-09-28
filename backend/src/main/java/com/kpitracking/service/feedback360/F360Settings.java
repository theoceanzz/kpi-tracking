package com.kpitracking.service.feedback360;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.entity.F360Campaign;
import com.kpitracking.enums.F360Relationship;

import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Đọc/ghi ba cột JSON cấu hình của chiến dịch (trọng số nhóm, luật chọn người chấm, cấu hình báo
 * cáo) với giá trị mặc định cho từng khoá. Khoá thiếu hoặc JSON hỏng đều rơi về mặc định chứ không
 * làm hỏng cả chiến dịch.
 */
public final class F360Settings {

    private F360Settings() {}

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static final Map<F360Relationship, Double> DEFAULT_WEIGHTS = defaultWeights();

    public static final int DEFAULT_MAX_PEERS = 5;
    public static final int DEFAULT_MAX_DIRECT_REPORTS = 6;
    public static final int DEFAULT_MAX_ASSIGNMENTS_PER_RATER = 10;
    public static final int DEFAULT_MANAGER_WARN_THRESHOLD = 12;
    public static final int DEFAULT_MAX_NOMINEES = 5;
    public static final double DEFAULT_BLIND_SPOT_GAP = 1.0;
    public static final double DEFAULT_DISPERSION_FLAG = 1.2;

    private static Map<F360Relationship, Double> defaultWeights() {
        Map<F360Relationship, Double> m = new EnumMap<>(F360Relationship.class);
        m.put(F360Relationship.MANAGER, 40.0);
        m.put(F360Relationship.PEER, 30.0);
        m.put(F360Relationship.DIRECT_REPORT, 20.0);
        m.put(F360Relationship.OTHER, 10.0);
        m.put(F360Relationship.SELF, 0.0);
        return m;
    }

    /** Luật chọn người chấm của một chiến dịch. */
    public record RaterRules(int maxPeers, int maxDirectReports, int maxAssignmentsPerRater,
                             int managerWarnThreshold, int maxNominees) {

        public static RaterRules defaults() {
            return new RaterRules(DEFAULT_MAX_PEERS, DEFAULT_MAX_DIRECT_REPORTS, DEFAULT_MAX_ASSIGNMENTS_PER_RATER,
                    DEFAULT_MANAGER_WARN_THRESHOLD, DEFAULT_MAX_NOMINEES);
        }
    }

    /** Cấu hình báo cáo. */
    public record ReportSettings(double blindSpotGap, double dispersionFlag, boolean aiSummary) {}

    public static Map<F360Relationship, Double> weights(F360Campaign c) {
        Map<F360Relationship, Double> out = new EnumMap<>(DEFAULT_WEIGHTS);
        Map<String, Object> raw = read(c.getRelationshipWeights());
        for (F360Relationship r : F360Relationship.values()) {
            Double v = num(raw.get(r.name()));
            if (v != null && v >= 0) out.put(r, v);
        }
        return out;
    }

    public static RaterRules raterRules(F360Campaign c) {
        Map<String, Object> raw = read(c.getRaterRules());
        return new RaterRules(
                intOr(raw.get("maxPeers"), DEFAULT_MAX_PEERS),
                intOr(raw.get("maxDirectReports"), DEFAULT_MAX_DIRECT_REPORTS),
                intOr(raw.get("maxAssignmentsPerRater"), DEFAULT_MAX_ASSIGNMENTS_PER_RATER),
                intOr(raw.get("managerWarnThreshold"), DEFAULT_MANAGER_WARN_THRESHOLD),
                intOr(raw.get("maxNominees"), DEFAULT_MAX_NOMINEES));
    }

    public static ReportSettings reportSettings(F360Campaign c) {
        Map<String, Object> raw = read(c.getReportSettings());
        Double gap = num(raw.get("blindSpotGap"));
        Double disp = num(raw.get("dispersionFlag"));
        return new ReportSettings(
                gap != null && gap > 0 ? gap : DEFAULT_BLIND_SPOT_GAP,
                disp != null && disp > 0 ? disp : DEFAULT_DISPERSION_FLAG,
                Boolean.TRUE.equals(raw.get("aiSummary")));
    }

    public static String writeWeights(Map<F360Relationship, Double> weights) {
        Map<String, Double> m = new LinkedHashMap<>();
        for (F360Relationship r : F360Relationship.values()) {
            m.put(r.name(), weights.getOrDefault(r, DEFAULT_WEIGHTS.get(r)));
        }
        return write(m);
    }

    public static String writeRaterRules(RaterRules r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("maxPeers", r.maxPeers());
        m.put("maxDirectReports", r.maxDirectReports());
        m.put("minNominees", 0);
        m.put("maxNominees", r.maxNominees());
        m.put("maxAssignmentsPerRater", r.maxAssignmentsPerRater());
        m.put("managerWarnThreshold", r.managerWarnThreshold());
        return write(m);
    }

    public static String writeReportSettings(ReportSettings s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("blindSpotGap", s.blindSpotGap());
        m.put("dispersionFlag", s.dispersionFlag());
        m.put("aiSummary", s.aiSummary());
        return write(m);
    }

    public static String write(Object value) {
        try {
            return MAPPER.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException("Không ghi được cấu hình 360", e);
        }
    }

    private static Map<String, Object> read(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return MAPPER.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    private static Double num(Object v) {
        return v instanceof Number n ? n.doubleValue() : null;
    }

    private static int intOr(Object v, int fallback) {
        return v instanceof Number n && n.intValue() >= 0 ? n.intValue() : fallback;
    }
}
