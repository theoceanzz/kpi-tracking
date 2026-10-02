package com.kpitracking.service.document;

import com.kpitracking.ai.document.ingest.RagMetadata;
import com.kpitracking.entity.Document;
import com.kpitracking.enums.DocumentScope;
import dev.langchain4j.store.embedding.filter.Filter;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static dev.langchain4j.store.embedding.filter.MetadataFilterBuilder.metadataKey;

/**
 * Ai đang hỏi được đọc/sửa tài liệu nào — tính MỘT lần bởi {@link DocumentAccessResolver} và dùng cho CẢ
 * màn danh sách ({@link #toSpecification()}) LẪN bộ lọc kho vector ({@link #toVectorFilter}). Hai nơi
 * không bao giờ tự tính quyền riêng (docs/DOCUMENTS_DESIGN.md §6.1).
 *
 * @param member             có vai trò trong tổ chức này không; {@code false} thì không thấy gì của tổ chức
 * @param visibleUnitIds     đơn vị mà tài liệu {@code UNIT} của nó đọc được: tổ tiên + chính đơn vị mình là
 *                           thành viên, cộng cây con của đơn vị mình quản lý
 * @param manageableUnitIds  đơn vị mà mình sửa được tài liệu {@code UNIT}: cây con của nơi có {@code DOCUMENT:MANAGE_UNIT}
 * @param liveUnitIds        mọi đơn vị còn sống của tổ chức — tài liệu của đơn vị đã xoá là "mồ côi"
 * @param sharedDocIds       tài liệu được CHIA SẺ cho người này (trực tiếp, hoặc cho đơn vị của họ): chỉ XEM
 */
