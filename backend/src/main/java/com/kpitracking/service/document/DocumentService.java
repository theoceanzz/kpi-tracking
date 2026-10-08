package com.kpitracking.service.document;

import com.kpitracking.ai.document.ingest.DocumentIngestionPipeline;
import com.kpitracking.ai.document.store.RagVectorReader;
import com.kpitracking.dto.request.document.UpdateDocumentRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.ai.RagChunkResponse;
import com.kpitracking.dto.response.document.DocumentCapabilitiesResponse;
import com.kpitracking.dto.response.document.DocumentResponse;
import com.kpitracking.dto.response.document.DocumentUsageResponse;
import com.kpitracking.entity.Document;
import com.kpitracking.entity.DocumentFolder;
import com.kpitracking.entity.DocumentUserState;
import com.kpitracking.entity.DocumentVersion;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.RagDocument;
import com.kpitracking.entity.User;
import com.kpitracking.enums.DocumentAiStatus;
import com.kpitracking.enums.DocumentCategory;
import com.kpitracking.enums.DocumentScope;
import com.kpitracking.event.DocumentIndexRequestedEvent;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.mapper.DocumentMapper;
import com.kpitracking.repository.DocumentFolderRepository;
import com.kpitracking.repository.DocumentRepository;
import com.kpitracking.repository.DocumentShareRepository;
import com.kpitracking.repository.DocumentUserStateRepository;
import com.kpitracking.repository.DocumentVersionRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.RagDocumentRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.security.audit.SecurityAuditEvent;
import com.kpitracking.security.audit.SecurityAuditService;
import com.kpitracking.service.reward.RewardContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Thư viện tài liệu 3 phạm vi (docs/DOCUMENTS_DESIGN.md §5, §7). Mọi quyết định quyền đi qua {@link DocumentAccess}
 * do {@link DocumentAccessResolver} tính cho người đang đăng nhập — không có kiểm quyền nào tự viết ở đây.
 *
 * <p>Tài liệu người xem không được đọc trả {@code DOCUMENT_NOT_FOUND} (không phải 403) để không lộ việc nó tồn tại.
 *
 * <p>Thứ tự với kho ngoài (tệp, vector) — không nằm trong giao dịch DB:
 * <ul>
 *   <li>Tải lên: lưu tệp → ghi bản ghi; ghi hỏng thì xoá tệp vừa lưu.</li>
 *   <li>Xoá: xoá vector → xoá mềm bản ghi (ngược lại sẽ để vector mồ côi vẫn truy hồi được).</li>
 *   <li>Đổi phạm vi / tắt AI: xoá vector cũ SAU commit, rồi nạp lại nếu cần.</li>
 * </ul>
 */
@Service
@Slf4j
public class DocumentService {

    private final DocumentRepository documents;
    private final DocumentAccessResolver accessResolver;
    private final DocumentStorage storage;
    private final DocumentSettings settings;
    private final DocumentMapper mapper;
    private final ApplicationEventPublisher events;
    private final DocumentIngestionPipeline ingestion;
    private final RagVectorReader vectorReader;
    private final RagDocumentRepository legacyDocuments;
    private final UserRepository users;
    private final OrgUnitRepository orgUnits;
    private final PermissionChecker permissionChecker;
    private final SecurityAuditService audit;
    private final RewardContext currentUser;
    private final TransactionTemplate tx;
    private final DocumentFolderRepository folders;
    private final DocumentShareRepository shares;
    private final DocumentUserStateRepository userStates;
    private final DocumentVersionRepository versions;

    /** Giữ tối đa bấy nhiêu bản cũ mỗi tài liệu; bản cũ hơn bị xoá (cả tệp) khi thay tệp mới. */
    static final int MAX_VERSIONS = 10;

    public DocumentService(DocumentRepository documents, DocumentAccessResolver accessResolver, DocumentStorage storage,
                           DocumentSettings settings, DocumentMapper mapper, ApplicationEventPublisher events,
                           DocumentIngestionPipeline ingestion, RagVectorReader vectorReader,
                           RagDocumentRepository legacyDocuments, UserRepository users, OrgUnitRepository orgUnits,
                           PermissionChecker permissionChecker, SecurityAuditService audit, RewardContext currentUser,
                           PlatformTransactionManager txManager, DocumentFolderRepository folders,
                           DocumentShareRepository shares, DocumentUserStateRepository userStates,
                           DocumentVersionRepository versions) {
        this.documents = documents;
        this.accessResolver = accessResolver;
        this.storage = storage;
        this.settings = settings;
        this.mapper = mapper;
        this.events = events;
        this.ingestion = ingestion;
        this.vectorReader = vectorReader;
        this.legacyDocuments = legacyDocuments;
        this.users = users;
        this.orgUnits = orgUnits;
        this.permissionChecker = permissionChecker;
        this.audit = audit;
        this.currentUser = currentUser;
        this.tx = new TransactionTemplate(txManager);
        this.folders = folders;
        this.shares = shares;
        this.userStates = userStates;
        this.versions = versions;
    }

    /** Các tab của trang chủ (kiểu Lark): của tôi, được chia sẻ với tôi, yêu thích. "Gần đây" ở DocumentHomeService. */
    public enum HomeView { OWNED, SHARED, FAVORITES }

    /**
     * Bộ lọc màn danh sách.
     *
     * @param folderId duyệt trong một thư mục (Drive); {@code rootOnly} = chỉ tài liệu ở gốc của phạm vi
     */
    public record ListFilter(DocumentScope scope, UUID unitId, boolean includeDescendants,
                             DocumentCategory category, DocumentAiStatus aiStatus, String q,
                             UUID folderId, boolean rootOnly, HomeView view) {

        public ListFilter(DocumentScope scope, UUID unitId, boolean includeDescendants, DocumentCategory category,
                          DocumentAiStatus aiStatus, String q) {
            this(scope, unitId, includeDescendants, category, aiStatus, q, null, false, null);
        }
    }

