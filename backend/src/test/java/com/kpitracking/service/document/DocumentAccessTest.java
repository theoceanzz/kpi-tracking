package com.kpitracking.service.document;

import com.kpitracking.entity.Document;
import com.kpitracking.entity.DocumentFolder;
import com.kpitracking.enums.DocumentScope;
import com.kpitracking.service.document.DocumentAccessResolver.Membership;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Quyền đọc/sửa tài liệu trên một cây đơn vị giả (docs/DOCUMENTS_DESIGN.md §3):
 * <pre>
 *   KPC (gốc)
 *   ├── X (phòng)
 *   │   ├── X1 (tổ)
 *   │   └── X2 (tổ)
 *   └── Y (phòng)
 * </pre>
 * Test bộ lọc vector trên pgvector thật nằm ở {@code DocumentRetrievalIT}.
 */
class DocumentAccessTest {

    static final UUID ORG = UUID.randomUUID();
    static final UUID ME = UUID.randomUUID();
    static final UUID OTHER = UUID.randomUUID();
    static final UUID ROOT = UUID.randomUUID(), X = UUID.randomUUID(), X1 = UUID.randomUUID(),
            X2 = UUID.randomUUID(), Y = UUID.randomUUID();

    static final Map<UUID, String> UNITS = new LinkedHashMap<>();
    static {
        UNITS.put(ROOT, "/KPC/");
        UNITS.put(X, "/KPC/" + X + "/");
        UNITS.put(X1, "/KPC/" + X + "/" + X1 + "/");
        UNITS.put(X2, "/KPC/" + X + "/" + X2 + "/");
        UNITS.put(Y, "/KPC/" + Y + "/");
    }

    static final Set<String> STAFF = Set.of("DOCUMENT:UPLOAD_PERSONAL");
    static final Set<String> HEAD = Set.of("DOCUMENT:UPLOAD_PERSONAL", "DOCUMENT:MANAGE_UNIT");

    static DocumentAccess access(Membership... ms) {
        return DocumentAccessResolver.compute(ORG, ME, List.of(ms), UNITS);
    }

    static Membership at(UUID unit, Set<String> perms) {
        return new Membership(UNITS.get(unit), perms);
    }

    static Document unitDoc(UUID unit) {
        return Document.builder().organizationId(ORG).scope(DocumentScope.UNIT).orgUnitId(unit).build();
    }

    static Document personalDoc(UUID owner) {
        return Document.builder().organizationId(ORG).scope(DocumentScope.PERSONAL).ownerUserId(owner).build();
    }

    static Document companyDoc() {
        return Document.builder().organizationId(ORG).scope(DocumentScope.COMPANY).build();
    }

    @Test
    @DisplayName("nhân viên tổ X1: thấy tài liệu X1, X, gốc (truyền xuống); KHÔNG thấy X2 (anh em) và Y (ngang hàng)")
    void staffSeesOwnUnitAndAncestorsOnly() {
        DocumentAccess a = access(at(X1, STAFF));
        assertThat(a.visibleUnitIds()).containsExactlyInAnyOrder(X1, X, ROOT);
        assertThat(a.canView(unitDoc(X))).isTrue();
        assertThat(a.canView(unitDoc(X2))).isFalse();
        assertThat(a.canView(unitDoc(Y))).isFalse();
        assertThat(a.canEdit(unitDoc(X1))).isFalse();
        assertThat(a.manageableUnitIds()).isEmpty();
    }

    @Test
    @DisplayName("trưởng phòng X: thấy và sửa cả cây con X, X1, X2; thấy gốc nhưng không sửa; không thấy Y")
    void unitHeadManagesSubtree() {
        DocumentAccess a = access(at(X, HEAD));
        assertThat(a.visibleUnitIds()).containsExactlyInAnyOrder(ROOT, X, X1, X2);
        assertThat(a.manageableUnitIds()).containsExactlyInAnyOrder(X, X1, X2);
        assertThat(a.canEdit(unitDoc(X1))).isTrue();
        assertThat(a.canEdit(unitDoc(ROOT))).isFalse();
        assertThat(a.canView(unitDoc(Y))).isFalse();
        assertThat(a.canCreate(DocumentScope.UNIT, X2)).isTrue();
        assertThat(a.canCreate(DocumentScope.UNIT, Y)).isFalse();
    }

