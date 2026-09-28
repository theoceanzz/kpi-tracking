package com.kpitracking.i18n;

import com.kpitracking.entity.OrgHierarchyLevel;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

@DisplayName("Ngôn ngữ thực dùng: tự chọn → tổ chức → vi")
class UserLanguageResolverTest {

    private final UserLanguageResolver resolver = new UserLanguageResolver(mock(UserRoleOrgUnitRepository.class));

    private static UserRoleOrgUnit memberOf(String orgDefaultLanguage) {
        Organization org = Organization.builder().defaultLanguage(orgDefaultLanguage).build();
        OrgHierarchyLevel level = new OrgHierarchyLevel();
        level.setOrganization(org);
        OrgUnit unit = new OrgUnit();
        unit.setOrgHierarchyLevel(level);
        UserRoleOrgUnit uro = new UserRoleOrgUnit();
        uro.setOrgUnit(unit);
        return uro;
    }

    @Test
    @DisplayName("Người dùng đã tự chọn thì thắng mặc định của tổ chức")
    void preferredWins() {
        assertThat(resolver.effectiveLanguage("en", List.of(memberOf("vi")))).isEqualTo("en");
    }

    @Test
    @DisplayName("Chưa tự chọn thì theo tổ chức")
    void fallsBackToOrganization() {
        assertThat(resolver.effectiveLanguage(null, List.of(memberOf("en")))).isEqualTo("en");
    }

    @Test
    @DisplayName("Mã lạ hoặc chưa thuộc tổ chức nào thì ra tiếng Việt")
    void fallsBackToVietnamese() {
        assertThat(resolver.effectiveLanguage("fr", List.of(memberOf("de")))).isEqualTo("vi");
        assertThat(resolver.effectiveLanguage(null, List.of())).isEqualTo("vi");
    }
}
