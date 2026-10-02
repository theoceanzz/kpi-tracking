package com.kpitracking.service.document;

import com.kpitracking.dto.request.document.ShareDocumentRequest;
import com.kpitracking.dto.response.document.DocumentShareResponse;
import com.kpitracking.dto.response.document.ShareTargetResponse;
import com.kpitracking.dto.response.document.ShareUnitResponse;
import com.kpitracking.entity.Document;
import com.kpitracking.entity.DocumentShare;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.repository.DocumentShareRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.security.audit.SecurityAuditEvent;
import com.kpitracking.security.audit.SecurityAuditService;
import com.kpitracking.service.notification.NotificationDispatcher;
import com.kpitracking.service.reward.RewardContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Chia sẻ quyền XEM tài liệu cho người hoặc đơn vị (docs/DOCUMENTS_DESIGN.md §15.3).
 *
 * <p>Chỉ người SỬA được tài liệu mới chia sẻ / gỡ chia sẻ (chủ kho cá nhân, người quản lý tài liệu đơn vị/công ty).
 * Chia sẻ chỉ cho quyền xem: người nhận đọc, tải về, và K.AI đọc tài liệu khi trả lời họ — không sửa, không chia sẻ
 * tiếp ({@link DocumentAccess#canEdit} không xét chia sẻ). Chia sẻ cho đơn vị = thành viên đơn vị đó và đơn vị con.
 */
@Service
@Slf4j
public class DocumentShareService {

    static final String EVENT_SHARED = "document_shared";
    static final String TYPE = "DOCUMENT_SHARED";
    /** Chia sẻ cho đơn vị lớn chỉ báo chuông tối đa bấy nhiêu người — tránh một thao tác sinh hàng nghìn thông báo. */
    private static final int MAX_UNIT_NOTIFICATIONS = 200;
    private static final int MAX_TARGETS = 20;

    private final DocumentService base;
    private final DocumentShareRepository shares;
    private final UserRepository users;
    private final UserRoleOrgUnitRepository assignments;
    private final PermissionChecker permissionChecker;
    private final NotificationDispatcher notifications;
    private final RewardContext context;
    private final SecurityAuditService audit;
    private final TransactionTemplate tx;

    public DocumentShareService(DocumentService base, DocumentShareRepository shares, UserRepository users,
                                UserRoleOrgUnitRepository assignments, PermissionChecker permissionChecker,
                                NotificationDispatcher notifications, RewardContext context,
                                SecurityAuditService audit, PlatformTransactionManager txManager) {
        this.base = base;
        this.shares = shares;
        this.users = users;
        this.assignments = assignments;
        this.permissionChecker = permissionChecker;
        this.notifications = notifications;
        this.context = context;
        this.audit = audit;
        this.tx = new TransactionTemplate(txManager);
    }

    public List<DocumentShareResponse> list(UUID documentId) {
        DocumentService.Viewer v = base.viewer();
        Document d = DocumentService.editable(v, base.visible(v, documentId));
        return toResponses(v, shares.findByDocumentIdOrderByCreatedAtAsc(d.getId()));
    }

    /** Thêm chia sẻ; người/đơn vị đã có thì bỏ qua. Người mới nhận được báo chuông (và email theo cấu hình tổ chức). */
    public List<DocumentShareResponse> add(UUID documentId, ShareDocumentRequest req) {
        DocumentService.Viewer v = base.viewer();
        Document d = DocumentService.editable(v, base.visible(v, documentId));
        Set<UUID> userIds = new LinkedHashSet<>(req.userIds() == null ? List.of() : req.userIds());
        Set<UUID> unitIds = new LinkedHashSet<>(req.unitIds() == null ? List.of() : req.unitIds());
        userIds.remove(null);
        unitIds.remove(null);
        if (userIds.isEmpty() && unitIds.isEmpty()) {
            throw new BusinessException(ErrorCode.DOCUMENT_SHARE_INVALID, ErrorMessages.text("document.share.empty", "empty"));
        }
        UUID me = v.user().getId();
        for (UUID u : userIds) {
            if (u.equals(d.getOwnerUserId())) {
                throw new BusinessException(ErrorCode.DOCUMENT_SHARE_INVALID, ErrorMessages.text("document.share.self", "owner"));
            }
            if (!permissionChecker.isMemberOfOrganization(u, v.orgId())) {
                throw new BusinessException(ErrorCode.DOCUMENT_SHARE_INVALID, ErrorMessages.text("document.share.notMember", "user"));
            }
        }
        Set<UUID> roots = roots(v);
        for (UUID u : unitIds) {
            if (!v.units().containsKey(u)) {
                throw new BusinessException(ErrorCode.DOCUMENT_SHARE_INVALID, ErrorMessages.text("document.share.unitNotFound", "unit"));
            }
            // Chia sẻ cho đơn vị gốc = cả công ty xem và K.AI đọc khi trả lời mọi người, tức thành tài liệu công ty mà
            // không qua người quản lý tài liệu công ty. Muốn vậy thì đề xuất lên Công ty (§16.7).
            if (roots.contains(u)) throw new BusinessException(ErrorCode.DOCUMENT_SHARE_ROOT_UNIT);
        }

        List<UUID> newUsers = new ArrayList<>();
        List<UUID> newUnits = new ArrayList<>();
        tx.executeWithoutResult(s -> {
            for (UUID u : userIds) {
                if (u.equals(me) || shares.existsByDocumentIdAndGranteeUserId(d.getId(), u)) continue;
                shares.save(DocumentShare.builder().documentId(d.getId()).granteeUserId(u).grantedBy(me).build());
                newUsers.add(u);
            }
            for (UUID u : unitIds) {
                if (shares.existsByDocumentIdAndGranteeUnitId(d.getId(), u)) continue;
                shares.save(DocumentShare.builder().documentId(d.getId()).granteeUnitId(u).grantedBy(me).build());
                newUnits.add(u);
            }
        });
        if (!newUsers.isEmpty() || !newUnits.isEmpty()) {
            audit.record(SecurityAuditEvent.DOCUMENT_SHARED, SecurityAuditService.OK, "DOCUMENT", d.getId().toString(),
                    d.getScope().name() + " users=" + newUsers.size() + " units=" + newUnits.size());
            notifyRecipients(v, d, newUsers, newUnits);
        }
        return toResponses(v, shares.findByDocumentIdOrderByCreatedAtAsc(d.getId()));
    }

    public void remove(UUID documentId, UUID shareId) {
        DocumentService.Viewer v = base.viewer();
        Document d = DocumentService.editable(v, base.visible(v, documentId));
        DocumentShare share = shares.findByIdAndDocumentId(shareId, d.getId())
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.DOCUMENT_NOT_FOUND));
        shares.delete(share);
        audit.record(SecurityAuditEvent.DOCUMENT_UNSHARED, SecurityAuditService.OK, "DOCUMENT", d.getId().toString(),
                share.getGranteeUserId() != null ? "USER" : "UNIT");
    }

    /**
     * Người và đơn vị có thể nhận chia sẻ, theo từ khoá. Chỉ trả tên + email / đường dẫn đơn vị — không thêm thông tin
     * nhân sự. Người tìm phải là thành viên tổ chức (người ngoài nhận danh sách rỗng).
     */
    public List<ShareTargetResponse> targets(String q) {
        DocumentService.Viewer v = base.viewer();
        if (!v.access().member()) return List.of();
        String keyword = q == null ? "" : q.strip();
        UUID me = v.user().getId();
        List<ShareTargetResponse> out = new ArrayList<>();
        String lower = keyword.toLowerCase(Locale.ROOT);
        Set<UUID> roots = roots(v);
        v.units().values().stream()
                .filter(u -> !roots.contains(u.getId()))
                .filter(u -> lower.isEmpty() || u.getName().toLowerCase(Locale.ROOT).contains(lower))
                .sorted(Comparator.comparing(OrgUnit::getPath))
                .limit(keyword.isEmpty() ? 5 : 8)
                .forEach(u -> out.add(new ShareTargetResponse("UNIT", u.getId(), u.getName(), unitPathLabel(v, u))));
        users.searchForTool(v.orgId(), null, null, keyword, PageRequest.of(0, MAX_TARGETS)).stream()
                .filter(u -> !u.getId().equals(me))
                .forEach(u -> out.add(new ShareTargetResponse("USER", u.getId(), u.getFullName(), u.getEmail())));
        return out;
    }

    /**
     * Cây đơn vị để chọn chia sẻ (mọi đơn vị còn sống của tổ chức, TRỪ đơn vị gốc), kèm số người gắn trực tiếp. Chỉ
     * tên và số lượng — danh sách người tải riêng khi mở một đơn vị ({@link #unitMembers}).
     */
    public List<ShareUnitResponse> unitTree() {
        DocumentService.Viewer v = base.viewer();
        if (!v.access().member()) return List.of();
        Set<UUID> roots = roots(v);
        List<OrgUnit> units = v.units().values().stream()
                .filter(u -> !roots.contains(u.getId()))
                .sorted(Comparator.comparing(OrgUnit::getPath))
                .toList();
        if (units.isEmpty()) return List.of();
        Map<UUID, Long> counts = new HashMap<>();
        for (Object[] row : shares.countMembersByUnit(units.stream().map(OrgUnit::getId).toList())) {
            counts.put((UUID) row[0], ((Number) row[1]).longValue());
        }
        return units.stream().map(u -> new ShareUnitResponse(u.getId(), u.getName(), parentOf(v, u, roots),
                counts.getOrDefault(u.getId(), 0L))).toList();
    }

    /** Người đang làm việc gắn TRỰC TIẾP vào một đơn vị — tên + email, như kết quả tìm kiếm. */
    public List<ShareTargetResponse> unitMembers(UUID unitId) {
        DocumentService.Viewer v = base.viewer();
        if (!v.access().member() || !v.units().containsKey(unitId) || roots(v).contains(unitId)) return List.of();
        Map<UUID, User> people = new LinkedHashMap<>();
        for (UserRoleOrgUnit a : assignments.findByOrgUnitId(unitId)) {
            User u = a.getUser();
            if (u == null || u.getDeletedAt() != null || u.isPausedAccount()) continue;
            if (a.getExpiresAt() != null && a.getExpiresAt().isBefore(java.time.Instant.now())) continue;
            people.putIfAbsent(u.getId(), u);
        }
        return people.values().stream()
                .sorted(Comparator.comparing(u -> u.getFullName() == null ? "" : u.getFullName().toLowerCase(Locale.ROOT)))
                .map(u -> new ShareTargetResponse("USER", u.getId(), u.getFullName(), u.getEmail()))
                .toList();
    }

    // ── trợ giúp ───────────────────────────────────────────────────────────────────────────────────

    private static Set<UUID> roots(DocumentService.Viewer v) {
        Map<UUID, String> paths = new HashMap<>();
        v.units().forEach((id, u) -> paths.put(id, u.getPath()));
        return DocumentAccessResolver.rootUnitIds(paths);
    }

    /** Đơn vị cha trong cây chọn: cha thật, trừ khi cha là đơn vị gốc (gốc không hiện) thì là cấp đầu. */
    private static UUID parentOf(DocumentService.Viewer v, OrgUnit u, Set<UUID> roots) {
        UUID best = null;
        int bestLen = -1;
        for (OrgUnit p : v.units().values()) {
            if (p.getId().equals(u.getId()) || roots.contains(p.getId())) continue;
            if (u.getPath().startsWith(p.getPath()) && p.getPath().length() > bestLen) {
                best = p.getId();
                bestLen = p.getPath().length();
            }
        }
        return best;
    }

    private void notifyRecipients(DocumentService.Viewer v, Document d, List<UUID> userIds, List<UUID> unitIds) {
        String actor = v.user().getFullName();
        LocalizedText title = LocalizedText.of("notif.document.shared.title");
        Set<UUID> notified = new HashSet<>();
        notified.add(v.user().getId());
        for (User u : users.findAllById(userIds)) {
            if (!notified.add(u.getId()) || u.isPausedAccount()) continue;
            OrgUnit unit;
            try {
                unit = context.getPrimaryOrgUnit(u.getId());
            } catch (ResourceNotFoundException e) {
                continue;
            }
            notifications.dispatch(v.orgId(), EVENT_SHARED, u, unit, title,
                    LocalizedText.of("notif.document.shared.message", actor, d.getTitle()), TYPE, d.getId());
        }
        if (unitIds.isEmpty()) return;
        // Thành viên đơn vị được chia sẻ VÀ các đơn vị con — chỉ chuông, không email (có thể là cả nghìn người).
        Map<UUID, OrgUnit> sharedUnits = unitIds.stream().map(v.units()::get).filter(Objects::nonNull)
                .collect(Collectors.toMap(OrgUnit::getId, u -> u, (a, b) -> a));
        Map<UUID, OrgUnit> subtreeToShared = new HashMap<>();
        for (OrgUnit unit : v.units().values()) {
            sharedUnits.values().stream().filter(s -> unit.getPath().startsWith(s.getPath())).findFirst()
                    .ifPresent(s -> subtreeToShared.put(unit.getId(), s));
        }
        if (subtreeToShared.isEmpty()) return;
        int sent = 0;
        for (UserRoleOrgUnit a : assignments.findByOrgUnitIdIn(subtreeToShared.keySet())) {
            if (sent >= MAX_UNIT_NOTIFICATIONS) break;
            User u = a.getUser();
            if (u == null || u.getDeletedAt() != null || u.isPausedAccount() || !notified.add(u.getId())) continue;
            OrgUnit shared = subtreeToShared.get(a.getOrgUnit().getId());
            notifications.dispatchInAppOnly(v.orgId(), EVENT_SHARED, u, a.getOrgUnit(), title,
                    LocalizedText.of("notif.document.sharedUnit.message", actor, d.getTitle(), shared.getName()), TYPE, d.getId());
            sent++;
        }
    }

    private List<DocumentShareResponse> toResponses(DocumentService.Viewer v, List<DocumentShare> list) {
        if (list.isEmpty()) return List.of();
        Set<UUID> people = new HashSet<>();
        list.forEach(s -> {
            people.add(s.getGrantedBy());
            if (s.getGranteeUserId() != null) people.add(s.getGranteeUserId());
        });
        Map<UUID, User> byId = users.findAllById(people).stream().collect(Collectors.toMap(User::getId, u -> u, (a, b) -> a));
        return list.stream().map(s -> {
            User granter = byId.get(s.getGrantedBy());
            String grantedBy = granter == null ? null : granter.getFullName();
            if (s.getGranteeUserId() != null) {
                User u = byId.get(s.getGranteeUserId());
                return new DocumentShareResponse(s.getId(), "USER", s.getGranteeUserId(),
                        u == null ? null : u.getFullName(), u == null ? null : u.getEmail(), grantedBy, s.getCreatedAt());
            }
            OrgUnit unit = v.units().get(s.getGranteeUnitId());
            return new DocumentShareResponse(s.getId(), "UNIT", s.getGranteeUnitId(),
                    unit == null ? null : unit.getName(), unit == null ? null : unitPathLabel(v, unit), grantedBy, s.getCreatedAt());
        }).toList();
    }

    /** "Công ty › Khối KD › Phòng A" — đường dẫn tên đơn vị cha, để phân biệt hai đơn vị trùng tên. */
    private static String unitPathLabel(DocumentService.Viewer v, OrgUnit unit) {
        List<String> names = new ArrayList<>();
        for (OrgUnit u : v.units().values()) {
            if (!u.getId().equals(unit.getId()) && unit.getPath().startsWith(u.getPath())) names.add(u.getPath() + "\u0000" + u.getName());
        }
        Collections.sort(names);
        return names.stream().map(n -> n.substring(n.indexOf('\u0000') + 1)).collect(Collectors.joining(" › "));
    }
}
