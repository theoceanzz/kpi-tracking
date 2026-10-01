package com.kpitracking.mapper;

import com.kpitracking.dto.response.document.DocumentResponse;
import com.kpitracking.entity.Document;
import com.kpitracking.entity.RagDocument;
import com.kpitracking.enums.DocumentAiStatus;
import com.kpitracking.enums.DocumentCategory;
import com.kpitracking.enums.DocumentScope;
import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.service.document.DocumentAccess;
import org.mapstruct.AfterMapping;
import org.mapstruct.Context;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

import java.util.Map;
import java.util.UUID;
import java.util.function.Predicate;

@Mapper(componentModel = "spring")
public interface DocumentMapper {

    /**
     * Những thứ entity không tự biết: tên người/đơn vị (tra theo lô, xem {@code Document} vì sao không
     * {@code @ManyToOne}), quyền của người xem, và đơn vị đang lọc để đánh dấu tài liệu kế thừa.
     *
     * @param isStrictAncestorOfFilter tài liệu của đơn vị này có phải của một đơn vị CHA của đơn vị đang lọc
     */
    record ViewContext(Map<UUID, String> userNames, Map<UUID, String> unitNames, DocumentAccess access,
                       Predicate<UUID> isStrictAncestorOfFilter) {}

    @Mapping(target = "ownerId", source = "ownerUserId")
    @Mapping(target = "orgUnitName", ignore = true)
    @Mapping(target = "createdByName", ignore = true)
    @Mapping(target = "aiError", ignore = true)
    @Mapping(target = "canEdit", ignore = true)
    @Mapping(target = "inherited", ignore = true)
    @Mapping(target = "orphan", ignore = true)
    @Mapping(target = "legacy", ignore = true)
    DocumentResponse toResponse(Document document, @Context ViewContext ctx);

    @AfterMapping
    default void enrich(Document document, @MappingTarget DocumentResponse r, @Context ViewContext ctx) {
        if (document.getOrgUnitId() != null) r.setOrgUnitName(ctx.unitNames().get(document.getOrgUnitId()));
        r.setCreatedByName(ctx.userNames().get(document.getCreatedBy()));
        LocalizedText error = LocalizedText.fromJson(document.getAiErrorI18n());
        r.setAiError(error == null ? null : error.render());
        r.setCanEdit(ctx.access().canEdit(document));
        r.setOrphan(ctx.access().isOrphan(document));
        r.setInherited(document.getScope() == DocumentScope.UNIT
                && ctx.isStrictAncestorOfFilter().test(document.getOrgUnitId()));
    }

    /**
     * Tài liệu tri thức cũ (rag_documents): hiện ở tab Công ty với nhãn "Không có tệp gốc" (§4.4). Không có
     * tệp → không có loại/cỡ tệp; sửa được chỉ khi xoá hoặc tải tệp gốc lên thay thế.
     */
    default DocumentResponse fromLegacy(RagDocument legacy, boolean canManageCompany, Map<UUID, String> userNames) {
        DocumentResponse r = new DocumentResponse();
        r.setId(legacy.getId());
        r.setScope(DocumentScope.COMPANY);
        r.setTitle(legacy.getTitle());
        r.setFileName(legacy.getFileName());
        r.setCategory(switch (legacy.getSource()) {
            case REGULATION -> DocumentCategory.REGULATION;
            case JOB_DESCRIPTION -> DocumentCategory.JOB_DESCRIPTION;
            case STRATEGY -> DocumentCategory.STRATEGY;
            case GUIDE -> DocumentCategory.OTHER;
        });
        r.setVersion(1);
        r.setAiEnabled(true);
        r.setAiStatus(switch (legacy.getStatus()) {
            case READY -> DocumentAiStatus.READY;
            case FAILED -> DocumentAiStatus.FAILED;
            case PENDING -> DocumentAiStatus.INDEXING;
        });
        r.setAiChunkCount(legacy.getChunkCount());
        r.setAiError(legacy.getErrorMessage());
        r.setCreatedBy(legacy.getCreatedBy());
        r.setCreatedByName(legacy.getCreatedBy() == null ? null : userNames.get(legacy.getCreatedBy()));
        r.setCreatedAt(legacy.getCreatedAt());
        r.setUpdatedAt(legacy.getUpdatedAt());
        r.setCanEdit(canManageCompany);
        r.setLegacy(true);
        return r;
    }
}
