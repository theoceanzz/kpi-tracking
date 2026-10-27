package com.kpitracking.service.approvalform;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import com.kpitracking.entity.form.FormSchema;
import com.kpitracking.entity.form.FormWidget;
import com.kpitracking.i18n.SupportedLanguages;
import com.kpitracking.service.approvalprocess.ConditionField;
import com.kpitracking.service.approvalprocess.ConditionOperator;
import com.kpitracking.service.approvalprocess.ProcessGraph;
import com.kpitracking.service.approvalprocess.ProcessGraph.*;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.*;

/**
 * Thư viện mẫu đơn ({@code resources/approval-forms/library.json}): danh mục, mẫu, nhóm dựng sẵn cho mỗi tổ chức.
 * Chữ trong tệp viết song ngữ — mọi object chỉ gồm khoá {@code vi}/{@code en} là một chữ cần dịch. Tên và mô tả
 * mẫu giữ nguyên song ngữ; form và quy trình thì trải ra theo MỘT ngôn ngữ lúc dùng (tiêu đề widget chỉ một ngôn ngữ).
 */
@Component
@RequiredArgsConstructor
public class ApprovalFormLibrary {

    private static final String RESOURCE = "approval-forms/library.json";
    private static final Map<String, String> STEP_DIRECT = Map.of("vi", "Quản lý trực tiếp", "en", "Direct manager");
    private static final Map<String, String> STEP_UPPER = Map.of("vi", "Quản lý cấp trên", "en", "Senior manager");

    private final ObjectMapper objectMapper;
    private volatile JsonNode root;

    public record Category(String code, Map<String, String> name) {}

    public record Preinstalled(String code, Map<String, String> name, List<String> templates) {}

    public record Template(String code, String category, boolean recommended, String icon, String color,
                           Map<String, String> name, Map<String, String> description, JsonNode widgets, JsonNode approval) {}

    public List<Category> categories() {
        List<Category> out = new ArrayList<>();
        for (JsonNode c : root().path("categories")) out.add(new Category(c.path("code").asText(), names(c.path("name"))));
        return out;
    }

    public List<Preinstalled> preinstalled() {
        List<Preinstalled> out = new ArrayList<>();
        for (JsonNode g : root().path("preinstalled")) {
            List<String> codes = new ArrayList<>();
            g.path("templates").forEach(t -> codes.add(t.asText()));
            out.add(new Preinstalled(g.path("code").asText(), names(g.path("name")), codes));
        }
        return out;
    }

    public List<Template> templates() {
        List<Template> out = new ArrayList<>();
        for (JsonNode t : root().path("templates")) {
            out.add(new Template(t.path("code").asText(), t.path("category").asText(), t.path("recommended").asBoolean(false),
                    t.path("icon").asText(), t.path("color").asText(), names(t.path("name")), names(t.path("description")),
                    t.path("widgets"), t.path("approval")));
        }
        return out;
    }

    public Optional<Template> template(String code) {
        return templates().stream().filter(t -> t.code().equals(code)).findFirst();
    }

    /** Form của mẫu, chữ theo {@code language}. */
    public FormSchema schema(Template t, String language) {
        JsonNode widgets = localize(t.widgets(), language);
        List<FormWidget> list = new ArrayList<>();
        for (JsonNode w : widgets) list.add(objectMapper.convertValue(w, FormWidget.class));
        return new FormSchema(list);
    }

