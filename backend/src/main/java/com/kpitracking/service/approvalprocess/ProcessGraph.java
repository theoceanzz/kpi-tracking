package com.kpitracking.service.approvalprocess;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.*;

/**
 * Sơ đồ của một quy trình duyệt — đúng dạng lưu ở {@code approval_processes.definition} và dạng
 * giao diện gửi lên. Thuần dữ liệu + vài phép duyệt đồ thị, không đụng DB.
 *
 * <p>Ngữ nghĩa cạnh:
 * <ul>
 *   <li>{@code NEXT}: Bắt đầu → node đầu tiên; bước duyệt → node sau khi bước này duyệt.</li>
 *   <li>{@code YES} / {@code NO}: hai nhánh của một điều kiện.</li>
 *   <li>{@code REJECT}: bước duyệt → Không duyệt. Chỉ để vẽ — từ chối ở bước nào cũng kết thúc flow.</li>
 * </ul>
 * Bước duyệt không có cạnh {@code NEXT} thì duyệt xong là Đã duyệt.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ProcessGraph(Integer schemaVersion, List<Node> nodes, List<Edge> edges) {

    public static final int SCHEMA_VERSION = 1;
    public static final int MAX_NODES = 100;

    public enum NodeType { START, CONDITION, STEP, APPROVED, REJECTED }

    public enum Branch { NEXT, YES, NO, REJECT }

    public enum ApproverType {
        /** Người cụ thể. */
        USER,
        /** Chức vụ: người giữ vai trò này ở đơn vị gần nhất trên đường từ đơn vị của KPI lên gốc. */
        ROLE,
        /** Trưởng (rank 0) của một đơn vị cụ thể. */
        ORG_UNIT_HEAD,
        /** Trưởng trực tiếp của người gửi ({@code levelsUp = 0}), hoặc cấp trên n bậc. */
        REQUESTER_MANAGER
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Node(String id, NodeType type, Double x, Double y, String name,
                       List<ConditionGroup> groups, List<ApproverSpec> approvers) {
        public List<ConditionGroup> groupsOrEmpty() {
            return groups == null ? List.of() : groups;
        }

        public List<ApproverSpec> approversOrEmpty() {
            return approvers == null ? List.of() : approvers;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Edge(String id, String source, String target, Branch branch) {}

    /** Các dòng trong một nhóm phải thoả đồng thời (VÀ); giữa các nhóm là HOẶC. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ConditionGroup(List<ConditionRule> rules) {
        public List<ConditionRule> rulesOrEmpty() {
            return rules == null ? List.of() : rules;
        }
    }

    /** @param widget id widget của đơn từ — chỉ dùng với trường {@code FORM_*}, còn lại null */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ConditionRule(ConditionField field, ConditionOperator operator, List<String> values, String widget) {
        public ConditionRule(ConditionField field, ConditionOperator operator, List<String> values) {
            this(field, operator, values, null);
        }

        public List<String> valuesOrEmpty() {
            return values == null ? List.of() : values;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ApproverSpec(ApproverType type, UUID userId, UUID roleId, UUID orgUnitId, Integer levelsUp) {}

    // ── Truy vấn ────────────────────────────────────────────────────────────

    public List<Node> nodesOrEmpty() {
        return nodes == null ? List.of() : nodes;
    }

    public List<Edge> edgesOrEmpty() {
        return edges == null ? List.of() : edges;
    }

    public Map<String, Node> byId() {
        Map<String, Node> out = new LinkedHashMap<>();
        for (Node n : nodesOrEmpty()) {
            if (n != null && n.id() != null) out.putIfAbsent(n.id(), n);
        }
        return out;
    }

    public Optional<Node> start() {
        return nodesOrEmpty().stream().filter(n -> n != null && n.type() == NodeType.START).findFirst();
    }

    public List<Edge> outgoing(String nodeId) {
        return edgesOrEmpty().stream().filter(e -> e != null && Objects.equals(e.source(), nodeId)).toList();
    }

    public List<Edge> incoming(String nodeId) {
        return edgesOrEmpty().stream().filter(e -> e != null && Objects.equals(e.target(), nodeId)).toList();
    }

    public Optional<Edge> out(String nodeId, Branch branch) {
        return outgoing(nodeId).stream().filter(e -> e.branch() == branch).findFirst();
    }

    /** Id các node đi tới được từ Bắt đầu (kể cả Bắt đầu). */
    public Set<String> reachable() {
        Set<String> seen = new LinkedHashSet<>();
        Optional<Node> start = start();
        if (start.isEmpty()) return seen;
        Deque<String> stack = new ArrayDeque<>();
        stack.push(start.get().id());
        while (!stack.isEmpty()) {
            String id = stack.pop();
            if (!seen.add(id)) continue;
            for (Edge e : outgoing(id)) {
                if (e.target() != null && !seen.contains(e.target())) stack.push(e.target());
            }
        }
        return seen;
    }

    /**
     * Thứ tự topo của các node đi tới được; rỗng khi có vòng (phía gọi coi đó là lỗi).
     */
    public Optional<List<String>> topologicalOrder() {
        Set<String> reach = reachable();
        Map<String, Integer> indegree = new LinkedHashMap<>();
        reach.forEach(id -> indegree.put(id, 0));
        for (Edge e : edgesOrEmpty()) {
            if (e != null && reach.contains(e.source()) && reach.contains(e.target())) {
                indegree.merge(e.target(), 1, Integer::sum);
            }
        }
        Deque<String> ready = new ArrayDeque<>();
        indegree.forEach((id, d) -> { if (d == 0) ready.add(id); });
        List<String> order = new ArrayList<>();
        while (!ready.isEmpty()) {
            String id = ready.poll();
            order.add(id);
            for (Edge e : outgoing(id)) {
                if (!indegree.containsKey(e.target())) continue;
                int d = indegree.merge(e.target(), -1, Integer::sum);
                if (d == 0) ready.add(e.target());
            }
        }
        return order.size() == reach.size() ? Optional.of(order) : Optional.empty();
    }

    /**
     * Mã bước kiểu 1Office: cấp = số bước duyệt trên đường dài nhất từ Bắt đầu tới bước đó (tính
     * cả nó). Cấp chỉ có một bước thì mã là "2"; nhiều bước thì "2.1", "2.2"… theo vị trí trên sơ đồ
     * (trên xuống, trái sang). Giao diện tính đúng cách này để số trên khung vẽ khớp số trong chuỗi.
     */
    public Map<String, String> stepCodes() {
        Map<String, String> codes = new LinkedHashMap<>();
        Optional<List<String>> order = topologicalOrder();
        if (order.isEmpty()) return codes;
        Map<String, Node> byId = byId();
        Map<String, Integer> stepsBefore = new HashMap<>();
        for (String id : order.get()) {
            int before = 0;
            for (Edge e : incoming(id)) {
                Integer p = stepsBefore.get(e.source());
                if (p == null) continue;
                Node src = byId.get(e.source());
                before = Math.max(before, p + (src != null && src.type() == NodeType.STEP ? 1 : 0));
            }
            stepsBefore.put(id, before);
        }
        Map<Integer, List<Node>> byLevel = new TreeMap<>();
        for (String id : order.get()) {
            Node n = byId.get(id);
            if (n != null && n.type() == NodeType.STEP) {
                byLevel.computeIfAbsent(stepsBefore.get(id) + 1, k -> new ArrayList<>()).add(n);
            }
        }
        Comparator<Node> byPosition = Comparator
                .comparing((Node n) -> n.y() == null ? 0d : n.y())
                .thenComparing(n -> n.x() == null ? 0d : n.x())
                .thenComparing(Node::id);
        byLevel.forEach((level, nodesAtLevel) -> {
            if (nodesAtLevel.size() == 1) {
                codes.put(nodesAtLevel.get(0).id(), String.valueOf(level));
                return;
            }
            List<Node> sorted = new ArrayList<>(nodesAtLevel);
            sorted.sort(byPosition);
            for (int i = 0; i < sorted.size(); i++) {
                codes.put(sorted.get(i).id(), level + "." + (i + 1));
            }
        });
        return codes;
    }

    public long stepCount() {
        return nodesOrEmpty().stream().filter(n -> n != null && n.type() == NodeType.STEP).count();
    }
}