    /** Tệp để trả về khi tải. */
    public record FileContent(byte[] bytes, String fileName, String contentType) {}

    // ── Ngữ cảnh người xem ─────────────────────────────────────────────────────────────────────────

    /** Người đang đăng nhập + quyền tài liệu + cây đơn vị của tổ chức (một lần mỗi request). */
    record Viewer(User user, UUID orgId, DocumentAccess access, Map<UUID, OrgUnit> units) {
        String path(UUID unitId) {
            OrgUnit u = unitId == null ? null : units.get(unitId);
            return u == null ? null : u.getPath();
        }
    }

    /** Đơn vị gốc — không phải đích của tài liệu đơn vị (xem {@link DocumentAccessResolver#rootUnitIds}). */
    static boolean isRootUnit(Viewer v, UUID unitId) {
        if (unitId == null) return false;
        Map<UUID, String> paths = new HashMap<>();
        v.units().forEach((id, u) -> paths.put(id, u.getPath()));
        return DocumentAccessResolver.rootUnitIds(paths).contains(unitId);
    }

    /** Báo rõ "chọn Công ty" thay vì 403 chung chung khi ai đó nhắm vào đơn vị gốc. */
    static void rejectRootUnit(Viewer v, DocumentScope scope, UUID unitId) {
        if (scope == DocumentScope.UNIT && isRootUnit(v, unitId)) {
            throw new BusinessException(ErrorCode.DOCUMENT_ROOT_UNIT_NOT_TARGET);
        }
    }

    Viewer viewer() {
        User me = currentUser.getCurrentUser();
        UUID orgId = currentUser.getCurrentOrgId();
        DocumentAccess access = accessResolver.resolve(me.getId(), orgId);
        Map<UUID, OrgUnit> units = orgId == null ? Map.of()
                : orgUnits.findSubtree("/", orgId).stream().collect(Collectors.toMap(OrgUnit::getId, Function.identity(), (a, b) -> a));
        return new Viewer(me, orgId, access, units);
    }

    // ── Đọc ────────────────────────────────────────────────────────────────────────────────────────

    public DocumentCapabilitiesResponse capabilities() {
        Viewer v = viewer();
        DocumentAccess a = v.access();
        Set<UUID> roots = DocumentAccessResolver.rootUnitIds(
                v.units().values().stream().collect(Collectors.toMap(OrgUnit::getId, OrgUnit::getPath, (x, y) -> x)));
        // Danh sách đơn vị cho GIAO DIỆN (Drive "Đơn vị", nơi đề xuất…) bỏ đơn vị gốc: gốc không phải nơi để tài liệu
        // đơn vị (§16.7) — tài liệu cho cả công ty nằm ở Drive "Công ty". Quyền đọc thật ({@code visibleUnitIds}) không
        // đổi: tài liệu cũ ở gốc (nếu có) vẫn xem được qua tìm kiếm / trang chủ.
        Set<UUID> visible = new HashSet<>(a.visibleUnitIds());
        visible.removeAll(roots);
        return new DocumentCapabilitiesResponse(a.member(), a.canUploadPersonal(), a.canManageCompany(),
                unitOptions(v, a.manageableUnitIds()), unitOptions(v, visible),
                DocumentPolicy.ALLOWED_EXTENSIONS, List.copyOf(roots));
    }

    private static List<DocumentCapabilitiesResponse.UnitOption> unitOptions(Viewer v, Set<UUID> ids) {
        return ids.stream().map(v.units()::get).filter(Objects::nonNull)
                .sorted(Comparator.comparing(OrgUnit::getPath))
                .map(u -> new DocumentCapabilitiesResponse.UnitOption(u.getId(), u.getName(), u.getPath()))
                .toList();
    }

    public PageResponse<DocumentResponse> list(ListFilter f, Pageable pageable) {
        Viewer v = viewer();
        DocumentAccess a = v.access();
        Specification<Document> spec = a.toSpecification();
        if (f.scope() != null) spec = spec.and((r, q, cb) -> cb.equal(r.get("scope"), f.scope()));

        // Drive: duyệt một thư mục, hoặc gốc của phạm vi. Trong Drive, đơn vị là ĐÚNG đơn vị đó (không kèm tài liệu kế thừa).
        boolean browsing = f.folderId() != null || f.rootOnly();
        if (f.folderId() != null) {
            DocumentFolder folder = folders.findByIdAndOrganizationId(f.folderId(), v.orgId()).orElse(null);
            if (folder == null || !a.canViewFolder(folder)) return emptyPage(pageable);
            spec = spec.and((r, q, cb) -> cb.equal(r.get("folderId"), f.folderId()));
        } else if (f.rootOnly()) {
            spec = spec.and((r, q, cb) -> cb.isNull(r.get("folderId")));
        }
        if (f.view() != null) {
            UUID me = v.user().getId();
            switch (f.view()) {
                case OWNED -> spec = spec.and((r, q, cb) -> cb.equal(r.get("createdBy"), me));
                case SHARED -> {
                    if (a.sharedDocIds().isEmpty()) return emptyPage(pageable);
                    spec = spec.and((r, q, cb) -> cb.and(r.get("id").in(a.sharedDocIds()), cb.notEqual(r.get("createdBy"), me)));
                }
                case FAVORITES -> {
                    List<UUID> fav = userStates.findFavoriteIds(me);
                    if (fav.isEmpty()) return emptyPage(pageable);
                    spec = spec.and((r, q, cb) -> r.get("id").in(fav));
                }
            }
        }

        String filterPath = null;
        if (f.unitId() != null && browsing) {
            if (!a.visibleUnitIds().contains(f.unitId())) return emptyPage(pageable);
            spec = spec.and((r, q, cb) -> cb.and(cb.equal(r.get("scope"), DocumentScope.UNIT), cb.equal(r.get("orgUnitId"), f.unitId())));
        } else if (f.unitId() != null) {
            filterPath = v.path(f.unitId());
            if (filterPath == null || !a.visibleUnitIds().contains(f.unitId())) {
                return emptyPage(pageable);
            }
            // Đơn vị đang lọc + các đơn vị cha (tài liệu kế thừa) [+ cây con]; bộ lọc quyền ở trên vẫn cắt tiếp.
            final String fp = filterPath;
            Set<UUID> units = v.units().values().stream()
                    .filter(u -> fp.startsWith(u.getPath()) || (f.includeDescendants() && u.getPath().startsWith(fp)))
                    .map(OrgUnit::getId).collect(Collectors.toSet());
            spec = spec.and((r, q, cb) -> cb.and(cb.equal(r.get("scope"), DocumentScope.UNIT), r.get("orgUnitId").in(units)));
        }
        if (f.category() != null) spec = spec.and((r, q, cb) -> cb.equal(r.get("category"), f.category()));
        if (f.aiStatus() != null) spec = spec.and((r, q, cb) -> cb.equal(r.get("aiStatus"), f.aiStatus()));
        if (f.q() != null && !f.q().isBlank()) {
            String like = "%" + f.q().strip().toLowerCase(Locale.ROOT).replace("%", "\\%").replace("_", "\\_") + "%";
            spec = spec.and((r, q, cb) -> cb.or(
                    cb.like(cb.lower(r.get("title")), like, '\\'),
                    cb.like(cb.lower(r.get("fileName")), like, '\\'),
                    cb.like(cb.lower(cb.coalesce(r.get("description"), "")), like, '\\')));
        }

        Page<Document> page = documents.findAll(spec, pageable);
        final String fp = filterPath;
        List<DocumentResponse> content = toResponses(v, page.getContent(), unitId -> {
            String p = v.path(unitId);
            return fp != null && p != null && !p.equals(fp) && fp.startsWith(p);
        });
        return PageResponse.<DocumentResponse>builder()
                .content(content).page(page.getNumber()).size(page.getSize())
                .totalElements(page.getTotalElements()).totalPages(page.getTotalPages()).last(page.isLast())
                .build();
    }