    @Test
    @DisplayName("tài liệu cá nhân: chỉ chính chủ — kể cả SYSTEM:ADMIN cũng không đọc được của người khác")
    void personalIsOwnerOnly() {
        DocumentAccess staff = access(at(X1, STAFF));
        assertThat(staff.canView(personalDoc(ME))).isTrue();
        assertThat(staff.canEdit(personalDoc(ME))).isTrue();
        assertThat(staff.canView(personalDoc(OTHER))).isFalse();

        DocumentAccess admin = access(at(ROOT, Set.of("SYSTEM:ADMIN")));
        assertThat(admin.canView(personalDoc(OTHER))).isFalse();
        assertThat(admin.canEdit(unitDoc(Y))).isTrue();
        assertThat(admin.canManageCompany()).isTrue();
    }

    @Test
    @DisplayName("tài liệu công ty: thành viên nào cũng đọc; chỉ MANAGE_COMPANY sửa")
    void companyReadableByMembers() {
        assertThat(access(at(Y, STAFF)).canView(companyDoc())).isTrue();
        assertThat(access(at(Y, STAFF)).canEdit(companyDoc())).isFalse();
        assertThat(access(at(ROOT, Set.of("DOCUMENT:MANAGE_COMPANY"))).canEdit(companyDoc())).isTrue();
    }

    @Test
    @DisplayName("không có vai trò trong tổ chức → không thấy gì, kể cả tài liệu công ty")
    void nonMemberSeesNothing() {
        DocumentAccess a = DocumentAccessResolver.compute(ORG, ME, List.of(), UNITS);
        assertThat(a.member()).isFalse();
        assertThat(a.canView(companyDoc())).isFalse();
        assertThat(a.canView(personalDoc(ME))).isFalse();
    }

    @Test
    @DisplayName("tài liệu tổ chức khác → không thấy dù cùng phạm vi")
    void otherOrganizationIsInvisible() {
        Document foreign = Document.builder().organizationId(UUID.randomUUID()).scope(DocumentScope.COMPANY).build();
        assertThat(access(at(ROOT, Set.of("SYSTEM:ADMIN"))).canView(foreign)).isFalse();
    }

    @Test
    @DisplayName("chuyển đơn vị: tính lại quyền là mất quyền đọc ngay, không cần nạp lại gì")
    void movingUnitRevokesImmediately() {
        assertThat(access(at(X1, STAFF)).canView(unitDoc(X))).isTrue();
        assertThat(access(at(Y, STAFF)).canView(unitDoc(X))).isFalse();
    }

    @Test
    @DisplayName("tài liệu của đơn vị đã xoá (mồ côi): chỉ MANAGE_COMPANY thấy và sửa")
    void orphanUnitDocuments() {
        Document orphan = unitDoc(UUID.randomUUID());
        assertThat(access(at(X, HEAD)).canView(orphan)).isFalse();
        DocumentAccess company = access(at(ROOT, Set.of("DOCUMENT:MANAGE_COMPANY")));
        assertThat(company.isOrphan(orphan)).isTrue();
        assertThat(company.canEdit(orphan)).isTrue();
    }

    @Test
    @DisplayName("đổi phạm vi: tạo ở phạm vi đích cần đúng quyền của phạm vi đó")
    void createRulesPerScope() {
        DocumentAccess staff = access(at(X1, STAFF));
        assertThat(staff.canCreate(DocumentScope.PERSONAL, null)).isTrue();
        assertThat(staff.canCreate(DocumentScope.UNIT, X1)).isFalse();
        assertThat(staff.canCreate(DocumentScope.COMPANY, null)).isFalse();
        assertThat(access(at(X1, Set.of())).canCreate(DocumentScope.PERSONAL, null)).isFalse();
    }

