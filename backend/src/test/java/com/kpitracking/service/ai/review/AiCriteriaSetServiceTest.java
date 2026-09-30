package com.kpitracking.service.ai.review;

import com.kpitracking.ai.agent.CriteriaExtractionAgent;
import com.kpitracking.ai.document.ingest.DocumentIngestionPipeline;
import com.kpitracking.ai.document.model.ParsedDocument;
import com.kpitracking.ai.document.parse.DocumentParser;
import com.kpitracking.ai.document.parse.DocumentReader;
import com.kpitracking.ai.document.profile.DocumentProfileRegistry;
import com.kpitracking.ai.document.profile.DocumentProfiles;
import com.kpitracking.entity.RagDocument;
import com.kpitracking.dto.request.ai.AiCriteriaItemsRequest;
import com.kpitracking.dto.request.ai.AiCriteriaSetMetaRequest;
import com.kpitracking.entity.AiCriteriaSet;
import com.kpitracking.entity.AiCriteriaSetItem;
import com.kpitracking.entity.OrgHierarchyLevel;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.AiCriteriaChangeRequestRepository;
import com.kpitracking.repository.AiCriteriaSetItemRepository;
import com.kpitracking.repository.AiCriteriaSetRepository;
import com.kpitracking.repository.AiSubmissionReviewRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.AiQuotaService;
import com.kpitracking.service.AiRateLimiter;
import dev.langchain4j.model.output.TokenUsage;
import dev.langchain4j.service.Result;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * "Máy bóc, người xác nhận": đoạn gốc AI trích phải có thật trong tài liệu (không có thì dòng bị đánh dấu
 * để người đối chiếu soi), chỉ bản nháp sửa được. Xác nhận = ÁP cho đơn vị: mỗi đơn vị một tài liệu đang áp,
 * tài liệu cấp trên áp thì chặn kèm lý do, ngừng / áp lại được.
 */
class AiCriteriaSetServiceTest {

    private static final String SOURCE = """
            QUY CHẾ ĐÁNH GIÁ
            Điều 3. Doanh số: đạt từ 100% kế hoạch được 40 điểm.
            Điều 4. Chất lượng hồ sơ: không sai sót được 30 điểm.""";

    private AiCriteriaSetRepository sets;
    private AiCriteriaSetItemRepository items;
    private DocumentReader documentReader;
    private CriteriaExtractionAgent agent;
    private DocumentIngestionPipeline ingestion;
    private CriteriaExtractor extractor;
    private AiQuotaService quota;
    private AiSubmissionReviewRepository reviews;
    private OrgUnitRepository units;
    private AiCriteriaAuthority authority;
    private AiCriteriaChangeRequestRepository requests;
    private AiCriteriaSetService service;

    private final Organization org = new Organization();
    private final User me = new User();