    public DocumentResponse get(UUID id) {
        Viewer v = viewer();
        return toResponse(v, visible(v, id));
    }

    public List<RagChunkResponse> chunks(UUID id) {
        Viewer v = viewer();
        Document d = editable(v, visible(v, id));
        return vectorReader.chunks(d.getId());
    }

    public FileContent download(UUID id) {
        Viewer v = viewer();
        Document d = visible(v, id);
        byte[] bytes;
        try {
            bytes = storage.read(d.getStorageKey());
        } catch (IOException e) {
            log.error("Không đọc được tệp của tài liệu {}: {}", id, e.getMessage());
            throw new BusinessException(ErrorCode.DOCUMENT_STORAGE_FAILED);
        }
        if (d.getScope() != DocumentScope.PERSONAL) {
            audit.record(SecurityAuditEvent.DOCUMENT_DOWNLOADED, SecurityAuditService.OK, "DOCUMENT", id.toString(), d.getScope().name());
        }
        return new FileContent(bytes, d.getFileName(), d.getContentType());
    }

    public DocumentUsageResponse usage() {
        Viewer v = viewer();
        UUID me = v.user().getId();
        return new DocumentUsageResponse(
                documents.sumPersonalBytes(me), settings.personalQuotaBytes(),
                v.orgId() == null ? 0 : documents.sumCompanyBytes(v.orgId()), settings.companyQuotaBytes(),
                settings.unitQuotaBytes(),
                v.orgId() == null ? 0 : documents.sumChunks(v.orgId()), settings.getOrgMaxChunks(),
                DocumentPolicy.MAX_FILE_BYTES, settings.getDeletedFileRetentionDays());
    }

    // ── Tải lên ────────────────────────────────────────────────────────────────────────────────────

    public DocumentResponse upload(MultipartFile file, DocumentScope scope, UUID unitId, String title,
                                   String description, DocumentCategory category, boolean aiEnabled) {
        return upload(file, scope, unitId, title, description, category, aiEnabled, null);
    }

    /** Tải lên, đặt thẳng vào một thư mục (cùng phạm vi). */
    public DocumentResponse upload(MultipartFile file, DocumentScope scope, UUID unitId, String title,
                                   String description, DocumentCategory category, boolean aiEnabled, UUID folderId) {
        return upload(file, scope, unitId, title, description, category, aiEnabled, folderId, null, null);
    }

    /** Tải lên kèm ngày rà soát / hết hiệu lực (§16.3). */
    public DocumentResponse upload(MultipartFile file, DocumentScope scope, UUID unitId, String title,
                                   String description, DocumentCategory category, boolean aiEnabled, UUID folderId,
                                   java.time.LocalDate reviewDate, java.time.LocalDate expiryDate) {
        Viewer v = viewer();
        CreateTarget target = createTarget(v, scope, unitId, folderId);
        Document created = create(v, file, target.scope(), target.unitId(), title, description, category, aiEnabled, null);
        place(created, folderId, reviewDate, expiryDate);
        return toResponse(v, created);
    }

    /** Chỗ đặt một tài liệu mới, đã kiểm quyền tạo. */
    record CreateTarget(DocumentScope scope, UUID unitId) {}

