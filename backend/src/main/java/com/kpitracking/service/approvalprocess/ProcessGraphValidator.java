package com.kpitracking.service.approvalprocess;

import com.kpitracking.enums.approvalprocess.ApprovalObjectType;
import com.kpitracking.service.approvalprocess.ProcessGraph.*;

import java.math.BigDecimal;
import java.util.*;

/**
 * Kiểm sơ đồ quy trình trước khi lưu — thuần logic. Lỗi chặn lưu; cảnh báo chỉ để admin biết.
 * Giao diện chạy cùng bộ luật này ({@code processGraphModel.validate}) để báo ngay trên khung vẽ;
 * đây là bản có hiệu lực.
 *
 * <p>Mỗi vấn đề mang key dịch {@code approvalProcess.graph.*} và id node/cạnh để giao diện tô đỏ.
 */
public final class ProcessGraphValidator {

    public static final int MAX_NAME_LENGTH = 255;
    public static final int MAX_ID_LENGTH = 64;
    public static final int MAX_LEVELS_UP = 3;

    private ProcessGraphValidator() {}

    public record Issue(String nodeId, String edgeId, String key, List<Object> args) {
        static Issue node(String nodeId, String key, Object... args) {
            return new Issue(nodeId, null, "approvalProcess.graph." + key, List.of(args));
        }

        static Issue edge(String edgeId, String key, Object... args) {
            return new Issue(null, edgeId, "approvalProcess.graph." + key, List.of(args));
        }

        static Issue graph(String key, Object... args) {
            return new Issue(null, null, "approvalProcess.graph." + key, List.of(args));
        }
    }

    public record Result(List<Issue> errors, List<Issue> warnings) {
        public boolean valid() {
            return errors.isEmpty();
        }
    }

    public static Result validate(ProcessGraph graph, ApprovalObjectType objectType) {
        return validate(graph, objectType, null);
    }

    /** @param form widget của đơn từ (chỉ khi kiểm sơ đồ của một đơn); null với quy trình thường */
    public static Result validate(ProcessGraph graph, ApprovalObjectType objectType, FormFieldIndex form) {
        List<Issue> errors = new ArrayList<>();
        List<Issue> warnings = new ArrayList<>();
        if (graph == null || graph.nodesOrEmpty().isEmpty()) {
            errors.add(Issue.graph("empty"));
            return new Result(errors, warnings);
        }
        List<Node> nodes = graph.nodesOrEmpty();
        if (nodes.size() > ProcessGraph.MAX_NODES) {
            errors.add(Issue.graph("tooManyNodes", ProcessGraph.MAX_NODES));
            return new Result(errors, warnings);
        }

        // ── Định danh ──
        Set<String> ids = new HashSet<>();
        for (Node n : nodes) {
            if (n == null || n.id() == null || n.id().isBlank() || n.id().length() > MAX_ID_LENGTH || n.type() == null) {
                errors.add(Issue.graph("badNode"));
                return new Result(errors, warnings);
            }
            if (!ids.add(n.id())) {
                errors.add(Issue.node(n.id(), "duplicateId"));
                return new Result(errors, warnings);
            }
        }
        for (Edge e : graph.edgesOrEmpty()) {
            if (e == null || e.branch() == null || !ids.contains(e.source()) || !ids.contains(e.target())) {
                errors.add(Issue.edge(e == null ? null : e.id(), "danglingEdge"));
                return new Result(errors, warnings);
            }
            if (e.source().equals(e.target())) {
                errors.add(Issue.edge(e.id(), "selfLoop"));
                return new Result(errors, warnings);
            }
        }

        // ── Bắt đầu ──
        long starts = nodes.stream().filter(n -> n.type() == NodeType.START).count();
        if (starts != 1) {
            errors.add(Issue.graph("startCount"));
            return new Result(errors, warnings);
        }

        Map<String, Node> byId = graph.byId();
        for (Node n : nodes) {
            List<Edge> out = graph.outgoing(n.id());
            switch (n.type()) {
                case START -> {
                    if (!graph.incoming(n.id()).isEmpty()) errors.add(Issue.node(n.id(), "startHasIncoming"));
                    if (out.size() != 1 || out.get(0).branch() != Branch.NEXT) {
                        errors.add(Issue.node(n.id(), "startNeedsOneNext"));
                    }
                }
                case CONDITION -> validateCondition(n, out, objectType, form, errors);
                case STEP -> validateStep(n, out, byId, errors, warnings);
                case APPROVED, REJECTED -> {
                    if (!out.isEmpty()) errors.add(Issue.node(n.id(), "endHasOutgoing"));
                }
            }
            if (n.type() == NodeType.REJECTED) {
                for (Edge in : graph.incoming(n.id())) {
                    if (in.branch() != Branch.REJECT) errors.add(Issue.edge(in.id(), "rejectedOnlyFromStep"));
                }
            }
            if (n.name() != null && n.name().length() > MAX_NAME_LENGTH) {
                errors.add(Issue.node(n.id(), "nameTooLong", MAX_NAME_LENGTH));
            }
        }

        if (graph.topologicalOrder().isEmpty()) {
            errors.add(Issue.graph("cycle"));
        } else if (approvedWithoutStep(graph, byId)) {
            errors.add(Issue.graph("approvedWithoutStep"));
        }

        Set<String> reach = graph.reachable();
        for (Node n : nodes) {
            if (!reach.contains(n.id())) warnings.add(Issue.node(n.id(), "unreachable"));
        }
        if (graph.stepCount() == 0) errors.add(Issue.graph("noStep"));
        return new Result(errors, warnings);
    }

