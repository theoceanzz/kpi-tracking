package com.kpitracking.service.ai.review;

import com.kpitracking.ai.document.ingest.DocumentIngestionPipeline;
import com.kpitracking.ai.document.model.DocumentSection;
import com.kpitracking.ai.document.model.FileRef;
import com.kpitracking.ai.document.model.ParsedDocument;
import com.kpitracking.ai.document.parse.DocumentParser;
import com.kpitracking.ai.document.parse.DocumentReader;
import com.kpitracking.ai.document.profile.CriteriaScheme;
import com.kpitracking.ai.document.profile.DocumentProfile;
import com.kpitracking.ai.document.profile.DocumentProfileRegistry;
import com.kpitracking.ai.document.section.LegalStructureSectioning;
import com.kpitracking.dto.request.ai.AiCriteriaItemsRequest;
import com.kpitracking.dto.request.ai.AiCriteriaSetMetaRequest;
import com.kpitracking.dto.response.ai.AiCriteriaSetResponse;
import com.kpitracking.entity.AiCriteriaChangeRequest;
import com.kpitracking.entity.AiCriteriaSet;
import com.kpitracking.entity.AiCriteriaSetItem;
import com.kpitracking.entity.AiTokenUsage;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.AiCriteriaChangeRequestRepository;
import com.kpitracking.repository.AiCriteriaSetItemRepository;
import com.kpitracking.repository.AiCriteriaSetRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.AiQuotaService;
import com.kpitracking.service.AiRateLimiter;
import com.kpitracking.service.AiTokenUsageRecorder;
import com.kpitracking.service.AttachmentPolicy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Bộ tiêu chí chấm của tổ chức — "máy bóc, người xác nhận một lần" (tài liệu phân tích mục 9.3).
 * <ol>
 *   <li>Quản trị tải tài liệu lên → module tài liệu đọc (Word/Excel/PDF, ảnh qua mô hình thị giác), nhận ra
 *       LOẠI tài liệu ({@link DocumentProfileRegistry#detectForCriteria}) và cắt mục theo loại đó;</li>
 *   <li>{@link CriteriaExtractionAgent} bóc thành bảng; mỗi dòng kèm đoạn văn gốc, mã nguồn kiểm đoạn đó
 *       có thật trong tài liệu ({@code excerptVerified});</li>
 *   <li>Người quản lý đối chiếu, sửa, rồi XÁC NHẬN = áp cho đơn vị đã chọn ({@link #applyTo}).</li>
 * </ol>
 * Mỗi đơn vị một tài liệu đang áp; ai áp ở đâu, ai thay được của ai do {@link AiCriteriaAuthority} quyết. Chỉ bộ
 * đang áp mới được dùng khi chấm; lượt chấm ghi lại phiên bản đã dùng.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiCriteriaSetService {

    /**
     * Trần chữ đọc từ tài liệu (~100 trang). Bóc chạy TỪNG MỤC nên độ dài không còn làm mô hình nén/bỏ sót;
     * trần chỉ để một tệp bất thường không đốt hết hạn mức.
     */
    static final int MAX_SOURCE_CHARS = 150_000;


    private final AiCriteriaSetRepository setRepository;
    private final AiCriteriaSetItemRepository itemRepository;
    private final com.kpitracking.repository.AiSubmissionReviewRepository reviewRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final DocumentReader documentReader;
    private final DocumentProfileRegistry profiles;
    private final CriteriaExtractor extractor;
    private final DocumentIngestionPipeline ingestion;
    private final AiRateLimiter aiRateLimiter;
    private final AiQuotaService aiQuotaService;
    private final AiCriteriaAuthority authority;
    private final AiCriteriaChangeRequestRepository requestRepository;

    // ── bóc ───────────────────────────────────────────────────────────────

    /**
     * Tải tài liệu lên, AI bóc thành bản nháp cho {@code orgUnitId} (phải trong phạm vi người tải). Đơn vị đang
     * áp tài liệu của cấp trên vẫn tải được — duyệt xong thì gửi đề nghị thay vì xác nhận.
     */
    @Transactional
    public AiCriteriaSetResponse upload(MultipartFile file, UUID orgUnitId, String title) {
        User me = currentUser();
        Organization org = organizationOf(me);
        if (orgUnitId != null) requireUnitInOrg(orgUnitId, org.getId());
        if (!authority.canManageUnit(me.getId(), org.getId(), orgUnitId)) {
            throw new ForbiddenException(outsideScope(org.getId(), orgUnitId));
        }
        if (file == null || file.isEmpty()) throw new BusinessException("Chưa chọn tệp tài liệu bộ tiêu chí.");
        if (file.getSize() > AttachmentPolicy.MAX_FILE_BYTES) throw new BusinessException("Tệp lớn hơn 10 MB.");

        aiRateLimiter.check(me.getEmail());
        aiQuotaService.checkAndThrow(me.getEmail());

        String fileName = file.getOriginalFilename() == null ? "tai-lieu" : file.getOriginalFilename();
        String setTitle = title == null || title.isBlank() ? stripExtension(fileName) : title.strip();
        ParsedDocument parsed;
        AiTokenUsageRecorder.setFeature(AiTokenUsage.AiFeature.SUBMISSION_REVIEW);   // đọc ảnh / PDF scan tốn token
        try {
            parsed = documentReader.read(FileRef.of(fileName, file.getBytes()));
        } catch (DocumentParser.Unparseable u) {
            throw new BusinessException("Không bóc được chữ từ tài liệu: " + u.getMessage() + ".");
        } catch (Exception e) {
            log.warn("Đọc tài liệu bộ tiêu chí {} lỗi: {}", fileName, e.toString());
            throw new BusinessException("Không đọc được tệp: tệp hỏng hoặc được bảo vệ bằng mật khẩu.");
        } finally {
            AiTokenUsageRecorder.clearFeature();
        }
        String sourceText = parsed.plainText();
        if (sourceText.length() > MAX_SOURCE_CHARS) {
            sourceText = sourceText.substring(0, MAX_SOURCE_CHARS) + "\n… [đã cắt: đọc " + MAX_SOURCE_CHARS + "/" + sourceText.length() + " ký tự]";
            parsed = ParsedDocument.fromText(fileName, parsed.format(), sourceText, parsed.source(), true, null);
        }

        // Loại tài liệu quyết định cách cắt mục và bộ nhóm (Strategy) — xem DocumentProfile.
        DocumentProfile profile = profiles.detectForCriteria(parsed);
        List<DocumentSection> sections = profile.sectioning(parsed).sections(parsed);
        CriteriaExtractor.Outcome out = extractor.extract(setTitle, sections, profile.criteriaScheme(), sourceText);
        if (out.rows().isEmpty() && !out.failed().isEmpty() && out.skipped().isEmpty()) {
            throw new BusinessException("AI chưa bóc được bộ tiêu chí lúc này. Bạn thử lại sau ít phút.");
        }
        if (out.rows().isEmpty()) {
            throw new BusinessException("Không thấy nội dung nào dùng để đánh giá kết quả công việc trong tài liệu này.");
        }

        List<String> skippedLines = new java.util.ArrayList<>(out.skipped());
        out.failed().forEach(f -> skippedLines.add("!" + f));
        AiCriteriaSet set = setRepository.save(AiCriteriaSet.builder()
                .organizationId(org.getId())
                .orgUnitId(orgUnitId)
                .title(setTitle)
                .status(AiCriteriaSet.DRAFT)
                .sourceFileName(fileName)
                .sourceText(sourceText)
                .profile(profile.kind().name())
                .skippedSections(String.join("\n", skippedLines))
                .createdBy(me.getId())
                .build());
        String haystack = CriteriaExtractor.compact(LegalStructureSectioning.withoutPageMarkers(sourceText));
        int pos = 0;
        for (CriteriaExtractor.Row r : out.rows()) {
            String excerpt = r.doanGoc() == null ? null : r.doanGoc().strip();
            itemRepository.save(AiCriteriaSetItem.builder()
                    .setId(set.getId())
                    .position(pos++)
                    .kind(r.kind())
                    .section(r.section() == null ? null : cut(r.section(), 255))
                    .topic(r.topic() == null ? null : cut(r.topic(), 120))
                    .name(cut(r.ten(), 255))
                    .description(r.moTa())
                    .weight(r.trongSo() == null ? null : BigDecimal.valueOf(r.trongSo()))
                    .scaleLevels(r.cacMuc() == null || r.cacMuc().isEmpty() ? null : String.join("\n", r.cacMuc()))
                    .scope(r.phamVi())
                    .sourceExcerpt(excerpt)
                    // Đoạn gốc phải có thật trong tài liệu — không có thì màn duyệt cảnh báo dòng này.
                    .excerptVerified(CriteriaExtractor.excerptFound(haystack, excerpt))
                    .build());
        }
        return detail(set, true, viewer(me, org.getId()));
    }

    // ── đối chiếu, xác nhận ───────────────────────────────────────────────

    @Transactional
    public AiCriteriaSetResponse updateItems(UUID setId, AiCriteriaItemsRequest req) {
        AiCriteriaSet set = ownDraft(setId);
        String haystack = CriteriaExtractor.compact(LegalStructureSectioning.withoutPageMarkers(set.getSourceText()));
        CriteriaScheme scheme = profiles.forName(set.getProfile()).criteriaScheme();
        itemRepository.deleteBySetId(set.getId());
        itemRepository.flush();
        int pos = 0;
        for (AiCriteriaItemsRequest.Item i : req.getItems()) {
            String excerpt = i.getSourceExcerpt() == null ? null : i.getSourceExcerpt().strip();
            itemRepository.save(AiCriteriaSetItem.builder()
                    .setId(set.getId())
                    .position(pos++)
                    .kind(i.getKind() != null && scheme.allows(i.getKind()) ? i.getKind() : scheme.fallbackRole())
                    .section(i.getSection() == null ? null : cut(i.getSection(), 255))
                    .topic(i.getTopic() == null || i.getTopic().isBlank() ? null : cut(i.getTopic(), 120))
                    .name(i.getName().strip())
                    .description(i.getDescription())
                    .weight(i.getWeight())
                    .scaleLevels(i.getScaleLevels())
                    .scope(i.getScope())
                    .sourceExcerpt(excerpt)
                    .excerptVerified(CriteriaExtractor.excerptFound(haystack, excerpt))
                    .reviewerConfirmed(Boolean.TRUE.equals(i.getReviewerConfirmed()))
                    .build());
        }
        return detail(set, true);
    }

    /**
     * Xác nhận bản nháp = ÁP DỤNG nó cho đơn vị đã chọn. Đơn vị đang áp tài liệu của mình / cấp dưới → tài liệu
     * đó ngừng áp dụng (giao diện đã hỏi trước); của cấp trên → chặn kèm lý do (gửi đề nghị thay vì xác nhận).
     */
    @Transactional
    public AiCriteriaSetResponse confirm(UUID setId) {
        AiCriteriaSet set = ownDraft(setId);
        List<AiCriteriaSetItem> items = itemRepository.findBySetIdOrderByPositionAsc(set.getId());
        if (items.isEmpty()) throw new BusinessException("Bộ tiêu chí chưa có dòng nào.");
        User me = currentUser();
        applyTo(set, set.getOrgUnitId(), me, true, me.getId());
        return detail(set, true);
    }

    /** Ngừng áp dụng: đơn vị quay về tài liệu của đơn vị cha (nếu có) hoặc thang chung. Tài liệu còn đó, áp lại được. */
    @Transactional
    public AiCriteriaSetResponse stop(UUID setId) {
        AiCriteriaSet set = manageableSet(setId);
        if (!AiCriteriaSet.CONFIRMED.equals(set.getStatus())) {
            throw new BusinessException("Tài liệu này không đang được áp dụng.");
        }
        stopApplying(set);
        return detail(set, false);
    }

    /** Áp lại một tài liệu đã ngừng cho một đơn vị chưa có tài liệu đang áp. */
    @Transactional
    public AiCriteriaSetResponse reapply(UUID setId, UUID orgUnitId) {
        AiCriteriaSet set = manageableSet(setId);
        if (!AiCriteriaSet.ARCHIVED.equals(set.getStatus())) {
            throw new BusinessException("Chỉ áp lại được tài liệu đã ngừng áp dụng.");
        }
        User me = currentUser();
        applyTo(set, orgUnitId, me, false, me.getId());
        return detail(set, false);
    }

    /**
     * Xoá một bộ ở mọi trạng thái. Lượt AI đã chấm theo bộ này vẫn giữ số phiên bản và bản chụp tiêu chí
     * trong vết chạy — chỉ bỏ liên kết. Xoá bộ đang áp thì đơn vị quay về tài liệu cấp trên / thang chung.
     */
    @Transactional
    public void delete(UUID setId) {
        AiCriteriaSet set = manageableSet(setId);
        reviewRepository.detachCriteriaSet(set.getId());
        removeFromKnowledgeBase(set);
        setRepository.delete(set);
    }

    // ── áp dụng: lõi chung ────────────────────────────────────────────────

    /**
     * Áp {@code set} cho {@code unitId} — lõi chung của xác nhận, áp lại, chuyển đơn vị, nhân bản và duyệt đề nghị.
     * Mỗi đơn vị MỘT tài liệu đang áp:
     * <ul>
     *   <li>tài liệu hiện có do cấp trên áp → chặn, lời báo nêu tài liệu + người áp + chức vụ;</li>
     *   <li>do mình / cấp dưới áp → {@code allowReplace} thì tài liệu đó ngừng áp dụng, không thì chặn (chuyển /
     *       nhân bản: phải ngừng tài liệu đó trước — đơn vị có dấu tích trên ô chọn).</li>
     * </ul>
     *
     * @param appliedBy người được ghi là người áp (duyệt đề nghị: người ĐỀ NGHỊ — đơn vị chuyển hẳn sang quy chế
     *                  của họ)
     */
    public void applyTo(AiCriteriaSet set, UUID unitId, User actor, boolean allowReplace, UUID appliedBy) {
        UUID orgId = set.getOrganizationId();
        if (unitId != null) requireUnitInOrg(unitId, orgId);
        if (!authority.canManageUnit(actor.getId(), orgId, unitId)) {
            throw new ForbiddenException(outsideScope(orgId, unitId));
        }
        AiCriteriaSet current = activeAt(orgId, unitId, set.getId());
        if (current != null) {
            String label = unitLabel(orgId, unitId);
            if (authority.lockedFor(actor.getId(), current)) {
                throw new BusinessException(authority.lockReason(current, label));
            }
            if (!allowReplace) {
                throw new BusinessException(label + " đang áp «" + current.getTitle()
                        + "». Ngừng áp dụng tài liệu đó trước, mỗi đơn vị chỉ áp một tài liệu.");
            }
            stopApplying(current);
        }
        set.setStatus(AiCriteriaSet.CONFIRMED);
        set.setOrgUnitId(unitId);
        set.setVersion(nextVersion(orgId, unitId, set.getId()));
        set.setConfirmedBy(appliedBy);
        set.setConfirmedAt(Instant.now());
        if (set.getRagDocumentId() == null) set.setRagDocumentId(addToKnowledgeBase(set, actor.getId()));
        setRepository.save(set);
        // Đề nghị đang chờ của chính tài liệu này hết ý nghĩa khi nó đã được áp bằng đường khác.
        requestRepository.findByProposedSetIdAndStatus(set.getId(), AiCriteriaChangeRequest.PENDING).ifPresent(r -> {
            r.setStatus(AiCriteriaChangeRequest.CANCELLED);
            r.setDecidedAt(Instant.now());
            requestRepository.save(r);
        });
    }

    /** Tài liệu đang áp ở đúng phạm vi {@code unitId} (null = cả tổ chức), bỏ qua {@code exceptId}. */
    public AiCriteriaSet activeAt(UUID orgId, UUID unitId, UUID exceptId) {
        return setRepository.findByOrganizationIdAndStatus(orgId, AiCriteriaSet.CONFIRMED).stream()
                .filter(s -> Objects.equals(s.getOrgUnitId(), unitId) && !s.getId().equals(exceptId))
                .findFirst().orElse(null);
    }

    private void stopApplying(AiCriteriaSet set) {
        set.setStatus(AiCriteriaSet.ARCHIVED);
        // Không còn là căn cứ — gỡ khỏi kho tri thức để AI không trích quy chế đã ngừng.
        removeFromKnowledgeBase(set);
        setRepository.save(set);
    }

    /**
     * Nạp TOÀN VĂN tài liệu vào kho tri thức của tổ chức (theo loại tài liệu đã nhận ra), cắt theo cùng các mục — để
     * lúc chấm, bước "regulations" trích được đoạn nhiệm vụ / quy định liên quan tới bài nộp. Lỗi nạp không
     * làm hỏng việc xác nhận: bộ tiêu chí vẫn dùng được, chỉ thiếu phần trích quy chế.
     */
    private UUID addToKnowledgeBase(AiCriteriaSet set, UUID userId) {
        try {
            DocumentProfile profile = profiles.forName(set.getProfile());
            ParsedDocument parsed = ParsedDocument.fromText(set.getSourceFileName(), set.getSourceText());
            List<DocumentSection> sections = profile.sectioning(parsed).sections(parsed);
            var doc = ingestion.ingestSections(sections, set.getSourceFileName(),
                    set.getTitle() + " (v" + set.getVersion() + ")", profile.kind(), set.getOrganizationId(), userId);
            return doc.getStatus() == com.kpitracking.entity.RagDocument.Status.READY ? doc.getId() : null;
        } catch (Exception e) {
            log.warn("Nạp bộ tiêu chí {} vào kho tri thức lỗi: {}", set.getId(), e.toString());
            return null;
        }
    }

    private void removeFromKnowledgeBase(AiCriteriaSet set) {
        if (set.getRagDocumentId() == null) return;
        // Bản nhân bản dùng chung tài liệu trong kho — chỉ gỡ khi không còn bộ nào khác trỏ tới.
        if (!setRepository.existsByRagDocumentIdAndIdNot(set.getRagDocumentId(), set.getId())) {
            try {
                ingestion.delete(set.getRagDocumentId());
            } catch (Exception e) {
                log.warn("Gỡ tài liệu {} khỏi kho tri thức lỗi: {}", set.getRagDocumentId(), e.toString());
            }
        }
        set.setRagDocumentId(null);
    }

    // ── sửa thông tin, nhân bản ───────────────────────────────────────────

    /**
     * Đổi tên / đơn vị áp dụng. Bản nháp: đổi sang đơn vị nào trong phạm vi cũng được (bị khoá thì lúc xác nhận
     * gửi đề nghị). Tài liệu đang áp: chuyển sang đơn vị CHƯA có tài liệu đang áp. Tài liệu đã ngừng: chỉ đổi tên
     * (áp cho đơn vị nào thì dùng "Áp dụng lại"). Tên trống = giữ tên cũ.
     */
    @Transactional
    public AiCriteriaSetResponse updateInfo(UUID setId, AiCriteriaSetMetaRequest req) {
        AiCriteriaSet set = manageableSet(setId);
        User me = currentUser();
        UUID unitId = req.getOrgUnitId();
        if (req.getTitle() != null && !req.getTitle().isBlank()) set.setTitle(cut(req.getTitle(), 255));
        if (!Objects.equals(unitId, set.getOrgUnitId())) {
            switch (set.getStatus()) {
                case AiCriteriaSet.ARCHIVED -> throw new BusinessException(
                        "Tài liệu đã ngừng áp dụng — chọn «Áp dụng lại cho…» để áp cho đơn vị khác.");
                case AiCriteriaSet.CONFIRMED -> applyTo(set, unitId, me, false, me.getId());
                default -> {
                    if (unitId != null) requireUnitInOrg(unitId, set.getOrganizationId());
                    if (!authority.canManageUnit(me.getId(), set.getOrganizationId(), unitId)) {
                        throw new ForbiddenException(outsideScope(set.getOrganizationId(), unitId));
                    }
                    set.setOrgUnitId(unitId);
                }
            }
        }
        return detail(setRepository.save(set), false);
    }

    /**
     * Nhân bản sang một đơn vị trong phạm vi. Bản sao của tài liệu đang áp dùng NGAY cho đơn vị đó (nội dung đã
     * được người duyệt xác nhận) và dùng chung tài liệu trong kho tri thức — đơn vị đích phải chưa có tài liệu
     * đang áp. {@code asDraft} (nhân bản để gửi đề nghị cho đơn vị bị khoá) hoặc nguồn là bản nháp / đã ngừng →
     * bản nháp. Có thể nhân bản tài liệu của cấp trên đang áp cho đơn vị cha của mình. Tên trống → "<tên> – <đơn vị>".
     */
    @Transactional
    public AiCriteriaSet cloneTo(UUID setId, AiCriteriaSetMetaRequest req, boolean asDraft) {
        AiCriteriaSet src = visibleSet(setId);
        UUID orgId = src.getOrganizationId();
        UUID unitId = req.getOrgUnitId();
        User me = currentUser();
        if (unitId != null) requireUnitInOrg(unitId, orgId);
        if (!authority.canManageUnit(me.getId(), orgId, unitId)) throw new ForbiddenException(outsideScope(orgId, unitId));
        boolean active = AiCriteriaSet.CONFIRMED.equals(src.getStatus()) && !asDraft;
        String title = req.getTitle() == null || req.getTitle().isBlank()
                ? cut(src.getTitle() + " – " + unitLabel(orgId, unitId), 255) : cut(req.getTitle(), 255);
        AiCriteriaSet copy = setRepository.save(AiCriteriaSet.builder()
                .organizationId(orgId)
                .orgUnitId(unitId)
                .title(title)
                .status(AiCriteriaSet.DRAFT)
                .sourceFileName(src.getSourceFileName())
                .sourceText(src.getSourceText())
                .profile(src.getProfile())
                .skippedSections(src.getSkippedSections())
                // Chỉ bản dùng ngay mới dùng chung tài liệu kho; bản nháp nạp riêng khi được áp.
                .ragDocumentId(active ? src.getRagDocumentId() : null)
                .createdBy(me.getId())
                .build());
        for (AiCriteriaSetItem i : itemRepository.findBySetIdOrderByPositionAsc(src.getId())) {
            itemRepository.save(AiCriteriaSetItem.builder()
                    .setId(copy.getId()).position(i.getPosition()).kind(i.getKind()).section(i.getSection())
                    .topic(i.getTopic()).name(i.getName()).description(i.getDescription()).weight(i.getWeight())
                    .scaleLevels(i.getScaleLevels()).scope(i.getScope()).sourceExcerpt(i.getSourceExcerpt())
                    .excerptVerified(i.getExcerptVerified()).reviewerConfirmed(i.getReviewerConfirmed())
                    .build());
        }
        if (active) applyTo(copy, unitId, me, false, me.getId());
        return copy;
    }

    @Transactional
    public AiCriteriaSetResponse cloneTo(UUID setId, AiCriteriaSetMetaRequest req) {
        AiCriteriaSet copy = cloneTo(setId, req, false);
        return detail(copy, false);
    }

    /** Số phiên bản kế tiếp trong một phạm vi (bỏ qua chính {@code exceptId}). */
    private int nextVersion(UUID orgId, UUID unitId, UUID exceptId) {
        return setRepository.findByOrganizationIdOrderByCreatedAtDesc(orgId).stream()
                .filter(s -> Objects.equals(s.getOrgUnitId(), unitId) && !s.getId().equals(exceptId))
                .map(AiCriteriaSet::getVersion).filter(Objects::nonNull)
                .max(Integer::compare).orElse(0) + 1;
    }

    // ── đọc ───────────────────────────────────────────────────────────────

    /**
     * Các bộ người này thấy: ở đơn vị trong phạm vi của họ, do họ tạo, tài liệu ĐANG ÁP cho đơn vị cha của họ
     * (chỉ xem — để hiểu vì sao bị khoá), và tài liệu được đề nghị mà họ là người quyết.
     */
    @Transactional(readOnly = true)
    public List<AiCriteriaSetResponse> list() {
        User me = currentUser();
        Organization org = organizationOf(me);
        Viewer v = viewer(me, org.getId());
        return setRepository.findByOrganizationIdOrderByCreatedAtDesc(org.getId()).stream()
                .filter(s -> canView(v, s))
                .map(s -> summary(s, v))
                .toList();
    }

    @Transactional(readOnly = true)
    public AiCriteriaSetResponse get(UUID setId) {
        User me = currentUser();
        AiCriteriaSet set = visibleSet(setId);
        return detail(set, true, viewer(me, set.getOrganizationId()));
    }

    /** Đơn vị người này áp được — cho ô chọn đơn vị. */
    @Transactional(readOnly = true)
    public AiCriteriaAuthority.Scope manageableUnits() {
        User me = currentUser();
        return viewer(me, organizationOf(me).getId()).scope();
    }

    // ── quyền trên một bộ ─────────────────────────────────────────────────

    /** Người xem + phạm vi của họ + đường dẫn đơn vị — tính một lần cho cả danh sách. */
    record Viewer(UUID userId, UUID orgId, AiCriteriaAuthority.Scope scope, Map<UUID, OrgUnit> units,
                  java.util.Set<UUID> decidableProposals) {}

    Viewer viewer(User me, UUID orgId) {
        Map<UUID, OrgUnit> units = new java.util.HashMap<>();
        for (OrgUnit u : orgUnitRepository.findSubtree("/", orgId)) units.put(u.getId(), u);
        AiCriteriaAuthority.Scope scope = authority.scopeOf(me.getId(), orgId, units.values());
        java.util.Set<UUID> decidable = new java.util.HashSet<>();
        for (AiCriteriaChangeRequest r : requestRepository.findByOrganizationIdAndStatusOrderByCreatedAtDesc(
                orgId, AiCriteriaChangeRequest.PENDING)) {
            if (scope.covers(r.getOrgUnitId()) && !me.getId().equals(r.getRequestedBy())) decidable.add(r.getProposedSetId());
        }
        return new Viewer(me.getId(), orgId, scope, units, decidable);
    }

    private boolean canView(Viewer v, AiCriteriaSet s) {
        if (v.userId().equals(s.getCreatedBy()) || v.scope().covers(s.getOrgUnitId())) return true;
        if (v.decidableProposals().contains(s.getId())) return true;
        if (!AiCriteriaSet.CONFIRMED.equals(s.getStatus())) return false;
        if (s.getOrgUnitId() == null) return true;                  // áp cả tổ chức: ai cũng chịu ảnh hưởng
        OrgUnit at = v.units().get(s.getOrgUnitId());
        return at != null && at.getPath() != null && v.scope().unitIds().stream()
                .map(v.units()::get)
                .anyMatch(u -> u != null && u.getPath() != null && u.getPath().startsWith(at.getPath()));
    }

    /** Sửa / ngừng / xoá được không. Tài liệu đang áp: trong phạm vi VÀ không bị cấp trên khoá. */
    private boolean canManage(Viewer v, AiCriteriaSet s) {
        if (AiCriteriaSet.CONFIRMED.equals(s.getStatus())) {
            return v.scope().covers(s.getOrgUnitId()) && !authority.lockedFor(v.userId(), s);
        }
        return v.userId().equals(s.getCreatedBy()) || v.scope().covers(s.getOrgUnitId());
    }

    /** Bộ trong tổ chức mà người này XEM được. */
    public AiCriteriaSet visibleSet(UUID setId) {
        User me = currentUser();
        AiCriteriaSet set = inOrg(setId, me);
        if (!canView(viewer(me, set.getOrganizationId()), set)) {
            throw new ForbiddenException("Bộ tiêu chí này không thuộc đơn vị bạn quản lý.");
        }
        return set;
    }

    /** Bộ người này SỬA được; tài liệu cấp trên đang áp → báo lý do. */
    public AiCriteriaSet manageableSet(UUID setId) {
        User me = currentUser();
        AiCriteriaSet set = inOrg(setId, me);
        Viewer v = viewer(me, set.getOrganizationId());
        if (canManage(v, set)) return set;
        if (AiCriteriaSet.CONFIRMED.equals(set.getStatus()) && v.scope().covers(set.getOrgUnitId())) {
            throw new ForbiddenException(authority.lockReason(set, unitLabel(set.getOrganizationId(), set.getOrgUnitId())));
        }
        throw new ForbiddenException("Bộ tiêu chí này không thuộc đơn vị bạn quản lý.");
    }

    private AiCriteriaSet inOrg(UUID setId, User me) {
        Organization org = organizationOf(me);
        return setRepository.findByIdAndOrganizationId(setId, org.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Bộ tiêu chí", "id", setId));
    }

    private AiCriteriaSet ownDraft(UUID setId) {
        AiCriteriaSet set = manageableSet(setId);
        if (!AiCriteriaSet.DRAFT.equals(set.getStatus())) {
            throw new BusinessException("Chỉ sửa được bản nháp. Muốn đổi nội dung tài liệu đang áp, hãy tải tài liệu lên lại.");
        }
        return set;
    }

    // ── dựng kết quả trả về ───────────────────────────────────────────────

    private AiCriteriaSetResponse summary(AiCriteriaSet s, Viewer v) {
        AiCriteriaSetResponse r = AiCriteriaSetResponse.builder()
                .id(s.getId()).title(s.getTitle()).orgUnitId(s.getOrgUnitId())
                .orgUnitName(s.getOrgUnitId() == null ? null : unitName(v, s.getOrgUnitId()))
                .version(s.getVersion()).status(s.getStatus()).sourceFileName(s.getSourceFileName())
                .createdAt(s.getCreatedAt()).confirmedAt(s.getConfirmedAt())
                .build();
        if (v == null) return r;
        r.setCanManage(canManage(v, s));
        if (AiCriteriaSet.CONFIRMED.equals(s.getStatus())) {
            AiCriteriaAuthority.Applier a = authority.applierOf(s);
            if (a != null) {
                r.setAppliedByName(a.name());
                r.setAppliedByRole(a.role());
            }
            // "Cấp trên áp": tài liệu đang áp ở đơn vị mình quản lý mà mình không thay được.
            boolean locked = v.scope().covers(s.getOrgUnitId()) && authority.lockedFor(v.userId(), s);
            r.setLocked(locked);
            if (locked) r.setLockReason(authority.lockReason(s, unitLabel(v, s.getOrgUnitId())));
        }
        requestRepository.findByProposedSetIdAndStatus(s.getId(), AiCriteriaChangeRequest.PENDING).ifPresent(req ->
                r.setPendingRequest(AiCriteriaSetResponse.PendingRequest.builder()
                        .id(req.getId())
                        .orgUnitId(req.getOrgUnitId())
                        .orgUnitName(unitName(v, req.getOrgUnitId()))
                        .approverName(req.getApproverId() == null ? null
                                : userRepository.findById(req.getApproverId()).map(User::getFullName).orElse(null))
                        .mine(v.userId().equals(req.getRequestedBy()))
                        .createdAt(req.getCreatedAt())
                        .build()));
        return r;
    }

    private AiCriteriaSetResponse detail(AiCriteriaSet s, boolean withSource) {
        return detail(s, withSource, viewer(currentUser(), s.getOrganizationId()));
    }

    private AiCriteriaSetResponse detail(AiCriteriaSet s, boolean withSource, Viewer v) {
        AiCriteriaSetResponse r = summary(s, v);
        if (withSource) r.setSourceText(s.getSourceText());
        List<String> lines = s.getSkippedSections() == null || s.getSkippedSections().isBlank()
                ? List.of() : List.of(s.getSkippedSections().split("\n"));
        r.setSkippedSections(lines.stream().filter(l -> !l.startsWith("!")).toList());
        r.setFailedSections(lines.stream().filter(l -> l.startsWith("!")).map(l -> l.substring(1)).toList());
        r.setInKnowledgeBase(s.getRagDocumentId() != null);
        DocumentProfile profile = profiles.forName(s.getProfile());
        r.setProfile(profile.kind().name());
        r.setProfileLabel(profile.label());
        r.setRoles(profile.criteriaScheme().roles());
        r.setItems(itemRepository.findBySetIdOrderByPositionAsc(s.getId()).stream()
                .map(i -> AiCriteriaSetResponse.Item.builder()
                        .id(i.getId()).name(i.getName()).description(i.getDescription()).weight(i.getWeight())
                        .scaleLevels(i.getScaleLevels()).scope(i.getScope()).sourceExcerpt(i.getSourceExcerpt())
                        .excerptVerified(i.getExcerptVerified())
                        .reviewerConfirmed(i.getReviewerConfirmed())
                        .kind(i.getKind())
                        .section(i.getSection())
                        .topic(i.getTopic())
                        .build())
                .toList());
        return r;
    }

    // ── tiện ích ──────────────────────────────────────────────────────────

    private static String unitName(Viewer v, UUID unitId) {
        OrgUnit u = v == null || unitId == null ? null : v.units().get(unitId);
        return u == null ? null : u.getName();
    }

    private static String unitLabel(Viewer v, UUID unitId) {
        if (unitId == null) return "Cả tổ chức";
        String name = unitName(v, unitId);
        return name == null ? "Đơn vị này" : name;
    }

    /** "Cả tổ chức" / tên đơn vị — dùng trong lời báo. */
    public String unitLabel(UUID orgId, UUID unitId) {
        if (unitId == null) return "Cả tổ chức";
        return orgUnitRepository.findById(unitId).map(OrgUnit::getName).orElse("Đơn vị này");
    }

    private String outsideScope(UUID orgId, UUID unitId) {
        return unitId == null
                ? "Chỉ người cấu hình AI của công ty mới áp tài liệu cho cả tổ chức."
                : unitLabel(orgId, unitId) + " không thuộc các đơn vị bạn quản lý.";
    }

    public void requireUnitInOrg(UUID unitId, UUID orgId) {
        boolean ok = orgUnitRepository.findSubtree("/", orgId).stream().anyMatch(u -> u.getId().equals(unitId));
        if (!ok) throw new ForbiddenException("Đơn vị không thuộc tổ chức của bạn.");
    }

    public Organization organizationOf(User me) {
        List<UserRoleOrgUnit> a = userRoleOrgUnitRepository.findByUserId(me.getId());
        if (a.isEmpty() || a.get(0).getOrgUnit() == null) throw new ForbiddenException("Bạn chưa thuộc tổ chức nào.");
        return a.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization();
    }

    public User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }

    private static String stripExtension(String name) {
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }

    private static String cut(String s, int max) {
        String t = s.strip();
        return t.length() <= max ? t : t.substring(0, max);
    }
}
