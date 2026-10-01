package com.kpitracking.ai.document.ingest;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Chốt chặn fail-closed phía GHI (docs/DOCUMENTS_DESIGN.md §6.2): đoạn không có phạm vi hợp lệ thì không nạp. */
class RagMetadataTest {

    @Test
    @DisplayName("requireScope: thiếu scope, scope lạ, hoặc thiếu khoá đi kèm thì không nạp")
    void requireScopeIsFailClosed() {
        String org = UUID.randomUUID().toString();
        assertThatThrownBy(() -> RagMetadata.requireScope(Map.of("orgId", org))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> RagMetadata.requireScope(Map.of("orgId", org, "scope", "UNIT"))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> RagMetadata.requireScope(Map.of("orgId", org, "scope", "PERSONAL"))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> RagMetadata.requireScope(Map.of("orgId", org, "scope", "GLOBAL"))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> RagMetadata.requireScope(Map.of("orgId", "GLOBAL", "scope", "COMPANY"))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> RagMetadata.requireScope(Map.of("orgId", org, "scope", "EVERYONE"))).isInstanceOf(IllegalArgumentException.class);

        RagMetadata.requireScope(Map.of("orgId", org, "scope", "COMPANY"));
        RagMetadata.requireScope(Map.of("orgId", org, "scope", "UNIT", "unitId", UUID.randomUUID().toString()));
        RagMetadata.requireScope(Map.of("orgId", org, "scope", "PERSONAL", "ownerId", UUID.randomUUID().toString()));
        RagMetadata.requireScope(Map.of("orgId", "GLOBAL", "scope", "GLOBAL"));
    }

    @Test
    @DisplayName("tài liệu rag_documents: bộ hướng dẫn → GLOBAL, của tổ chức → COMPANY")
    void scopeForRagDocuments() {
        assertThat(RagMetadata.scopeForOrgKey("GLOBAL")).isEqualTo("GLOBAL");
        assertThat(RagMetadata.scopeForOrgKey(UUID.randomUUID().toString())).isEqualTo("COMPANY");
    }
}