    private static void validateCondition(Node n, List<Edge> out, ApprovalObjectType objectType, FormFieldIndex form,
                                          List<Issue> errors) {
        long yes = out.stream().filter(e -> e.branch() == Branch.YES).count();
        long no = out.stream().filter(e -> e.branch() == Branch.NO).count();
        if (yes != 1) errors.add(Issue.node(n.id(), "conditionNeedsYes"));
        if (no != 1) errors.add(Issue.node(n.id(), "conditionNeedsNo"));
        if (out.stream().anyMatch(e -> e.branch() != Branch.YES && e.branch() != Branch.NO)) {
            errors.add(Issue.node(n.id(), "conditionBadBranch"));
        }

        List<ConditionRule> rules = n.groupsOrEmpty().stream().flatMap(g -> g.rulesOrEmpty().stream()).toList();
        if (rules.isEmpty()) {
            errors.add(Issue.node(n.id(), "conditionEmpty"));
            return;
        }
        for (ConditionGroup g : n.groupsOrEmpty()) {
            if (g.rulesOrEmpty().isEmpty()) errors.add(Issue.node(n.id(), "conditionEmptyGroup"));
        }
        for (ConditionRule r : rules) {
            if (r.field() == null || r.operator() == null) {
                errors.add(Issue.node(n.id(), "ruleIncomplete"));
                continue;
            }
            if (objectType != null && !r.field().appliesTo(objectType)) {
                errors.add(Issue.node(n.id(), "ruleFieldNotForObject"));
                continue;
            }
            if (!r.field().operators().contains(r.operator())) {
                errors.add(Issue.node(n.id(), "ruleBadOperator"));
                continue;
            }
            if (r.operator().unary()) continue;
            List<String> values = r.valuesOrEmpty().stream().filter(v -> v != null && !v.isBlank()).toList();
            if (values.isEmpty()) {
                errors.add(Issue.node(n.id(), "ruleMissingValue"));
                continue;
            }
            if (r.field().formWidget()) {
                validateFormRule(n, r, values, form, errors);
                continue;
            }
            switch (r.field().valueType()) {
                case NUMBER -> {
                    if (values.size() != 1 || parseNumber(values.get(0)) == null) {
                        errors.add(Issue.node(n.id(), "ruleBadNumber"));
                    }
                }
                case ENUM -> {
                    if (!r.field().options().containsAll(values)) errors.add(Issue.node(n.id(), "ruleBadValue"));
                }
                case ORG_UNIT, ORG_LEVEL, USER, ROLE, PERIOD -> {
                    if (values.stream().anyMatch(v -> parseUuid(v) == null)) {
                        errors.add(Issue.node(n.id(), "ruleBadValue"));
                    }
                }
                case BOOLEAN -> { }
            }
        }
    }