public record DocumentAccess(
        UUID orgId,
        UUID userId,
        boolean member,
        Set<UUID> visibleUnitIds,
        Set<UUID> manageableUnitIds,
        Set<UUID> liveUnitIds,
        boolean canManageCompany,
        boolean canUploadPersonal,
        Set<UUID> sharedDocIds) {

    /** Chưa tính phần chia sẻ (test, hoặc trước khi resolver nạp chia sẻ). */
    public DocumentAccess(UUID orgId, UUID userId, boolean member, Set<UUID> visibleUnitIds, Set<UUID> manageableUnitIds,
                          Set<UUID> liveUnitIds, boolean canManageCompany, boolean canUploadPersonal) {
        this(orgId, userId, member, visibleUnitIds, manageableUnitIds, liveUnitIds, canManageCompany, canUploadPersonal,
                Set.of());
    }

    /** Bản sao kèm danh sách tài liệu được chia sẻ. */
    public DocumentAccess withShared(Set<UUID> shared) {
        return new DocumentAccess(orgId, userId, member, visibleUnitIds, manageableUnitIds, liveUnitIds,
                canManageCompany, canUploadPersonal, Set.copyOf(shared));
    }

    /** Giá trị {@code orgId}/{@code scope} của bộ hướng dẫn chung trong kho vector. */
    public static final String GLOBAL = RagMetadata.GLOBAL_ORG;

    // Một nguồn cho tên khoá metadata: RagMetadata của đường nạp.
    public static final String KEY_ORG = RagMetadata.ORG_ID;
    public static final String KEY_SCOPE = RagMetadata.SCOPE;
    public static final String KEY_UNIT = RagMetadata.UNIT_ID;
    public static final String KEY_OWNER = RagMetadata.OWNER_ID;

    /** Không biết là ai → không đọc gì của tổ chức nào. */
    public static DocumentAccess none(UUID orgId, UUID userId) {
        return new DocumentAccess(orgId, userId, false, Set.of(), Set.of(), Set.of(), false, false, Set.of());
    }

    // ── Kiểm trên một tài liệu cụ thể ───────────────────────────────────────────────────────────

    public boolean canView(Document d) {
        if (!member || d == null || !orgId.equals(d.getOrganizationId())) return false;
        if (d.getId() != null && sharedDocIds.contains(d.getId())) return true;
        return switch (d.getScope()) {
            case COMPANY -> true;
            case PERSONAL -> userId.equals(d.getOwnerUserId());
            case UNIT -> visibleUnitIds.contains(d.getOrgUnitId()) || (canManageCompany && isOrphan(d));
        };
    }

    /** Xem được nhờ được chia sẻ, KHÔNG nhờ phạm vi — giao diện hiện "Được chia sẻ với bạn". */
    public boolean isSharedWithMe(Document d) {
        return d != null && d.getId() != null && sharedDocIds.contains(d.getId()) && !canEdit(d)
                && !(d.getScope() == DocumentScope.PERSONAL && userId.equals(d.getOwnerUserId()));
    }

    /** Sửa được: CHỈ theo phạm vi — được chia sẻ chỉ cho quyền xem. */
    public boolean canEdit(Document d) {
        if (!member || d == null || !orgId.equals(d.getOrganizationId())) return false;
        return switch (d.getScope()) {
            case COMPANY -> canManageCompany;
            case PERSONAL -> userId.equals(d.getOwnerUserId()) && canUploadPersonal;
            case UNIT -> manageableUnitIds.contains(d.getOrgUnitId()) || (canManageCompany && isOrphan(d));
        };
    }

    /** Có được TẠO tài liệu ở phạm vi này không (tải lên mới, hoặc là phạm vi đích khi đổi phạm vi). */
    public boolean canCreate(DocumentScope scope, UUID unitId) {
        if (!member) return false;
        return switch (scope) {
            case COMPANY -> canManageCompany;
            case PERSONAL -> canUploadPersonal;
            case UNIT -> unitId != null && manageableUnitIds.contains(unitId);
        };
    }

    // ── Thư mục ─────────────────────────────────────────────────────────────────────────────────

    /** Thấy thư mục: cùng luật phạm vi với tài liệu (không có chia sẻ thư mục). */
    public boolean canViewFolder(com.kpitracking.entity.DocumentFolder f) {
        if (!member || f == null || !orgId.equals(f.getOrganizationId())) return false;
        return switch (f.getScope()) {
            case COMPANY -> true;
            case PERSONAL -> userId.equals(f.getOwnerUserId());
            case UNIT -> visibleUnitIds.contains(f.getOrgUnitId());
        };
    }

    /** Tạo / đổi tên / xoá thư mục, và đưa tài liệu vào thư mục: cần quyền tạo tài liệu ở đúng phạm vi đó. */
    public boolean canEditFolder(com.kpitracking.entity.DocumentFolder f) {
        if (!canViewFolder(f)) return false;
        return switch (f.getScope()) {
            case COMPANY -> canManageCompany;
            case PERSONAL -> userId.equals(f.getOwnerUserId()) && canUploadPersonal;
            case UNIT -> manageableUnitIds.contains(f.getOrgUnitId());
        };
    }

    public boolean isOrphan(Document d) {
        return d.getScope() == DocumentScope.UNIT && !liveUnitIds.contains(d.getOrgUnitId());
    }

    // ── Bộ lọc kho vector ───────────────────────────────────────────────────────────────────────

    /**
     * Bộ lọc FAIL-CLOSED cho kho vector: chỉ nhánh khớp DƯƠNG, không nhánh nào kiểu "thiếu khoá thì cho qua".
     * Vector thiếu {@code scope} (hoặc thiếu {@code unitId}/{@code ownerId} tương ứng) không ai đọc được.
     *
     * <p>Chỉ dùng {@code isEqualTo}/{@code isIn}. KHÔNG dùng {@code isNotEqualTo}/{@code isNotIn}/{@code not}:
     * mapper của langchain4j dịch chúng thành {@code (key IS NULL OR key != …)} — vector thiếu khoá sẽ lọt.
     *
     * @param includeGlobal thêm bộ hướng dẫn chung ({@code orgId = scope = GLOBAL})
     */
    public Filter toVectorFilter(boolean includeGlobal) {
        Filter global = metadataKey(KEY_ORG).isEqualTo(GLOBAL).and(metadataKey(KEY_SCOPE).isEqualTo(GLOBAL));
        if (!member) {
            return includeGlobal ? global : nothing();
        }
        Filter branches = orgBranches();
        if (!sharedDocIds.isEmpty()) {
            // Được chia sẻ: khớp DƯƠNG theo đúng docId — vẫn fail-closed, không mở thêm nhánh "thiếu khoá".
            List<String> ids = sharedDocIds.stream().map(UUID::toString).sorted().toList();
            branches = branches.or(metadataKey(RagMetadata.DOC_ID).isIn(ids));
        }
        Filter org = metadataKey(KEY_ORG).isEqualTo(orgId.toString()).and(branches);
        return includeGlobal ? global.or(org) : org;
    }

    private Filter orgBranches() {
        Filter branches = metadataKey(KEY_SCOPE).isEqualTo(DocumentScope.COMPANY.name())
                .or(metadataKey(KEY_SCOPE).isEqualTo(DocumentScope.PERSONAL.name())
                        .and(metadataKey(KEY_OWNER).isEqualTo(userId.toString())));
        if (!visibleUnitIds.isEmpty()) {
            List<String> units = visibleUnitIds.stream().map(UUID::toString).sorted().toList();
            branches = branches.or(metadataKey(KEY_SCOPE).isEqualTo(DocumentScope.UNIT.name())
                    .and(metadataKey(KEY_UNIT).isIn(units)));
        }
        return branches;
    }

    /** Không khớp đoạn nào: không có tổ chức nào mang id này. */
    private static Filter nothing() {
        return metadataKey(KEY_ORG).isEqualTo("-");
    }

    // ── Bộ lọc JPA cho màn danh sách ────────────────────────────────────────────────────────────

    /** Đúng tập của {@link #canView}, dạng truy vấn. */
    public Specification<Document> toSpecification() {
        return (root, query, cb) -> {
            if (!member) return cb.disjunction();
            List<jakarta.persistence.criteria.Predicate> branches = new ArrayList<>();
            branches.add(cb.equal(root.get("scope"), DocumentScope.COMPANY));
            branches.add(cb.and(cb.equal(root.get("scope"), DocumentScope.PERSONAL),
                    cb.equal(root.get("ownerUserId"), userId)));
            if (!visibleUnitIds.isEmpty()) {
                branches.add(cb.and(cb.equal(root.get("scope"), DocumentScope.UNIT),
                        root.get("orgUnitId").in(visibleUnitIds)));
            }
            if (!sharedDocIds.isEmpty()) branches.add(root.get("id").in(sharedDocIds));
            if (canManageCompany) {
                var orphan = liveUnitIds.isEmpty()
                        ? cb.equal(root.get("scope"), DocumentScope.UNIT)
                        : cb.and(cb.equal(root.get("scope"), DocumentScope.UNIT),
                                 cb.not(root.get("orgUnitId").in(liveUnitIds)));
                branches.add(orphan);
            }
            return cb.and(cb.equal(root.get("organizationId"), orgId),
                    cb.or(branches.toArray(jakarta.persistence.criteria.Predicate[]::new)));
        };
    }
}
