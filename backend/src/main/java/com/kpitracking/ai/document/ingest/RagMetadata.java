package com.kpitracking.ai.document.ingest;

/**
 * Khoá metadata của mỗi đoạn trong kho vector (kho chỉ nhận String/số/UUID nên danh sách ghép bằng {@link #SEP}):
 * {@code docId, orgId, scope, source, docTitle, title, parent, order, images, captions, route, roles}
 * (+ {@code unitId}/{@code ownerId}/{@code category}/{@code version} với tài liệu của thư viện tài liệu).
 */
public final class RagMetadata {

    private RagMetadata() {}

    /** Giá trị {@code orgId} của tài liệu chung toàn hệ thống (bộ hướng dẫn KeyGo). */
    public static final String GLOBAL_ORG = "GLOBAL";
    public static final String SEP = "|";

    public static final String DOC_ID = "docId";
    public static final String ORG_ID = "orgId";
    public static final String SOURCE = "source";

    /**
     * Phạm vi của đoạn — BẮT BUỘC (docs/DOCUMENTS_DESIGN.md §6.2). Bộ lọc truy hồi là fail-closed: đoạn thiếu
     * {@code scope} không ai đọc được. {@code GLOBAL} | {@code COMPANY} | {@code UNIT} (kèm {@code unitId}) |
     * {@code PERSONAL} (kèm {@code ownerId}).
     */
    public static final String SCOPE = "scope";
    public static final String SCOPE_GLOBAL = "GLOBAL";
    public static final String SCOPE_COMPANY = "COMPANY";
    public static final String UNIT_ID = "unitId";
    public static final String OWNER_ID = "ownerId";

    /** Phạm vi cho tài liệu quản lý ở {@code rag_documents}: bộ hướng dẫn chung, hoặc tài liệu công ty. */
    public static String scopeForOrgKey(String orgKey) {
        return GLOBAL_ORG.equals(orgKey) ? SCOPE_GLOBAL : SCOPE_COMPANY;
    }

    /**
     * Chốt chặn fail-closed phía GHI: metadata thiếu phạm vi, hoặc phạm vi thiếu khoá đi kèm, thì không nạp —
     * vector như thế đằng nào cũng không ai truy hồi được, nạp vào chỉ tốn chỗ và gây nhầm khi đối chiếu.
     */
    public static void requireScope(java.util.Map<String, Object> m) {
        Object org = m.get(ORG_ID);
        Object scope = m.get(SCOPE);
        if (org == null || scope == null) throw new IllegalArgumentException("Metadata thiếu orgId/scope");
        boolean global = GLOBAL_ORG.equals(org.toString());
        boolean ok = switch (scope.toString()) {
            case SCOPE_GLOBAL -> global;
            case SCOPE_COMPANY -> !global;
            case "UNIT" -> !global && m.get(UNIT_ID) != null;
            case "PERSONAL" -> !global && m.get(OWNER_ID) != null;
            default -> false;
        };
        if (!ok) throw new IllegalArgumentException("Metadata phạm vi không hợp lệ: scope=" + scope);
    }
}