    /** Điều kiện theo widget của đơn từ: widget còn tồn tại, đúng loại, phương án thuộc widget. */
    private static void validateFormRule(Node n, ConditionRule r, List<String> values, FormFieldIndex form,
                                         List<Issue> errors) {
        String widget = r.widget();
        if (r.field() == ConditionField.FORM_NUMBER) {
            if (form == null || widget == null || !form.numbers().contains(widget)) {
                errors.add(Issue.node(n.id(), "ruleWidgetMissing"));
            } else if (values.size() != 1 || parseNumber(values.get(0)) == null) {
                errors.add(Issue.node(n.id(), "ruleBadNumber"));
            }
            return;
        }
        Set<String> options = form == null || widget == null ? null : form.options().get(widget);
        if (options == null) {
            errors.add(Issue.node(n.id(), "ruleWidgetMissing"));
        } else if (!options.containsAll(values)) {
            errors.add(Issue.node(n.id(), "ruleBadValue"));
        }
    }

    private static void validateStep(Node n, List<Edge> out, Map<String, Node> byId,
                                     List<Issue> errors, List<Issue> warnings) {
        if (n.name() == null || n.name().isBlank()) errors.add(Issue.node(n.id(), "stepNoName"));
        if (n.approversOrEmpty().isEmpty()) {
            errors.add(Issue.node(n.id(), "stepNoApprover"));
        }
        for (ApproverSpec a : n.approversOrEmpty()) {
            if (!validApprover(a)) {
                errors.add(Issue.node(n.id(), "stepBadApprover"));
                break;
            }
        }
        long next = out.stream().filter(e -> e.branch() == Branch.NEXT).count();
        long reject = out.stream().filter(e -> e.branch() == Branch.REJECT).count();
        if (next > 1) errors.add(Issue.node(n.id(), "stepManyNext"));
        if (reject > 1) errors.add(Issue.node(n.id(), "stepManyReject"));
        if (out.stream().anyMatch(e -> e.branch() == Branch.YES || e.branch() == Branch.NO)) {
            errors.add(Issue.node(n.id(), "stepBadBranch"));
        }
        for (Edge e : out) {
            Node target = byId.get(e.target());
            if (e.branch() == Branch.REJECT && (target == null || target.type() != NodeType.REJECTED)) {
                errors.add(Issue.edge(e.id(), "rejectEdgeTarget"));
            }
        }
        if (next == 0) warnings.add(Issue.node(n.id(), "stepImplicitApproved"));
    }

    private static boolean validApprover(ApproverSpec a) {
        if (a == null || a.type() == null) return false;
        return switch (a.type()) {
            case USER -> a.userId() != null;
            case ROLE -> a.roleId() != null;
            case ORG_UNIT_HEAD -> a.orgUnitId() != null;
            case REQUESTER_MANAGER -> a.levelsUp() == null || (a.levelsUp() >= 0 && a.levelsUp() <= MAX_LEVELS_UP);
        };
    }

    /**
     * Có đường nào từ Bắt đầu tới Đã duyệt mà không qua bước duyệt nào không (tức là tự duyệt theo
     * điều kiện) — không cho phép.
     */
    private static boolean approvedWithoutStep(ProcessGraph graph, Map<String, Node> byId) {
        Deque<String> stack = new ArrayDeque<>();
        Set<String> seen = new HashSet<>();
        graph.start().ifPresent(s -> stack.push(s.id()));
        while (!stack.isEmpty()) {
            String id = stack.pop();
            if (!seen.add(id)) continue;
            Node n = byId.get(id);
            if (n == null || n.type() == NodeType.STEP) continue;
            if (n.type() == NodeType.APPROVED) return true;
            for (Edge e : graph.outgoing(id)) stack.push(e.target());
        }
        return false;
    }

    static BigDecimal parseNumber(String raw) {
        if (raw == null) return null;
        try {
            return new BigDecimal(raw.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    static UUID parseUuid(String raw) {
        if (raw == null) return null;
        try {
            return UUID.fromString(raw.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