    @BeforeEach
    void setUp() {
        sets = mock(AiCriteriaSetRepository.class);
        items = mock(AiCriteriaSetItemRepository.class);
        documentReader = mock(DocumentReader.class);
        agent = mock(CriteriaExtractionAgent.class);
        ingestion = mock(DocumentIngestionPipeline.class);
        extractor = new CriteriaExtractor(agent, 2, 10);
        quota = mock(AiQuotaService.class);
        UserRepository users = mock(UserRepository.class);
        UserRoleOrgUnitRepository assignments = mock(UserRoleOrgUnitRepository.class);
        units = mock(OrgUnitRepository.class);
        reviews = mock(AiSubmissionReviewRepository.class);
        DocumentProfileRegistry profiles = new DocumentProfileRegistry(List.of(new DocumentProfiles.RegulationProfile(),
                new DocumentProfiles.JobDescriptionProfile(), new DocumentProfiles.StrategyProfile(),
                new DocumentProfiles.KpiTableProfile(), new DocumentProfiles.GenericProfile()));
        authority = mock(AiCriteriaAuthority.class);
        requests = mock(AiCriteriaChangeRequestRepository.class);
        service = new AiCriteriaSetService(sets, items, reviews, units, users, assignments, documentReader, profiles,
                extractor, ingestion, mock(AiRateLimiter.class), quota, authority, requests);
        // Mặc định: người thao tác quản lý mọi đơn vị và không bị ai khoá (luật cấp bậc có test riêng).
        when(authority.canManageUnit(any(), any(), any())).thenReturn(true);
        when(authority.scopeOf(any(), any(), any())).thenAnswer(inv -> {
            java.util.Collection<OrgUnit> all = inv.getArgument(2);
            return new AiCriteriaAuthority.Scope(true,
                    all.stream().map(OrgUnit::getId).collect(java.util.stream.Collectors.toSet()));
        });
        when(authority.lockReason(any(), any())).thenAnswer(inv -> "KHOÁ: " + ((AiCriteriaSet) inv.getArgument(0)).getTitle());

        org.setId(UUID.randomUUID());
        me.setId(UUID.randomUUID());
        me.setEmail("director@demo.com");
        OrgHierarchyLevel level = new OrgHierarchyLevel();
        level.setOrganization(org);
        OrgUnit root = new OrgUnit();
        root.setId(UUID.randomUUID());
        root.setOrgHierarchyLevel(level);
        UserRoleOrgUnit a = new UserRoleOrgUnit();
        a.setOrgUnit(root);
        when(assignments.findByUserId(me.getId())).thenReturn(List.of(a));
        when(users.findByEmail("director@demo.com")).thenReturn(Optional.of(me));
        when(units.findSubtree("/", org.getId())).thenReturn(List.of(root));
        when(sets.save(any())).thenAnswer(inv -> {
            AiCriteriaSet s = inv.getArgument(0);
            if (s.getId() == null) s.setId(UUID.randomUUID());
            return s;
        });
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("director@demo.com", null, List.of()));
    }

    @AfterEach
    void tearDown() {
        extractor.shutdown();
        SecurityContextHolder.clearContext();
    }

    private static Result<String> json(String s) {
        return Result.<String>builder().content(s).tokenUsage(new TokenUsage(10, 5)).build();
    }

    @Test
    @DisplayName("bóc: dòng có đoạn gốc thật -> đã khớp; đoạn gốc bịa -> chưa khớp; bản mới là DRAFT")
    void uploadVerifiesExcerpts() throws Exception {
        when(documentReader.read(any())).thenReturn(ParsedDocument.fromText("quy-che.docx", SOURCE));
        when(agent.extract(anyString())).thenReturn(json("""
                Đây là kết quả:
                {"tieuChi":[
                  {"ten":"Doanh số","trongSo":40,"cacMuc":["Đạt","Chưa đạt"],"doanGoc":"đạt từ 100%  kế hoạch được 40 điểm"},
                  {"ten":"Chất lượng hồ sơ","trongSo":30,"doanGoc":"hồ sơ đầy đủ chữ ký được 30 điểm"}
                ]}"""));

        var res = service.upload(new MockMultipartFile("file", "quy-che.docx", null, new byte[]{1}), null, null);

        assertThat(res.getStatus()).isEqualTo(AiCriteriaSet.DRAFT);
        assertThat(res.getTitle()).isEqualTo("quy-che");
        ArgumentCaptor<AiCriteriaSetItem> saved = ArgumentCaptor.forClass(AiCriteriaSetItem.class);
        verify(items, times(2)).save(saved.capture());
        assertThat(saved.getAllValues()).extracting(AiCriteriaSetItem::getExcerptVerified).containsExactly(true, false);
        assertThat(saved.getAllValues().get(0).getScaleLevels()).isEqualTo("Đạt\nChưa đạt");
        verify(quota).checkAndThrow("director@demo.com");
        // Có "Điều 3.", "Điều 4." → nhận là quy chế, bộ nhóm của quy chế.
        assertThat(res.getProfile()).isEqualTo("REGULATION");
        assertThat(res.getRoles()).extracting(r -> r.code()).containsExactly("TIEU_CHI", "THANG_MUC", "THAM_KHAO", "TRA_CUU");
    }

    @Test
    @DisplayName("tài liệu không đọc được -> báo lý do, không gọi agent bóc")
    void unreadableSourceStops() throws Exception {
        when(documentReader.read(any())).thenThrow(new DocumentParser.Unparseable("PDF không có lớp chữ"));

        assertThatThrownBy(() -> service.upload(new MockMultipartFile("file", "scan.pdf", null, new byte[]{1}), null, null))
                .isInstanceOf(BusinessException.class).hasMessageContaining("PDF không có lớp chữ");
        verify(agent, never()).extract(anyString());
    }

    @Test
    @DisplayName("xác nhận = áp: đơn vị đang áp tài liệu của mình → tài liệu đó ngừng + gỡ kho; phiên bản kế tiếp; phạm vi khác không đụng")
    void confirmReplacesOwnActiveDocument() {
        AiCriteriaSet draft = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId())
                .title("Quy chế 2026").status(AiCriteriaSet.DRAFT).createdBy(me.getId()).build();
        UUID oldDoc = UUID.randomUUID();
        AiCriteriaSet current = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId())
                .title("Quy chế 2025").version(2).status(AiCriteriaSet.CONFIRMED).confirmedBy(me.getId())
                .ragDocumentId(oldDoc).build();
        UUID newDoc = UUID.randomUUID();
        when(ingestion.ingestSections(any(), any(), any(), any(), any(), any())).thenReturn(
                RagDocument.builder().id(newDoc).status(RagDocument.Status.READY).build());
        AiCriteriaSet otherUnit = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId())
                .orgUnitId(UUID.randomUUID()).title("Phòng KD").version(5).status(AiCriteriaSet.CONFIRMED).build();
        when(sets.findByIdAndOrganizationId(draft.getId(), org.getId())).thenReturn(Optional.of(draft));
        when(sets.findByOrganizationIdAndStatus(org.getId(), AiCriteriaSet.CONFIRMED)).thenReturn(List.of(current, otherUnit));
        when(sets.findByOrganizationIdOrderByCreatedAtDesc(org.getId())).thenReturn(List.of(draft, current, otherUnit));
        when(items.findBySetIdOrderByPositionAsc(draft.getId())).thenReturn(List.of(
                AiCriteriaSetItem.builder().name("Doanh số").build()));

        var res = service.confirm(draft.getId());

        assertThat(res.getStatus()).isEqualTo(AiCriteriaSet.CONFIRMED);
        assertThat(res.getVersion()).isEqualTo(3);
        assertThat(current.getStatus()).isEqualTo(AiCriteriaSet.ARCHIVED);
        assertThat(otherUnit.getStatus()).isEqualTo(AiCriteriaSet.CONFIRMED);
        assertThat(draft.getConfirmedBy()).isEqualTo(me.getId());
        verify(ingestion).delete(oldDoc);                      // quy chế cũ ra khỏi kho tri thức
        assertThat(draft.getRagDocumentId()).isEqualTo(newDoc);
    }

    @Test
    @DisplayName("tài liệu cấp trên áp → cấp dưới không xác nhận thay được, lời báo nêu lý do; tài liệu cũ giữ nguyên")
    void lowerManagerBlockedBySuperiorsDocument() {
        UUID unitIt = UUID.randomUUID();
        allowUnits(unitIt);
        AiCriteriaSet draft = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId()).orgUnitId(unitIt)
                .title("Quy chế IT của phòng").status(AiCriteriaSet.DRAFT).createdBy(me.getId()).build();
        AiCriteriaSet superiors = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId()).orgUnitId(unitIt)
                .title("Quy chế vận hành").version(1).status(AiCriteriaSet.CONFIRMED).confirmedBy(UUID.randomUUID()).build();
        when(sets.findByIdAndOrganizationId(draft.getId(), org.getId())).thenReturn(Optional.of(draft));
        when(sets.findByOrganizationIdAndStatus(org.getId(), AiCriteriaSet.CONFIRMED)).thenReturn(List.of(superiors));
        when(items.findBySetIdOrderByPositionAsc(draft.getId())).thenReturn(List.of(AiCriteriaSetItem.builder().name("x").build()));
        when(authority.lockedFor(me.getId(), superiors)).thenReturn(true);

        assertThatThrownBy(() -> service.confirm(draft.getId()))
                .isInstanceOf(BusinessException.class).hasMessage("KHOÁ: Quy chế vận hành");
        assertThat(superiors.getStatus()).isEqualTo(AiCriteriaSet.CONFIRMED);
        assertThat(draft.getStatus()).isEqualTo(AiCriteriaSet.DRAFT);
        // Tài liệu đang áp đó cấp dưới cũng không ngừng / xoá được.
        when(sets.findByIdAndOrganizationId(superiors.getId(), org.getId())).thenReturn(Optional.of(superiors));
        assertThatThrownBy(() -> service.stop(superiors.getId())).isInstanceOf(ForbiddenException.class)
                .hasMessage("KHOÁ: Quy chế vận hành");
        assertThatThrownBy(() -> service.delete(superiors.getId())).isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("đơn vị con áp riêng được dù đơn vị cha đang áp tài liệu (chỉ chặn đúng đơn vị đã có)")
    void childUnitAppliesOwnDocumentUnderParent() {
        UUID parent = UUID.randomUUID();
        UUID child = UUID.randomUUID();
        allowUnits(parent, child);
        AiCriteriaSet parentDoc = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId()).orgUnitId(parent)
                .title("Quy chế chi nhánh").version(1).status(AiCriteriaSet.CONFIRMED).confirmedBy(UUID.randomUUID()).build();
        AiCriteriaSet draft = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId()).orgUnitId(child)
                .title("Quy chế phòng").status(AiCriteriaSet.DRAFT).createdBy(me.getId()).build();
        when(sets.findByIdAndOrganizationId(draft.getId(), org.getId())).thenReturn(Optional.of(draft));
        when(sets.findByOrganizationIdAndStatus(org.getId(), AiCriteriaSet.CONFIRMED)).thenReturn(List.of(parentDoc));
        when(items.findBySetIdOrderByPositionAsc(draft.getId())).thenReturn(List.of(AiCriteriaSetItem.builder().name("x").build()));
        when(authority.lockedFor(any(), any())).thenReturn(true);   // cha do cấp trên áp — nhưng không đụng tới

        service.confirm(draft.getId());

        assertThat(draft.getStatus()).isEqualTo(AiCriteriaSet.CONFIRMED);
        assertThat(draft.getOrgUnitId()).isEqualTo(child);
        assertThat(parentDoc.getStatus()).isEqualTo(AiCriteriaSet.CONFIRMED);
    }

    @Test
    @DisplayName("ngoài phạm vi: không tải lên / không áp cho đơn vị mình không quản lý")
    void outsideScopeForbidden() {
        UUID other = UUID.randomUUID();
        allowUnits(other);
        when(authority.canManageUnit(me.getId(), org.getId(), other)).thenReturn(false);

        assertThatThrownBy(() -> service.upload(new MockMultipartFile("file", "a.docx", null, new byte[]{1}), other, null))
                .isInstanceOf(ForbiddenException.class).hasMessageContaining("không thuộc các đơn vị bạn quản lý");
        verify(agent, never()).extract(anyString());
    }

    @Test
    @DisplayName("ngừng áp dụng → ARCHIVED, gỡ kho; áp lại cho đơn vị trống → đang áp, nạp kho lại; đơn vị đang có tài liệu → phải ngừng tài liệu đó trước")
    void stopAndReapply() {
        UUID unitHn = UUID.randomUUID();
        UUID unitIt = UUID.randomUUID();
        UUID unitTt = UUID.randomUUID();
        allowUnits(unitHn, unitIt, unitTt);
        UUID doc = UUID.randomUUID();
        AiCriteriaSet itOps = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId()).orgUnitId(unitHn)
                .title("IT-OPS").version(1).status(AiCriteriaSet.CONFIRMED).confirmedBy(me.getId()).ragDocumentId(doc)
                .profile("REGULATION").sourceText(SOURCE).sourceFileName("it-ops.pdf").build();
        AiCriteriaSet atTt = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId()).orgUnitId(unitTt)
                .title("Quy chế truyền thông").version(1).status(AiCriteriaSet.CONFIRMED).confirmedBy(me.getId()).build();
        when(sets.findByIdAndOrganizationId(itOps.getId(), org.getId())).thenReturn(Optional.of(itOps));
        when(sets.findByOrganizationIdAndStatus(org.getId(), AiCriteriaSet.CONFIRMED)).thenReturn(List.of(atTt));
        when(sets.findByOrganizationIdOrderByCreatedAtDesc(org.getId())).thenReturn(List.of(itOps, atTt));
        UUID newDoc = UUID.randomUUID();
        when(ingestion.ingestSections(any(), any(), any(), any(), any(), any())).thenReturn(
                RagDocument.builder().id(newDoc).status(RagDocument.Status.READY).build());

        service.stop(itOps.getId());
        assertThat(itOps.getStatus()).isEqualTo(AiCriteriaSet.ARCHIVED);
        verify(ingestion).delete(doc);

        assertThatThrownBy(() -> service.reapply(itOps.getId(), unitTt))
                .isInstanceOf(BusinessException.class).hasMessageContaining("Ngừng áp dụng tài liệu đó trước");

        service.reapply(itOps.getId(), unitIt);                      // đúng trường hợp: áp IT-OPS cho Phòng IT
        assertThat(itOps.getStatus()).isEqualTo(AiCriteriaSet.CONFIRMED);
        assertThat(itOps.getOrgUnitId()).isEqualTo(unitIt);
        assertThat(itOps.getRagDocumentId()).isEqualTo(newDoc);
    }

    @Test
    @DisplayName("lưu nháp: máy vẫn tự kiểm đoạn gốc; người duyệt xác nhận dòng không khớp được lưu riêng, không giả làm 'khớp'")
    void reviewerConfirmationStoredSeparately() {
        AiCriteriaSet draft = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId())
                .title("Quy chế").status(AiCriteriaSet.DRAFT).sourceText(SOURCE).profile("REGULATION").build();
        when(sets.findByIdAndOrganizationId(draft.getId(), org.getId())).thenReturn(Optional.of(draft));
        AiCriteriaItemsRequest.Item checked = new AiCriteriaItemsRequest.Item("Bảng phân bổ", null, null, null, null,
                "STT Họ tên Tỷ lệ", "TRA_CUU", null, "Thưởng", true);
        AiCriteriaItemsRequest.Item plain = new AiCriteriaItemsRequest.Item("Doanh số", null, null, null, null,
                "đạt từ 100% kế hoạch", "TIEU_CHI", null, null, null);

        service.updateItems(draft.getId(), new AiCriteriaItemsRequest(List.of(checked, plain)));

        ArgumentCaptor<AiCriteriaSetItem> saved = ArgumentCaptor.forClass(AiCriteriaSetItem.class);
        verify(items, times(2)).save(saved.capture());
        assertThat(saved.getAllValues()).extracting(AiCriteriaSetItem::getExcerptVerified).containsExactly(false, true);
        assertThat(saved.getAllValues()).extracting(AiCriteriaSetItem::getReviewerConfirmed).containsExactly(true, false);
    }

    @Test
    @DisplayName("sửa thông tin: tài liệu đang áp chỉ chuyển sang đơn vị chưa có tài liệu, nhận phiên bản kế tiếp; tài liệu đã ngừng chỉ đổi tên")
    void updateInfoMovesOnlyToFreeUnit() {
        UUID unitA = UUID.randomUUID();
        UUID unitB = UUID.randomUUID();
        AiCriteriaSet active = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId())
                .title("Quy chế IT").version(1).status(AiCriteriaSet.CONFIRMED).confirmedBy(me.getId()).build();
        AiCriteriaSet takenB = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId()).orgUnitId(unitB)
                .title("Quy chế B").version(2).status(AiCriteriaSet.CONFIRMED).build();
        AiCriteriaSet oldA = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId()).orgUnitId(unitA)
                .title("Quy chế A cũ").version(4).status(AiCriteriaSet.ARCHIVED).build();
        allowUnits(unitA, unitB);
        when(sets.findByIdAndOrganizationId(active.getId(), org.getId())).thenReturn(Optional.of(active));
        when(sets.findByIdAndOrganizationId(oldA.getId(), org.getId())).thenReturn(Optional.of(oldA));
        when(sets.findByOrganizationIdAndStatus(org.getId(), AiCriteriaSet.CONFIRMED)).thenReturn(List.of(active, takenB));
        when(sets.findByOrganizationIdOrderByCreatedAtDesc(org.getId())).thenReturn(List.of(active, takenB, oldA));

        assertThatThrownBy(() -> service.updateInfo(active.getId(), meta(null, unitB)))
                .isInstanceOf(BusinessException.class).hasMessageContaining("Phòng C đang áp «Quy chế B»");

        service.updateInfo(active.getId(), meta("Quy chế vận hành", unitA));
        assertThat(active.getOrgUnitId()).isEqualTo(unitA);
        assertThat(active.getVersion()).isEqualTo(5);                    // A đã có v4 (đã ngừng) → v5
        assertThat(active.getTitle()).isEqualTo("Quy chế vận hành");
        assertThat(active.getStatus()).isEqualTo(AiCriteriaSet.CONFIRMED);

        assertThatThrownBy(() -> service.updateInfo(oldA.getId(), meta("x", null)))
                .isInstanceOf(BusinessException.class).hasMessageContaining("Áp dụng lại");
        service.updateInfo(oldA.getId(), meta("Quy chế A 2025", unitA));
        assertThat(oldA.getTitle()).isEqualTo("Quy chế A 2025");
    }

    @Test
    @DisplayName("nhân bản tài liệu đang áp: dùng ngay cho đơn vị mới, đủ dòng, tên tự đặt, dùng chung tài liệu kho; đơn vị đã có tài liệu → chặn; bản nháp → bản nháp")
    void cloneToFreeUnit() {
        UUID unitB = UUID.randomUUID();
        UUID unitC = UUID.randomUUID();
        UUID doc = UUID.randomUUID();
        AiCriteriaSet src = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId())
                .title("Quy chế IT").version(3).status(AiCriteriaSet.CONFIRMED).profile("REGULATION")
                .sourceText(SOURCE).ragDocumentId(doc).build();
        AiCriteriaSet takenC = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId()).orgUnitId(unitC)
                .title("Quy chế C").version(1).status(AiCriteriaSet.CONFIRMED).build();
        AiCriteriaSet draft = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId())
                .title("Nháp").status(AiCriteriaSet.DRAFT).build();
        allowUnits(unitB, unitC);
        when(sets.findByIdAndOrganizationId(src.getId(), org.getId())).thenReturn(Optional.of(src));
        when(sets.findByIdAndOrganizationId(draft.getId(), org.getId())).thenReturn(Optional.of(draft));
        when(sets.findByOrganizationIdAndStatus(org.getId(), AiCriteriaSet.CONFIRMED)).thenReturn(List.of(src, takenC));
        when(sets.findByOrganizationIdOrderByCreatedAtDesc(org.getId())).thenReturn(List.of(src, takenC, draft));
        when(items.findBySetIdOrderByPositionAsc(src.getId())).thenReturn(List.of(
                AiCriteriaSetItem.builder().name("Tiến độ").kind("TIEU_CHI").position(0).excerptVerified(true).build(),
                AiCriteriaSetItem.builder().name("Bảng phân bổ").kind("TRA_CUU").position(1).reviewerConfirmed(true).build()));

        assertThatThrownBy(() -> service.cloneTo(src.getId(), meta(null, unitC)))
                .isInstanceOf(BusinessException.class).hasMessageContaining("đang áp «Quy chế C»");

        var copy = service.cloneTo(src.getId(), meta("  ", unitB));

        assertThat(copy.getStatus()).isEqualTo(AiCriteriaSet.CONFIRMED);
        assertThat(copy.getVersion()).isEqualTo(1);
        assertThat(copy.getOrgUnitId()).isEqualTo(unitB);
        assertThat(copy.getTitle()).isEqualTo("Quy chế IT – Phòng B");
        assertThat(copy.getInKnowledgeBase()).isTrue();                 // dùng chung tài liệu, không nạp lại
        verify(ingestion, never()).ingestSections(any(), any(), any(), any(), any(), any());
        ArgumentCaptor<AiCriteriaSetItem> saved = ArgumentCaptor.forClass(AiCriteriaSetItem.class);
        verify(items, times(4)).save(saved.capture());                  // 2 dòng × (lần bị chặn + lần thành công)
        assertThat(saved.getAllValues().subList(2, 4)).extracting(AiCriteriaSetItem::getName)
                .containsExactly("Tiến độ", "Bảng phân bổ");
        assertThat(saved.getAllValues().subList(2, 4)).extracting(AiCriteriaSetItem::getReviewerConfirmed)
                .containsExactly(false, true);

        assertThat(service.cloneTo(draft.getId(), meta("Nháp B", unitB)).getStatus()).isEqualTo(AiCriteriaSet.DRAFT);
    }

    @Test
    @DisplayName("tài liệu kho dùng chung: xoá một bộ không gỡ tài liệu khi bộ khác còn trỏ tới")
    void sharedKnowledgeDocumentKeptWhileReferenced() {
        UUID doc = UUID.randomUUID();
        AiCriteriaSet one = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId())
                .title("x").version(1).status(AiCriteriaSet.CONFIRMED).ragDocumentId(doc).build();
        when(sets.findByIdAndOrganizationId(one.getId(), org.getId())).thenReturn(Optional.of(one));
        when(sets.existsByRagDocumentIdAndIdNot(doc, one.getId())).thenReturn(true);

        service.delete(one.getId());

        verify(ingestion, never()).delete(any());
    }

    @Test
    @DisplayName("tài liệu đang áp không sửa nội dung được; xoá được — lượt cũ chỉ bị bỏ liên kết")
    void confirmedIsReadOnlyButDeletable() {
        AiCriteriaSet confirmed = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId())
                .title("x").version(1).status(AiCriteriaSet.CONFIRMED).build();
        when(sets.findByIdAndOrganizationId(confirmed.getId(), org.getId())).thenReturn(Optional.of(confirmed));

        assertThatThrownBy(() -> service.confirm(confirmed.getId())).isInstanceOf(BusinessException.class);

        service.delete(confirmed.getId());
        verify(reviews).detachCriteriaSet(confirmed.getId());
        verify(sets).delete(confirmed);
    }

    private static AiCriteriaSetMetaRequest meta(String title, UUID unitId) {
        return AiCriteriaSetMetaRequest.builder().title(title).orgUnitId(unitId).build();
    }

    /** Các đơn vị con trong tổ chức, tên "Phòng B", "Phòng C"… theo thứ tự. */
    private void allowUnits(UUID... ids) {
        List<OrgUnit> all = new java.util.ArrayList<>(units.findSubtree("/", org.getId()));
        char name = 'B';
        for (UUID id : ids) {
            OrgUnit u = new OrgUnit();
            u.setId(id);
            u.setName("Phòng " + name++);
            u.setPath("/root/" + id + "/");
            all.add(u);
            when(units.findById(id)).thenReturn(Optional.of(u));
        }
        when(units.findSubtree("/", org.getId())).thenReturn(all);
    }
}