    // ── Chia sẻ (§15.3) ────────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("được chia sẻ: XEM được tài liệu cá nhân của người khác / đơn vị ngang hàng, nhưng KHÔNG sửa được")
    void sharedIsViewOnly() {
        Document othersPersonal = personalDoc(OTHER);
        othersPersonal.setId(UUID.randomUUID());
        Document peerUnit = unitDoc(Y);
        peerUnit.setId(UUID.randomUUID());
        DocumentAccess plain = access(at(X1, HEAD));
        assertThat(plain.canView(othersPersonal)).isFalse();
        assertThat(plain.canView(peerUnit)).isFalse();

        DocumentAccess shared = plain.withShared(Set.of(othersPersonal.getId(), peerUnit.getId()));
        assertThat(shared.canView(othersPersonal)).isTrue();
        assertThat(shared.canView(peerUnit)).isTrue();
        assertThat(shared.canEdit(othersPersonal)).isFalse();
        assertThat(shared.canEdit(peerUnit)).isFalse();
        assertThat(shared.isSharedWithMe(othersPersonal)).isTrue();
        // Chia sẻ không mở thêm gì khác: một tài liệu cá nhân khác của cùng người đó vẫn kín.
        Document another = personalDoc(OTHER);
        another.setId(UUID.randomUUID());
        assertThat(shared.canView(another)).isFalse();
    }

    @Test
    @DisplayName("chia sẻ quyền chỉnh sửa: sửa được NỘI DUNG, vẫn không quản lý (xoá, chia sẻ…); quyền xem thì không sửa")
    void editShareGrantsContentOnly() {
        Document editShared = personalDoc(OTHER);
        editShared.setId(UUID.randomUUID());
        Document viewShared = personalDoc(OTHER);
        viewShared.setId(UUID.randomUUID());
        DocumentAccess a = access(at(X1, STAFF))
                .withShared(Set.of(editShared.getId(), viewShared.getId()), Set.of(editShared.getId()));
        assertThat(a.canEditContent(editShared)).isTrue();
        assertThat(a.canEdit(editShared)).isFalse();
        assertThat(a.canEditContent(viewShared)).isFalse();
        // Quyền sửa chỉ đi kèm quyền xem: id có trong tập sửa nhưng không xem được thì vẫn không sửa.
        Document foreign = Document.builder().organizationId(UUID.randomUUID()).scope(DocumentScope.COMPANY).build();
        foreign.setId(UUID.randomUUID());
        assertThat(access(at(X1, STAFF)).withShared(Set.of(), Set.of(foreign.getId())).canEditContent(foreign)).isFalse();
        // Người quản lý luôn sửa được nội dung.
        Document own = personalDoc(ME);
        assertThat(access(at(X1, STAFF)).canEditContent(own)).isEqualTo(access(at(X1, STAFF)).canEdit(own));
    }

    @Test
    @DisplayName("chia sẻ không vượt tổ chức: id trùng nhưng tài liệu thuộc tổ chức khác thì vẫn không thấy")
    void sharedRespectsOrganization() {
        Document foreign = Document.builder().organizationId(UUID.randomUUID()).scope(DocumentScope.COMPANY).build();
        foreign.setId(UUID.randomUUID());
        assertThat(access(at(X1, STAFF)).withShared(Set.of(foreign.getId())).canView(foreign)).isFalse();
    }