    /**
     * Quy trình mặc định của mẫu — chỉ dùng người duyệt tương đối nên áp được cho mọi tổ chức:
     * Bắt đầu → Quản lý trực tiếp → [điều kiện của mẫu → Quản lý cấp trên] → Đã duyệt.
     */
    public ProcessGraph process(Template t, String language) {
        List<Node> nodes = new ArrayList<>();
        List<Edge> edges = new ArrayList<>();
        nodes.add(new Node("start", NodeType.START, 0d, 0d, null, null, null));
        nodes.add(step("step_direct", 180d, 0d, pick(STEP_DIRECT, language), 0));
        edges.add(new Edge("e_start", "start", "step_direct", Branch.NEXT));

        JsonNode rule = t.approval().path("rule");
        if (rule.isMissingNode() || rule.isNull()) {
            nodes.add(new Node("approved", NodeType.APPROVED, 360d, 0d, null, null, null));
            edges.add(new Edge("e_direct", "step_direct", "approved", Branch.NEXT));
            return new ProcessGraph(ProcessGraph.SCHEMA_VERSION, nodes, edges);
        }

        List<String> values = new ArrayList<>();
        rule.path("values").forEach(v -> values.add(v.asText()));
        ConditionRule condition = new ConditionRule(ConditionField.valueOf(rule.path("field").asText()),
                ConditionOperator.valueOf(rule.path("operator").asText()), values, rule.path("widget").asText());
        String conditionName = pick(names(t.approval().path("conditionName")), language);
        nodes.add(new Node("cond", NodeType.CONDITION, 360d, 0d, conditionName,
                List.of(new ConditionGroup(List.of(condition))), null));
        nodes.add(step("step_upper", 540d, 0d, pick(STEP_UPPER, language), 1));
        nodes.add(new Node("approved", NodeType.APPROVED, 720d, 0d, null, null, null));
        nodes.add(new Node("approved_no", NodeType.APPROVED, 540d, 160d, null, null, null));
        edges.add(new Edge("e_direct", "step_direct", "cond", Branch.NEXT));
        edges.add(new Edge("e_yes", "cond", "step_upper", Branch.YES));
        edges.add(new Edge("e_no", "cond", "approved_no", Branch.NO));
        edges.add(new Edge("e_upper", "step_upper", "approved", Branch.NEXT));
        return new ProcessGraph(ProcessGraph.SCHEMA_VERSION, nodes, edges);
    }

    /** {@code {"vi": …, "en": …}} → chữ theo ngôn ngữ, thiếu thì lấy bản còn lại. */
    public static String pick(Map<String, String> names, String language) {
        if (names == null || names.isEmpty()) return null;
        String v = names.get(language);
        if (v != null && !v.isBlank()) return v;
        String fallback = names.get(SupportedLanguages.DEFAULT);
        if (fallback != null && !fallback.isBlank()) return fallback;
        return names.values().stream().filter(s -> s != null && !s.isBlank()).findFirst().orElse(null);
    }

    // ── Nội bộ ──────────────────────────────────────────────────────────────

    private static Node step(String id, double x, double y, String name, int levelsUp) {
        return new Node(id, NodeType.STEP, x, y, name, null,
                List.of(new ApproverSpec(ApproverType.REQUESTER_MANAGER, null, null, null, levelsUp)));
    }

    /** Thay mọi object song ngữ bằng chữ của một ngôn ngữ. */
    private static JsonNode localize(JsonNode node, String language) {
        if (isLocalized(node)) {
            Map<String, String> m = new HashMap<>();
            node.fields().forEachRemaining(e -> m.put(e.getKey(), e.getValue().asText()));
            return TextNode.valueOf(pick(m, language));
        }
        if (node instanceof ObjectNode obj) {
            ObjectNode out = obj.objectNode();
            obj.fields().forEachRemaining(e -> out.set(e.getKey(), localize(e.getValue(), language)));
            return out;
        }
        if (node instanceof ArrayNode arr) {
            ArrayNode out = arr.arrayNode();
            arr.forEach(n -> out.add(localize(n, language)));
            return out;
        }
        return node;
    }

    private static boolean isLocalized(JsonNode node) {
        if (!node.isObject() || node.isEmpty()) return false;
        Iterator<Map.Entry<String, JsonNode>> it = node.fields();
        while (it.hasNext()) {
            Map.Entry<String, JsonNode> e = it.next();
            if (!SupportedLanguages.ALL.contains(e.getKey()) || !e.getValue().isTextual()) return false;
        }
        return true;
    }

    private static Map<String, String> names(JsonNode node) {
        Map<String, String> out = new LinkedHashMap<>();
        if (node != null && node.isObject()) node.fields().forEachRemaining(e -> out.put(e.getKey(), e.getValue().asText()));
        return out;
    }

    private JsonNode root() {
        JsonNode r = root;
        if (r == null) {
            try (InputStream in = new ClassPathResource(RESOURCE).getInputStream()) {
                r = objectMapper.readTree(in);
            } catch (IOException e) {
                throw new UncheckedIOException("Cannot read " + RESOURCE, e);
            }
            root = r;
        }
        return r;
    }
}
