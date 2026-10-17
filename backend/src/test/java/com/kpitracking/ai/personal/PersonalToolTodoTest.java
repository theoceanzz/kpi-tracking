package com.kpitracking.ai.personal;

import com.kpitracking.dto.response.stats.KpiTaskResponse;
import com.kpitracking.dto.response.submission.SubmissionResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * "Hôm nay tôi cần làm gì?" của NHÂN VIÊN (07/10): trước đây nhóm PERSONAL không có tool nào trả lời câu này, model coi
 * là "tư vấn cá nhân" và từ chối. {@code get_my_todo} gom việc từ dữ liệu trang "Việc cần làm".
 */
class PersonalToolTodoTest {

    private final Instant now = Instant.parse("2026-10-07T03:00:00Z");

    private KpiTaskResponse task(String name, String status, Instant deadline, Instant start) {
        KpiTaskResponse t = new KpiTaskResponse();
        t.setId(UUID.randomUUID());
        t.setName(name);
        t.setStatus(status);
        t.setDeadline(deadline);
        t.setStartDate(start);
        t.setPeriodName("Tháng 10/2026");
        return t;
    }

    @SuppressWarnings("unchecked")
    private static List<String> names(Map<String, Object> out, String key) {
        return ((List<Map<String, Object>>) out.get(key)).stream().map(m -> (String) m.get("kpiName")).toList();
    }

    @Test
    @DisplayName("gom đúng mục: quá hạn, cần nộp (hạn gần trước), bị từ chối kèm lý do, đang chờ duyệt; bỏ kỳ chưa mở")
    void groupsTasks() {
        KpiTaskResponse late = task("Báo cáo tuần", "OVERDUE", now.minusSeconds(86_400), now.minusSeconds(864_000));
        KpiTaskResponse soon = task("Số task", "NOT_STARTED", now.plusSeconds(86_400), now.minusSeconds(864_000));
        KpiTaskResponse later = task("Code review", "NOT_STARTED", now.plusSeconds(864_000), now.minusSeconds(864_000));
        KpiTaskResponse fix = task("Tỉ lệ bug", "REJECTED", now.plusSeconds(86_400), now.minusSeconds(864_000));
        KpiTaskResponse wait = task("API hoàn thành", "PENDING", now.plusSeconds(86_400), now.minusSeconds(864_000));
        KpiTaskResponse future = task("Kỳ sau", "NOT_STARTED", now.plusSeconds(3_000_000), now.plusSeconds(2_000_000));
        SubmissionResponse rejected = new SubmissionResponse();
        rejected.setKpiCriteriaId(fix.getId());
        rejected.setReviewNote("Thiếu minh chứng");

        Map<String, Object> out = PersonalTool.todoOf(List.of(later, wait, late, fix, soon, future), List.of(),
                List.of(rejected), now);

        assertThat(names(out, "overdue")).containsExactly("Báo cáo tuần");
        assertThat(names(out, "toSubmit")).containsExactly("Số task", "Code review");
        assertThat(names(out, "toFix")).containsExactly("Tỉ lệ bug");
        assertThat(((List<Map<String, Object>>) out.get("toFix")).get(0).get("reason")).isEqualTo("Thiếu minh chứng");
        assertThat(names(out, "waitingReview")).containsExactly("API hoàn thành");
        assertThat(out.get("todoCount")).isEqualTo(4);
    }

    @Test
    @DisplayName("bài bị TRẢ LẠI đang chờ nộp lại: ở mục nộp lại (lý do + hạn), không lặp ở mục cần nộp")
    void returnedSubmissionGoesToResubmit() {
        KpiTaskResponse kpi = task("Code review", "NOT_STARTED", now.plusSeconds(86_400), now.minusSeconds(864_000));
        SubmissionResponse returned = new SubmissionResponse();
        returned.setKpiCriteriaId(kpi.getId());
        returned.setKpiCriteriaName("Code review");
        returned.setAwaitingResubmission(true);
        returned.setReturnReason("Bổ sung số PR");
        returned.setResubmitDeadline(now.plusSeconds(172_800));

        Map<String, Object> out = PersonalTool.todoOf(List.of(kpi), List.of(returned), List.of(), now);

        assertThat(names(out, "resubmit")).containsExactly("Code review");
        assertThat(names(out, "toSubmit")).isEmpty();
        assertThat(((List<Map<String, Object>>) out.get("resubmit")).get(0).get("returnReason")).isEqualTo("Bổ sung số PR");
    }

    @Test
    @DisplayName("không còn việc -> có câu nói thẳng, để model không phải đi tra thêm")
    void nothingToDo() {
        Map<String, Object> out = PersonalTool.todoOf(List.of(), List.of(), List.of(), now);
        assertThat(out.get("todoCount")).isEqualTo(0);
        assertThat((String) out.get("message")).contains("không còn việc");
    }
}
