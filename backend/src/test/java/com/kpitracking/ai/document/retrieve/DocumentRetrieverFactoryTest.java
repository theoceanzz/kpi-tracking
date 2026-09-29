package com.kpitracking.ai.document.retrieve;

import dev.langchain4j.store.embedding.filter.Filter;
import dev.langchain4j.store.embedding.filter.comparison.IsEqualTo;
import dev.langchain4j.store.embedding.filter.comparison.IsIn;
import dev.langchain4j.store.embedding.filter.comparison.IsNotIn;
import dev.langchain4j.store.embedding.filter.logical.And;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Chốt chặn đa tổ chức của MỌI lần đọc kho tri thức nằm ở {@link DocumentRetrieverFactory#filterFor}. Lọt ở đây
 * là tổ chức này đọc được quy chế của tổ chức khác.
 */
class DocumentRetrieverFactoryTest {

    private final String org = UUID.randomUUID().toString();

    @Test
    @DisplayName("HELP: có tổ chức → tài liệu chung + của tổ chức đó; không có → chỉ tài liệu chung")
    void helpSeesGlobalPlusOwnOrg() {
        Filter f = DocumentRetrieverFactory.filterFor(RetrievalProfile.HELP, org);
        assertThat(f).isInstanceOf(IsIn.class);
        assertThat(((IsIn) f).comparisonValues()).map(Object::toString).containsExactlyInAnyOrder("GLOBAL", org);

        Filter anonymous = DocumentRetrieverFactory.filterFor(RetrievalProfile.HELP, null);
        assertThat(((IsEqualTo) anonymous).comparisonValue()).isEqualTo("GLOBAL");
    }

    @Test
    @DisplayName("KPI_CONTEXT / SUBMISSION_REVIEW: CHỈ tổ chức đó (không thấy tài liệu chung) và đúng loại tài liệu")
    void orgOnlyProfilesFilterOrgAndSources() {
        And kpi = (And) DocumentRetrieverFactory.filterFor(RetrievalProfile.KPI_CONTEXT, org);
        assertThat(((IsEqualTo) kpi.left()).comparisonValue()).isEqualTo(org);
        assertThat(((IsIn) kpi.right()).comparisonValues()).map(Object::toString)
                .containsExactlyInAnyOrder("JOB_DESCRIPTION", "STRATEGY");

        And review = (And) DocumentRetrieverFactory.filterFor(RetrievalProfile.SUBMISSION_REVIEW, org);
        assertThat(((IsIn) review.right()).comparisonValues()).map(Object::toString)
                .containsExactlyInAnyOrder("REGULATION", "JOB_DESCRIPTION");
    }

    @Test
    @DisplayName("chấm bài: quy chế đang áp cho đơn vị khác bị loại (DOC_ID not in); danh sách rỗng → bộ lọc như cũ")
    void excludedDocumentsFilteredOut() {
        String other = UUID.randomUUID().toString();

        Filter f = DocumentRetrieverFactory.filterFor(RetrievalProfile.SUBMISSION_REVIEW, org, List.of(other));

        And and = (And) f;
        assertThat(and.right()).isInstanceOf(IsNotIn.class);
        assertThat(((IsNotIn) and.right()).key()).isEqualTo("docId");
        assertThat(((IsNotIn) and.right()).comparisonValues()).map(Object::toString).containsExactly(other);
        // Chốt chặn tổ chức vẫn nằm ở vế trái.
        assertThat(((And) and.left()).left()).isInstanceOf(IsEqualTo.class);

        assertThat(DocumentRetrieverFactory.filterFor(RetrievalProfile.SUBMISSION_REVIEW, org, List.of()))
                .isEqualTo(DocumentRetrieverFactory.filterFor(RetrievalProfile.SUBMISSION_REVIEW, org));
    }

    @Test
    @DisplayName("không biết tổ chức → KHÔNG đọc gì (an toàn hơn đọc tất cả)")
    void unknownOrgReadsNothing() {
        Filter f = DocumentRetrieverFactory.filterFor(RetrievalProfile.SUBMISSION_REVIEW, null);
        assertThat(f).isInstanceOf(IsEqualTo.class);
        assertThat(((IsEqualTo) f).comparisonValue()).isEqualTo(DocumentRetrieverFactory.NOBODY);
    }
}
