package com.kpitracking.tool;

import com.kpitracking.tool.ToolRegistry.Group;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.tool.annotation.Tool;

import java.lang.reflect.Method;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;

/**
 * Test cho bảng tra tên tool → nhóm, thứ mà tầng định tuyến dựa vào để nới nhóm theo kế hoạch.
 */
class ToolRegistryTest {

    /** Tên mọi @Tool thật, lấy bằng reflection giống hệt cách ModelCallStage gom. */
    private static Set<String> realToolNames() {
        Set<String> names = new LinkedHashSet<>();
        for (Class<?> toolClass : ToolRegistry.toolClasses()) {
            for (Method m : toolClass.getDeclaredMethods()) {
                Tool tool = m.getAnnotation(Tool.class);
                if (tool == null) continue;
                names.add(tool.name() != null && !tool.name().isBlank() ? tool.name() : m.getName());
            }
        }
        return names;
    }

    @Test
    @DisplayName("MỌI @Tool thật đều có nhóm — bảng tra lệch thì phải gãy ở đây, không lệch âm thầm")
    void everyRealToolHasAGroup() {
        // Thêm tool mới mà quên khai báo nhóm sẽ khiến kế hoạch nêu tên nó nhưng định tuyến bỏ qua,
        // tức đúng loại lỗi câm mà công đoạn này sinh ra để chữa.
        assertThat(ToolRegistry.groupByToolName().keySet())
                .as("bảng tra trong ToolRegistry phải phủ hết @Tool thật")
                .containsExactlyInAnyOrderElementsOf(realToolNames());
    }

    @Test
    @DisplayName("bảng tra không được nêu tool không tồn tại")
    void noPhantomToolsInTable() {
        assertThat(realToolNames()).containsAll(ToolRegistry.groupByToolName().keySet());
    }

    @Test
    @DisplayName("suy ra đúng nhóm từ tên tool")
    void mapsToolNamesToGroups() {
        assertThat(ToolRegistry.groupsForTools(List.of("get_people", "get_kpi", "get_analytics")))
                .containsExactlyInAnyOrder(Group.LOOKUP, Group.KPI, Group.INSIGHT);
        assertThat(ToolRegistry.groupsForTools(List.of("compare_org_units")))
                .containsExactly(Group.INSIGHT);
    }

    @Test
    @DisplayName("tên lạ / null / rỗng bị bỏ qua chứ không làm hỏng lượt hỏi")
    void unknownNamesAreIgnored() {
        assertThat(ToolRegistry.groupsForTools(List.of("get_people", "khong_co_that")))
                .containsExactly(Group.LOOKUP);
        assertThat(ToolRegistry.groupsForTools(null)).isEmpty();
        assertThat(ToolRegistry.groupsForTools(List.of())).isEmpty();
    }

    @Test
    @DisplayName("tên tool viết hoa / thừa khoảng trắng vẫn tra được")
    void lookupIsCaseAndSpaceInsensitive() {
        assertThat(ToolRegistry.groupsForTools(List.of("  GET_ANALYTICS ")))
                .containsExactly(Group.INSIGHT);
    }

    @Test
    @DisplayName("readGroups gồm đủ mọi nhóm ĐỌC và không lẫn nhóm GHI")
    void readGroupsExcludeWriteGroup() {
        // readGroups() không đụng vào field nào, nên dựng bằng CALLS_REAL_METHODS thay vì liệt kê
        // một dãy null — dãy đó gãy mỗi lần thêm một tool vào registry, và đã gãy hai lần.
        assertThat(mock(ToolRegistry.class, CALLS_REAL_METHODS).readGroups())
                .containsExactlyInAnyOrder(Group.CORE, Group.LOOKUP, Group.KPI, Group.INSIGHT)
                .doesNotContain(Group.ACTION);
    }
}