    @Test
    @DisplayName("bộ lọc vector: đoạn của tài liệu được chia sẻ lọt qua theo docId; tài liệu khác của cùng chủ thì không")
    void vectorFilterIncludesSharedDocs() {
        UUID shared = UUID.randomUUID();
        var sharedChunk = dev.langchain4j.data.document.Metadata.from(Map.of(
                "orgId", ORG.toString(), "scope", "PERSONAL", "ownerId", OTHER.toString(), "docId", shared.toString()));
        var otherChunk = dev.langchain4j.data.document.Metadata.from(Map.of(
                "orgId", ORG.toString(), "scope", "PERSONAL", "ownerId", OTHER.toString(), "docId", UUID.randomUUID().toString()));
        var foreignOrg = dev.langchain4j.data.document.Metadata.from(Map.of(
                "orgId", UUID.randomUUID().toString(), "scope", "PERSONAL", "ownerId", OTHER.toString(), "docId", shared.toString()));
        var withShare = access(at(X1, STAFF)).withShared(Set.of(shared)).toVectorFilter(false);
        assertThat(withShare.test(sharedChunk)).isTrue();
        assertThat(withShare.test(otherChunk)).isFalse();
        assertThat(withShare.test(foreignOrg)).isFalse();
        assertThat(access(at(X1, STAFF)).toVectorFilter(false).test(sharedChunk)).isFalse();
    }

    // ── Thư mục (§15.2) ────────────────────────────────────────────────────────────────────────────

    static DocumentFolder folder(DocumentScope scope, UUID owner, UUID unit) {
        return DocumentFolder.builder().organizationId(ORG).scope(scope).ownerUserId(owner).orgUnitId(unit).name("f").build();
    }

    @Test
    @DisplayName("thư mục theo đúng luật phạm vi: cá nhân chỉ chủ; đơn vị thấy theo cây, sửa khi quản lý; công ty sửa khi quản lý công ty")
    void folderRules() {
        DocumentAccess staff = access(at(X1, STAFF));
        assertThat(staff.canViewFolder(folder(DocumentScope.PERSONAL, ME, null))).isTrue();
        assertThat(staff.canEditFolder(folder(DocumentScope.PERSONAL, ME, null))).isTrue();
        assertThat(staff.canViewFolder(folder(DocumentScope.PERSONAL, OTHER, null))).isFalse();
        assertThat(staff.canViewFolder(folder(DocumentScope.UNIT, null, X))).isTrue();
        assertThat(staff.canEditFolder(folder(DocumentScope.UNIT, null, X))).isFalse();
        assertThat(staff.canViewFolder(folder(DocumentScope.UNIT, null, Y))).isFalse();
        assertThat(staff.canEditFolder(folder(DocumentScope.COMPANY, null, null))).isFalse();

        DocumentAccess head = access(at(X, HEAD));
        assertThat(head.canEditFolder(folder(DocumentScope.UNIT, null, X1))).isTrue();
        assertThat(head.canEditFolder(folder(DocumentScope.UNIT, null, Y))).isFalse();
        assertThat(access(at(ROOT, Set.of("DOCUMENT:MANAGE_COMPANY"))).canEditFolder(folder(DocumentScope.COMPANY, null, null))).isTrue();
    }

    @Test
    @DisplayName("đơn vị gốc không phải đích của tài liệu đơn vị: quản lý ở gốc vẫn quản lý cây con, nhưng tạo cho cả công ty phải là phạm vi Công ty")
    void rootUnitIsNotAUnitTarget() {
        DocumentAccess rootHead = access(at(ROOT, HEAD));
        assertThat(rootHead.manageableUnitIds()).containsExactlyInAnyOrder(X, X1, X2, Y);
        assertThat(rootHead.canCreate(DocumentScope.UNIT, ROOT)).isFalse();
        assertThat(rootHead.canCreate(DocumentScope.UNIT, X)).isTrue();
        assertThat(rootHead.canEditFolder(folder(DocumentScope.UNIT, null, ROOT))).isFalse();
        assertThat(rootHead.visibleUnitIds()).contains(ROOT);
        assertThat(rootHead.canCreate(DocumentScope.COMPANY, null)).isFalse();
        assertThat(DocumentAccessResolver.rootUnitIds(UNITS)).containsExactly(ROOT);
    }
}
