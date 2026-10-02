package com.kpitracking.service.document;

import com.kpitracking.dto.response.document.DocumentStorageStatsResponse;
import com.kpitracking.dto.response.document.DocumentStorageStatsResponse.OwnerRow;
import com.kpitracking.dto.response.document.DocumentStorageStatsResponse.ScopeRow;
import com.kpitracking.dto.response.document.DocumentStorageStatsResponse.UnitRow;
import com.kpitracking.dto.response.document.DocumentStorageStatsResponse.Usage;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.enums.DocumentScope;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.DocumentRepository;
import com.kpitracking.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Màn "Dung lượng" cho quản trị (docs/DOCUMENTS_DESIGN.md §16.5): mỗi phạm vi dùng bao nhiêu, đơn vị nào / ai dùng
 * nhiều nhất, thùng rác và phiên bản cũ chiếm bao nhiêu. Cần {@code DOCUMENT:MANAGE_COMPANY}. Kho cá nhân chỉ lộ số
 * lượng và dung lượng theo người — cùng nguyên tắc với hộp "xoá sớm" (§5.5).
 */
@Service
public class DocumentStatsService {

    private static final int TOP = 20;

    private final DocumentService base;
    private final DocumentRepository documents;
    private final UserRepository users;
    private final DocumentSettings settings;

    public DocumentStatsService(DocumentService base, DocumentRepository documents, UserRepository users,
                                DocumentSettings settings) {
        this.base = base;
        this.documents = documents;
        this.users = users;
        this.settings = settings;
    }

    public DocumentStorageStatsResponse stats() {
        DocumentService.Viewer v = base.viewer();
        if (!v.access().canManageCompany()) throw new ForbiddenException(ErrorCode.DOCUMENT_FORBIDDEN);
        UUID org = v.orgId();

        Map<DocumentScope, ScopeRow> byScope = new EnumMap<>(DocumentScope.class);
        for (Object[] r : documents.statsByScope(org)) {
            DocumentScope s = DocumentScope.valueOf((String) r[0]);
            byScope.put(s, new ScopeRow(s, num(r[1]), num(r[2]), num(r[3]),
                    s == DocumentScope.COMPANY ? settings.companyQuotaBytes() : null));
        }
        List<ScopeRow> scopes = Arrays.stream(DocumentScope.values())
                .map(s -> byScope.getOrDefault(s, new ScopeRow(s, 0, 0, 0,
                        s == DocumentScope.COMPANY ? settings.companyQuotaBytes() : null)))
                .toList();

        List<UnitRow> units = documents.statsTopUnits(org, TOP).stream().map(r -> {
            UUID id = (UUID) r[0];
            OrgUnit u = v.units().get(id);
            return new UnitRow(id, u == null ? null : u.getName(), u == null ? null : pathLabel(v, u),
                    num(r[1]), num(r[2]), num(r[3]));
        }).toList();

        List<Object[]> ownerRows = documents.statsTopOwners(org, TOP);
        Map<UUID, User> people = users.findAllById(ownerRows.stream().map(r -> (UUID) r[0]).toList()).stream()
                .collect(Collectors.toMap(User::getId, Function.identity(), (a, b) -> a));
        List<OwnerRow> owners = ownerRows.stream().map(r -> {
            UUID id = (UUID) r[0];
            User u = people.get(id);
            // Không thấy = tài khoản đã xoá mềm (User ẩn dòng đã xoá).
            return new OwnerRow(id, u == null ? null : u.getFullName(), u == null ? null : u.getEmail(),
                    u == null || u.isPausedAccount(), num(r[1]), num(r[2]), num(r[3]));
        }).toList();

        return new DocumentStorageStatsResponse(scopes, usage(documents.statsTrash(org)), usage(documents.statsVersions(org)),
                units, owners, documents.sumChunks(org), settings.getOrgMaxChunks(), settings.unitQuotaBytes(),
                settings.personalQuotaBytes(), settings.getDeletedFileRetentionDays());
    }

    private static Usage usage(List<Object[]> rows) {
        if (rows.isEmpty()) return new Usage(0, 0);
        return new Usage(num(rows.get(0)[0]), num(rows.get(0)[1]));
    }

    private static long num(Object o) {
        return o instanceof Number n ? n.longValue() : 0L;
    }

    /** "Công ty › Khối KD" — đơn vị cha của {@code unit}, để phân biệt hai đơn vị trùng tên. */
    private static String pathLabel(DocumentService.Viewer v, OrgUnit unit) {
        return v.units().values().stream()
                .filter(u -> !u.getId().equals(unit.getId()) && unit.getPath().startsWith(u.getPath()))
                .sorted(Comparator.comparing(OrgUnit::getPath))
                .map(OrgUnit::getName)
                .collect(Collectors.joining(" › "));
    }
}
