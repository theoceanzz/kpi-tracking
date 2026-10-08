package com.kpitracking.service.approvalprocess;

import com.kpitracking.service.approvalprocess.ProcessGraph.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Dựng sơ đồ mẫu cho test: thêm node / cạnh theo thứ tự, id do người viết test đặt. */
final class Graphs {

    private final List<Node> nodes = new ArrayList<>();
    private final List<Edge> edges = new ArrayList<>();

    static Graphs graph() {
        return new Graphs().start("start");
    }

    Graphs start(String id) {
        nodes.add(new Node(id, NodeType.START, 0d, 0d, null, null, null));
        return this;
    }

    Graphs condition(String id, double y, ConditionRule... rules) {
        nodes.add(new Node(id, NodeType.CONDITION, 100d, y, "Điều kiện " + id,
                List.of(new ConditionGroup(List.of(rules))), null));
        return this;
    }

    Graphs step(String id, double y, ApproverSpec... approvers) {
        nodes.add(new Node(id, NodeType.STEP, 200d, y, "Bước " + id, null, List.of(approvers)));
        return this;
    }

    Graphs approved(String id) {
        nodes.add(new Node(id, NodeType.APPROVED, 400d, 0d, null, null, null));
        return this;
    }

    Graphs rejected(String id) {
        nodes.add(new Node(id, NodeType.REJECTED, 400d, 200d, null, null, null));
        return this;
    }

    Graphs link(String from, String to, Branch branch) {
        edges.add(new Edge(from + "-" + to, from, to, branch));
        return this;
    }

    Graphs next(String from, String to) {
        return link(from, to, Branch.NEXT);
    }

    ProcessGraph build() {
        return new ProcessGraph(ProcessGraph.SCHEMA_VERSION, List.copyOf(nodes), List.copyOf(edges));
    }

    static ApproverSpec user(UUID id) {
        return new ApproverSpec(ApproverType.USER, id, null, null, null);
    }

    static ApproverSpec role(UUID id) {
        return new ApproverSpec(ApproverType.ROLE, null, id, null, null);
    }

    static ApproverSpec unitHead(UUID id) {
        return new ApproverSpec(ApproverType.ORG_UNIT_HEAD, null, null, id, null);
    }

    static ApproverSpec manager(int levelsUp) {
        return new ApproverSpec(ApproverType.REQUESTER_MANAGER, null, null, null, levelsUp);
    }

    static ConditionRule rule(ConditionField field, ConditionOperator op, String... values) {
        return new ConditionRule(field, op, List.of(values));
    }
}