    /**
     * Phạm vi đích khi tạo tài liệu (tải lên, soạn mới): có thư mục thì phạm vi lấy theo thư mục — không cho tải tài liệu
     * công ty vào thư mục cá nhân. Kiểm quyền tạo ở phạm vi đó.
     */
    CreateTarget createTarget(Viewer v, DocumentScope scope, UUID unitId, UUID folderId) {
        if (folderId != null) {
            DocumentFolder folder = folders.findByIdAndOrganizationId(folderId, v.orgId())
                    .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.DOCUMENT_FOLDER_NOT_FOUND));
            if (!v.access().canEditFolder(folder)) throw new ForbiddenException(ErrorCode.DOCUMENT_FORBIDDEN);
            scope = folder.getScope();
            unitId = folder.getOrgUnitId();
        }
        if (scope == null) throw new BusinessException(ErrorCode.DOCUMENT_SCOPE_INVALID, "null");
        if (scope == DocumentScope.UNIT && unitId == null) {
            throw new BusinessException(ErrorCode.DOCUMENT_SCOPE_INVALID, ErrorMessages.text("document.scope.unitRequired", "unit"));
        }
        rejectRootUnit(v, scope, unitId);
        if (!v.access().canCreate(scope, unitId)) throw new ForbiddenException(ErrorCode.DOCUMENT_FORBIDDEN);
        return new CreateTarget(scope, scope == DocumentScope.UNIT ? unitId : null);
    }

    /** Đặt tài liệu vừa tạo vào thư mục và ghi ngày rà soát / hết hiệu lực (giao dịch riêng, sau khi tạo). */
    void place(Document created, UUID folderId, java.time.LocalDate reviewDate, java.time.LocalDate expiryDate) {
        if (folderId == null && reviewDate == null && expiryDate == null) return;
        tx.executeWithoutResult(st -> documents.findByIdForUpdate(created.getId()).ifPresent(d -> {
            d.setFolderId(folderId);
            d.setReviewDate(reviewDate);
            d.setExpiryDate(expiryDate);
            documents.save(d);
        }));
        created.setFolderId(folderId);
        created.setReviewDate(reviewDate);
        created.setExpiryDate(expiryDate);
    }

    private Document create(Viewer v, MultipartFile file, DocumentScope scope, UUID unitId, String title,
                            String description, DocumentCategory category, boolean aiEnabled, UUID replacesLegacy) {
        DocumentAccess a = v.access();
        if (scope == null) throw new BusinessException(ErrorCode.DOCUMENT_SCOPE_INVALID, "null");
        if (scope == DocumentScope.UNIT && unitId == null) {
            throw new BusinessException(ErrorCode.DOCUMENT_SCOPE_INVALID, ErrorMessages.text("document.scope.unitRequired", "unit"));
        }
        rejectRootUnit(v, scope, unitId);
        if (!a.canCreate(scope, unitId)) throw new ForbiddenException(ErrorCode.DOCUMENT_FORBIDDEN);

        byte[] bytes = readBytes(file);
        DocumentPolicy.Checked checked = DocumentPolicy.check(file.getOriginalFilename(), file.getContentType(), bytes);
        UUID ownerId = scope == DocumentScope.PERSONAL ? v.user().getId() : null;
        return createFromBytes(v, bytes, checked, scope, unitId, ownerId, title, description, category, aiEnabled,
                replacesLegacy, v.user().getId());
    }

    /**
     * Tạo bản ghi từ nội dung đã kiểm. Bên gọi đã kiểm quyền tạo ở phạm vi đích. Dùng chung cho tải lên và cho duyệt
     * đề xuất đưa lên đơn vị/công ty (sao chép tệp — tài liệu gốc giữ nguyên).
     *
     * @param ownerId   chủ khi {@code scope = PERSONAL}
     * @param createdBy người được ghi là người tạo (đề xuất được duyệt: chính người đề xuất)
     */
    Document createFromBytes(Viewer v, byte[] bytes, DocumentPolicy.Checked checked, DocumentScope scope, UUID unitId,
                             UUID ownerId, String title, String description, DocumentCategory category,
                             boolean aiEnabled, UUID replacesLegacy, UUID createdBy) {
        return createFromBytes(v, bytes, checked, scope, unitId, ownerId, title, description, category, aiEnabled,
                replacesLegacy, createdBy, true);
    }

    /**
     * @param rejectDuplicate chặn nội dung trùng tài liệu đã có cùng chỗ. Tài liệu trực tuyến mới tạo thì không chặn:
     *                        hai tài liệu trống cùng tên là chuyện bình thường, nội dung chỉ có sau khi soạn.
     */
    Document createFromBytes(Viewer v, byte[] bytes, DocumentPolicy.Checked checked, DocumentScope scope, UUID unitId,
                             UUID ownerId, String title, String description, DocumentCategory category,
                             boolean aiEnabled, UUID replacesLegacy, UUID createdBy, boolean rejectDuplicate) {
        UUID docUnit = scope == DocumentScope.UNIT ? unitId : null;
        UUID owner = scope == DocumentScope.PERSONAL ? ownerId : null;
        checkQuota(v, scope, owner, docUnit, bytes.length);

        String sha = sha256(bytes);
        if (rejectDuplicate) {
            documents.findByOrganizationIdAndScopeAndContentSha256(v.orgId(), scope, sha).stream()
                    .filter(d -> Objects.equals(d.getOwnerUserId(), owner) && Objects.equals(d.getOrgUnitId(), docUnit))
                    .findFirst()
                    .ifPresent(d -> { throw new BusinessException(ErrorCode.DOCUMENT_DUPLICATE, d.getTitle()); });
        }

        String key = store(bytes, checked.fileName(), v.orgId());
        try {
            Document saved = tx.execute(s -> {
                Document d = documents.save(Document.builder()
                        .organizationId(v.orgId())
                        .scope(scope)
                        .ownerUserId(owner)
                        .orgUnitId(docUnit)
                        .title(title == null || title.isBlank() ? DocumentPolicy.defaultTitle(checked.fileName()) : title.strip())
                        .description(description == null || description.isBlank() ? null : description.strip())
                        .category(category == null ? DocumentCategory.OTHER : category)
                        .fileName(checked.fileName())
                        .contentType(checked.contentType())
                        .fileSize((long) bytes.length)
                        .contentSha256(sha)
                        .storageProvider(storage.provider())
                        .storageKey(key)
                        .aiEnabled(aiEnabled)
                        .aiStatus(aiEnabled ? DocumentAiStatus.PENDING : DocumentAiStatus.NONE)
                        .legacyRagDocumentId(replacesLegacy)
                        .createdBy(createdBy)
                        .build());
                if (aiEnabled) events.publishEvent(new DocumentIndexRequestedEvent(d.getId()));
                return d;
            });
            audit.record(SecurityAuditEvent.DOCUMENT_UPLOADED, SecurityAuditService.OK, "DOCUMENT",
                    saved.getId().toString(), scope.name() + " " + bytes.length + "B");
            return saved;
        } catch (RuntimeException e) {
            deleteFileQuietly(key);
            throw e;
        }
    }

    // ── Sửa ────────────────────────────────────────────────────────────────────────────────────────

    public DocumentResponse update(UUID id, UpdateDocumentRequest req) {
        Viewer v = viewer();
        DocumentAccess a = v.access();
        boolean[] scopeChanged = new boolean[1];
        boolean[] metaOnly = new boolean[1];
        Document updated = tx.execute(s -> {
            Document d = documents.findByIdForUpdate(id).orElse(null);
            if (d == null || !a.canView(d)) throw new ResourceNotFoundException(ErrorCode.DOCUMENT_NOT_FOUND);
            editable(v, d);

            boolean reindex = false;
            boolean dropVectors = false;
            // Tên và hiệu lực chỉ nằm trong metadata vector → vá tại chỗ sau commit, không nạp lại cả tệp (§16.4).
            boolean patchMeta = false;
            if (req.getTitle() != null && !req.getTitle().isBlank() && !req.getTitle().strip().equals(d.getTitle())) {
                d.setTitle(req.getTitle().strip());
                patchMeta = true;
            }
            if (Boolean.TRUE.equals(req.getDatesSet())) {
                if (!Objects.equals(req.getReviewDate(), d.getReviewDate())) {
                    d.setReviewDate(req.getReviewDate());
                    d.setReviewNotifiedFor(null);
                }
                if (!Objects.equals(req.getExpiryDate(), d.getExpiryDate())) {
                    d.setExpiryDate(req.getExpiryDate());
                    d.setExpiryNotifiedFor(null);
                    patchMeta = true;
                }
            }
            if (req.getDescription() != null) {
                d.setDescription(req.getDescription().isBlank() ? null : req.getDescription().strip());
            }
            if (req.getCategory() != null && req.getCategory() != d.getCategory()) {
                d.setCategory(req.getCategory());
                reindex = true;
            }
            if (req.getScope() != null && isScopeChange(d, req)) {
                changeScope(v, d, req.getScope(), req.getOrgUnitId());
                scopeChanged[0] = true;
                reindex = true;
                dropVectors = true;
            }
            if (req.getAiEnabled() != null && !req.getAiEnabled().equals(d.getAiEnabled())) {
                d.setAiEnabled(req.getAiEnabled());
                if (!req.getAiEnabled()) {
                    d.setAiStatus(DocumentAiStatus.NONE);
                    d.setAiChunkCount(0);
                    d.setAiErrorI18n(null);
                    dropVectors = true;
                    reindex = false;
                } else {
                    reindex = true;
                }
            }
            if (dropVectors) afterCommit(() -> ingestion.removeVectors(id));
            if (reindex && Boolean.TRUE.equals(d.getAiEnabled())) requestReindex(d);
            // Đang INDEXING: bước chốt của luồng nạp so ảnh chụp (có tên + ngày hết hạn) và tự nạp lại — không vá đè.
            metaOnly[0] = patchMeta && !reindex && !dropVectors && Boolean.TRUE.equals(d.getAiEnabled())
                    && d.getAiStatus() == DocumentAiStatus.READY;
            return documents.save(d);
        });
        if (metaOnly[0]) syncVectorMetadata(updated);
        if (scopeChanged[0]) {
            audit.record(SecurityAuditEvent.DOCUMENT_SCOPE_CHANGED, SecurityAuditService.OK, "DOCUMENT", id.toString(),
                    updated.getScope().name());
        }
        return toResponse(v, updated);
    }

    private static boolean isScopeChange(Document d, UpdateDocumentRequest req) {
        if (req.getScope() != d.getScope()) return true;
        return req.getScope() == DocumentScope.UNIT && req.getOrgUnitId() != null && !req.getOrgUnitId().equals(d.getOrgUnitId());
    }

    /**
     * Quy tắc đổi phạm vi (docs/DOCUMENTS_DESIGN.md §5.3): phải sửa được tài liệu ở phạm vi CŨ (đã kiểm bằng
     * {@link #editable}) VÀ tạo được ở phạm vi MỚI. Về kho cá nhân thì chủ mới luôn là chính người thao tác —
     * request không có trường chủ sở hữu, nên không có đường "đẩy" tài liệu vào kho của người khác.
     */
    private void changeScope(Viewer v, Document d, DocumentScope to, UUID toUnit) {
        DocumentAccess a = v.access();
        if (to == DocumentScope.UNIT && toUnit == null) {
            throw new BusinessException(ErrorCode.DOCUMENT_SCOPE_INVALID, ErrorMessages.text("document.scope.unitRequired", "unit"));
        }
        rejectRootUnit(v, to, toUnit);
        if (!a.canCreate(to, toUnit)) throw new ForbiddenException(ErrorCode.DOCUMENT_FORBIDDEN);
        UUID owner = to == DocumentScope.PERSONAL ? v.user().getId() : null;
        UUID unit = to == DocumentScope.UNIT ? toUnit : null;
        checkQuota(v, to, owner, unit, d.getFileSize());
        d.setScope(to);
        d.setOwnerUserId(owner);
        d.setOrgUnitId(unit);
        d.setFolderId(null);
    }

    public DocumentResponse replaceFile(UUID id, MultipartFile file) {
        Viewer v = viewer();
        Document current = editable(v, visible(v, id));
        byte[] bytes = readBytes(file);
        DocumentPolicy.Checked checked = DocumentPolicy.check(file.getOriginalFilename(), file.getContentType(), bytes);
        checkQuota(v, current.getScope(), current.getOwnerUserId(), current.getOrgUnitId(), bytes.length - current.getFileSize());

        String key = store(bytes, checked.fileName(), v.orgId());
        List<String> expiredKeys = new ArrayList<>();
        try {
            Document updated = tx.execute(s -> {
                Document d = documents.findByIdForUpdate(id).orElseThrow(() -> new ResourceNotFoundException(ErrorCode.DOCUMENT_NOT_FOUND));
                editable(v, d);
                expiredKeys.addAll(archiveCurrentVersion(d, v.user().getId()));
                d.setFileName(checked.fileName());
                d.setContentType(checked.contentType());
                d.setFileSize((long) bytes.length);
                d.setContentSha256(sha256(bytes));
                d.setStorageKey(key);
                d.setStorageProvider(storage.provider());
                d.setVersion(d.getVersion() + 1);
                d.setContentEditedBy(null);
                d.setContentEditedAt(null);
                if (Boolean.TRUE.equals(d.getAiEnabled())) requestReindex(d);
                return documents.save(d);
            });
            // Bản cũ đã thành một phiên bản; chỉ tệp của những phiên bản vượt trần mới bị xoá.
            afterCommitOrNow(() -> expiredKeys.forEach(this::deleteFileQuietly));
            return toResponse(v, updated);
        } catch (RuntimeException e) {
            deleteFileQuietly(key);
            throw e;
        }
    }

    /**
     * Lưu tệp HIỆN HÀNH của tài liệu thành một phiên bản cũ (trước khi thay). Gọi trong giao dịch đang khoá dòng.
     *
     * @return khoá tệp của các phiên bản vượt trần {@link #MAX_VERSIONS} vừa bị gỡ — bên gọi xoá tệp SAU commit
     */
    List<String> archiveCurrentVersion(Document d, UUID actor) {
        versions.save(DocumentVersion.builder()
                .documentId(d.getId())
                .version(d.getVersion())
                .fileName(d.getFileName())
                .contentType(d.getContentType())
                .fileSize(d.getFileSize())
                .contentSha256(d.getContentSha256())
                .storageProvider(d.getStorageProvider())
                .storageKey(d.getStorageKey())
                .createdBy(actor)
                .build());
        List<DocumentVersion> all = versions.findByDocumentIdOrderByVersionDesc(d.getId());
        List<String> expired = new ArrayList<>();
        for (DocumentVersion old : all.subList(Math.min(MAX_VERSIONS, all.size()), all.size())) {
            expired.add(old.getStorageKey());
            versions.delete(old);
        }
        return expired;
    }

    public DocumentResponse reindex(UUID id) {
        Viewer v = viewer();
        Document updated = tx.execute(s -> {
            Document d = documents.findByIdForUpdate(id).orElse(null);
            if (d == null || !v.access().canView(d)) throw new ResourceNotFoundException(ErrorCode.DOCUMENT_NOT_FOUND);
            editable(v, d);
            if (!Boolean.TRUE.equals(d.getAiEnabled())
                    || !(d.getAiStatus() == DocumentAiStatus.READY || d.getAiStatus() == DocumentAiStatus.FAILED)) {
                throw new BusinessException(ErrorCode.DOCUMENT_REINDEX_NOT_ALLOWED);
            }
            requestReindex(d);
            return documents.save(d);
        });
        return toResponse(v, updated);
    }

    /** Vá tên + ghi chú hiệu lực vào mọi đoạn của tài liệu. Hỏng thì chỉ ghi log — lần nạp lại sau sẽ đúng. */
    void syncVectorMetadata(Document d) {
        try {
            int n = vectorReader.patchMetadata(d.getId(), DocumentIndexer.mutableMetadata(d));
            log.debug("Vá metadata {} đoạn của tài liệu {}", n, d.getId());
        } catch (Exception e) {
            log.warn("Không vá được metadata vector của tài liệu {}: {}", d.getId(), e.getMessage());
        }
    }

    /**
     * Đặt PENDING và phát event nạp — TRỪ khi đang INDEXING: khi đó để nguyên, luồng nạp sẽ thấy ảnh chụp đã đổi
     * ở bước chốt và tự nạp lại. Nhờ vậy không bao giờ có hai luồng nạp cùng một tài liệu.
     */
    void requestReindex(Document d) {
        if (d.getAiStatus() == DocumentAiStatus.INDEXING) return;
        d.setAiStatus(DocumentAiStatus.PENDING);
        d.setAiErrorI18n(null);
        events.publishEvent(new DocumentIndexRequestedEvent(d.getId()));
    }

    // ── Xoá ────────────────────────────────────────────────────────────────────────────────────────

    public void delete(UUID id) {
        Viewer v = viewer();
        Document d = editable(v, visible(v, id));
        // Vector trước: hỏng ở đây thì tài liệu còn nguyên, người dùng thử lại được; ngược lại sẽ còn vector mồ côi.
        ingestion.removeVectors(id);
        tx.executeWithoutResult(s -> documents.findByIdForUpdate(id).ifPresent(doc -> {
            doc.setDeletedAt(Instant.now());
            doc.setDeletedBy(v.user().getId());
            doc.setAiStatus(DocumentAiStatus.NONE);
            doc.setAiChunkCount(0);
            documents.save(doc);
        }));
        audit.record(SecurityAuditEvent.DOCUMENT_DELETED, SecurityAuditService.OK, "DOCUMENT", id.toString(), d.getScope().name());
    }

    /**
     * Admin xoá sớm tài liệu cá nhân của một người ĐANG bị vô hiệu hoá (§5.5). Không đọc nội dung — chỉ trả số
     * tài liệu đã xoá. Cần {@code DOCUMENT:MANAGE_COMPANY} + {@code USER:UPDATE} trong tổ chức.
     */
    public int purgePersonalOf(UUID ownerId) {
        Viewer v = requirePurgeRights();
        if (!documents.isUserDeactivated(ownerId)) throw new BusinessException(ErrorCode.DOCUMENT_PURGE_USER_ACTIVE);
        List<Document> docs = documents.findByScopeAndOwnerUserIdAndOrganizationId(DocumentScope.PERSONAL, ownerId, v.orgId());
        int n = softDeleteAll(docs);
        audit.record(SecurityAuditEvent.DOCUMENT_PURGED, SecurityAuditService.OK, "USER", ownerId.toString(), n + " documents");
        return n;
    }

    /** Tóm tắt kho cá nhân của một người cho hộp xác nhận xoá sớm — CHỈ số lượng và dung lượng, không tên hay nội dung. */
    public record PersonalSummary(int count, long bytes, boolean deactivated) {}

    public PersonalSummary personalSummaryOf(UUID ownerId) {
        Viewer v = requirePurgeRights();
        List<Document> docs = documents.findByScopeAndOwnerUserIdAndOrganizationId(DocumentScope.PERSONAL, ownerId, v.orgId());
        return new PersonalSummary(docs.size(), docs.stream().mapToLong(Document::getFileSize).sum(),
                documents.isUserDeactivated(ownerId));
    }

    /** Xoá sớm tài liệu cá nhân của người khác: cần {@code DOCUMENT:MANAGE_COMPANY} + {@code USER:UPDATE} trong tổ chức. */
    private Viewer requirePurgeRights() {
        Viewer v = viewer();
        if (!v.access().canManageCompany()
                || !permissionChecker.hasPermissionInOrganization(v.user().getId(), "USER:UPDATE", v.orgId())) {
            throw new ForbiddenException(ErrorCode.DOCUMENT_FORBIDDEN);
        }
        return v;
    }

    /** Xoá mềm hàng loạt (vector trước từng tài liệu). Dùng cho admin xoá sớm và job tự xoá sau N ngày. */
    public int softDeleteAll(List<Document> docs) {
        return softDeleteAll(docs, null);
    }

    /** Như trên, ghi người xoá (thùng rác hiện "Xoá bởi"); {@code null} = hệ thống. */
    public int softDeleteAll(List<Document> docs, UUID deletedBy) {
        int n = 0;
        for (Document d : docs) {
            try {
                ingestion.removeVectors(d.getId());
                tx.executeWithoutResult(s -> documents.findByIdForUpdate(d.getId()).ifPresent(doc -> {
                    doc.setDeletedAt(Instant.now());
                    doc.setDeletedBy(deletedBy);
                    doc.setAiStatus(DocumentAiStatus.NONE);
                    doc.setAiChunkCount(0);
                    documents.save(doc);
                }));
                n++;
            } catch (Exception e) {
                log.error("Không xoá được tài liệu {}: {}", d.getId(), e.getMessage());
            }
        }
        return n;
    }

    // ── Tài liệu cũ (rag_documents, không có tệp gốc) — §4.4 ──────────────────────────────────────

    public List<DocumentResponse> listLegacy() {
        Viewer v = viewer();
        if (!v.access().member()) return List.of();
        List<RagDocument> legacy = legacyDocuments.findByOrganizationIdOrderByCreatedAtDesc(v.orgId());
        Map<UUID, String> names = userNames(legacy.stream().map(RagDocument::getCreatedBy).filter(Objects::nonNull).toList());
        return legacy.stream().map(r -> mapper.fromLegacy(r, v.access().canManageCompany(), names)).toList();
    }

    public void deleteLegacy(UUID id) {
        Viewer v = viewer();
        RagDocument legacy = ownLegacy(v, id);
        ingestion.delete(legacy.getId());
        audit.record(SecurityAuditEvent.DOCUMENT_DELETED, SecurityAuditService.OK, "RAG_DOCUMENT", id.toString(), "LEGACY");
    }

    /** Tải tệp gốc lên cho một tài liệu cũ: thành tài liệu COMPANY thật; bản cũ bị xoá khi bản mới nạp xong. */
    public DocumentResponse replaceLegacy(UUID id, MultipartFile file) {
        Viewer v = viewer();
        RagDocument legacy = ownLegacy(v, id);
        DocumentCategory category = switch (legacy.getSource()) {
            case REGULATION -> DocumentCategory.REGULATION;
            case JOB_DESCRIPTION -> DocumentCategory.JOB_DESCRIPTION;
            case STRATEGY -> DocumentCategory.STRATEGY;
            case GUIDE -> DocumentCategory.OTHER;
        };
        return toResponse(v, create(v, file, DocumentScope.COMPANY, null, legacy.getTitle(), null, category, true, legacy.getId()));
    }

    private RagDocument ownLegacy(Viewer v, UUID id) {
        if (!v.access().canManageCompany()) throw new ForbiddenException(ErrorCode.DOCUMENT_FORBIDDEN);
        return legacyDocuments.findById(id)
                .filter(r -> v.orgId() != null && v.orgId().equals(r.getOrganizationId()))
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.DOCUMENT_NOT_FOUND));
    }

    /** Tạo tài liệu công ty từ cửa cũ {@code POST /api/v1/ai/rag/documents} — không còn đường nào sinh vector thiếu scope. */
    public DocumentResponse uploadCompanyFromLegacyEndpoint(MultipartFile file, RagDocument.Source source, String title) {
        DocumentCategory category = source == null ? DocumentCategory.REGULATION : switch (source) {
            case REGULATION -> DocumentCategory.REGULATION;
            case JOB_DESCRIPTION -> DocumentCategory.JOB_DESCRIPTION;
            case STRATEGY -> DocumentCategory.STRATEGY;
            case GUIDE -> DocumentCategory.OTHER;
        };
        return upload(file, DocumentScope.COMPANY, null, title, null, category, true);
    }

    // ── Trợ giúp ───────────────────────────────────────────────────────────────────────────────────

    /** Tồn tại, cùng tổ chức, VÀ người xem đọc được — không thì 404 như thể không có. */
    Document visible(Viewer v, UUID id) {
        Document d = v.orgId() == null ? null : documents.findByIdAndOrganizationId(id, v.orgId()).orElse(null);
        if (d == null || !v.access().canView(d)) throw new ResourceNotFoundException(ErrorCode.DOCUMENT_NOT_FOUND);
        return d;
    }

    static Document editable(Viewer v, Document d) {
        if (!v.access().canEdit(d)) throw new ForbiddenException(ErrorCode.DOCUMENT_FORBIDDEN);
        return d;
    }

    void checkQuota(Viewer v, DocumentScope scope, UUID ownerId, UUID unitId, long addBytes) {
        if (addBytes <= 0) return;
        long used;
        long quota;
        String label;
        switch (scope) {
            case PERSONAL -> { used = documents.sumPersonalBytes(ownerId); quota = settings.personalQuotaBytes(); label = ErrorMessages.text("document.scope.personal", "personal"); }
            case UNIT -> { used = documents.sumUnitBytes(unitId); quota = settings.unitQuotaBytes(); label = ErrorMessages.text("document.scope.unit", "unit"); }
            default -> { used = documents.sumCompanyBytes(v.orgId()); quota = settings.companyQuotaBytes(); label = ErrorMessages.text("document.scope.company", "company"); }
        }
        if (used + addBytes > quota) {
            throw new BusinessException(ErrorCode.DOCUMENT_QUOTA_EXCEEDED, label, humanSize(used), humanSize(Math.max(0, quota - used)));
        }
    }

    String store(byte[] bytes, String fileName, UUID orgId) {
        try {
            return storage.store(bytes, fileName, "documents/" + orgId);
        } catch (IOException e) {
            log.error("Không lưu được tệp tài liệu: {}", e.getMessage());
            throw new BusinessException(ErrorCode.DOCUMENT_STORAGE_FAILED);
        }
    }

    void deleteFileQuietly(String key) {
        if (key == null) return;
        try {
            storage.delete(key);
        } catch (Exception e) {
            log.warn("Không xoá được tệp {}: {}", key, e.getMessage());
        }
    }

    static byte[] readBytes(MultipartFile file) {
        if (file == null) throw new BusinessException(ErrorCode.FILE_EMPTY, "");
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.DOCUMENT_STORAGE_FAILED);
        }
    }

    static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String humanSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.0f KB", bytes / 1024.0);
        return String.format("%.1f MB", bytes / (1024.0 * 1024));
    }

    static void afterCommit(Runnable r) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                try {
                    r.run();
                } catch (Exception e) {
                    log.error("Việc sau commit của tài liệu thất bại: {}", e.getMessage(), e);
                }
            }
        });
    }

    private static void afterCommitOrNow(Runnable r) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) afterCommit(r);
        else r.run();
    }

    DocumentResponse toResponse(Viewer v, Document d) {
        return toResponses(v, List.of(d), id -> false).get(0);
    }

    List<DocumentResponse> toResponses(Viewer v, List<Document> docs) {
        return toResponses(v, docs, id -> false);
    }

    /**
     * Dựng response theo lô, không N+1: tên người tải/xoá, tên đơn vị, tên thư mục, trạng thái riêng của người xem
     * (yêu thích, ghim, mở gần nhất) và số lượt chia sẻ (chỉ người sửa được mới thấy).
     */
    List<DocumentResponse> toResponses(Viewer v, List<Document> docs, java.util.function.Predicate<UUID> inherited) {
        if (docs.isEmpty()) return List.of();
        List<UUID> ids = docs.stream().map(Document::getId).toList();
        List<UUID> people = new ArrayList<>(docs.stream().map(Document::getCreatedBy).toList());
        docs.stream().map(Document::getDeletedBy).filter(Objects::nonNull).forEach(people::add);
        Map<UUID, String> userNames = userNames(people);
        Map<UUID, String> unitNames = v.units().values().stream()
                .collect(Collectors.toMap(OrgUnit::getId, OrgUnit::getName, (a, b) -> a));
        Set<UUID> folderIds = docs.stream().map(Document::getFolderId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, String> folderNames = folderIds.isEmpty() ? Map.of()
                : folders.findAllById(folderIds).stream()
                        .collect(Collectors.toMap(DocumentFolder::getId, DocumentFolder::getName, (a, b) -> a));
        Map<UUID, DocumentUserState> states = userStates.findByUserIdAndDocumentIdIn(v.user().getId(), ids).stream()
                .collect(Collectors.toMap(DocumentUserState::getDocumentId, Function.identity(), (a, b) -> a));
        Map<UUID, Long> shareCounts = new HashMap<>();
        for (Object[] row : shares.countByDocumentIds(ids)) shareCounts.put((UUID) row[0], ((Number) row[1]).longValue());
        DocumentMapper.ViewContext ctx = new DocumentMapper.ViewContext(userNames, unitNames, v.access(), inherited,
                folderNames, states, shareCounts);
        return docs.stream().map(d -> mapper.toResponse(d, ctx)).toList();
    }

    Map<UUID, String> userNames(Collection<UUID> ids) {
        Set<UUID> distinct = ids.stream().filter(Objects::nonNull).collect(Collectors.toSet());
        if (distinct.isEmpty()) return Map.of();
        return users.findAllById(distinct).stream().collect(Collectors.toMap(User::getId, User::getFullName, (a, b) -> a));
    }

    private static PageResponse<DocumentResponse> emptyPage(Pageable pageable) {
        return PageResponse.<DocumentResponse>builder().content(List.of()).page(pageable.getPageNumber())
                .size(pageable.getPageSize()).totalElements(0).totalPages(0).last(true).build();
    }
}
