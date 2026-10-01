package com.kpitracking.service.document;

import com.kpitracking.entity.Document;
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
}
