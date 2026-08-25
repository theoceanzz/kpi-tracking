package com.kpitracking.controller;

import com.kpitracking.dto.request.submission.ReviewSubmissionRequest;
import com.kpitracking.entity.User;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.service.KpiAdjustmentService;
import com.kpitracking.service.KpiCriteriaService;
import com.kpitracking.service.KpiSubmissionService;
import com.kpitracking.service.ReminderService;
import com.kpitracking.service.ai.action.PendingAction;
import com.kpitracking.service.ai.action.PendingAction.Decision;
import com.kpitracking.service.ai.action.PendingAction.Item;
import com.kpitracking.service.ai.action.PendingAction.Kind;
import com.kpitracking.service.ai.action.PendingActionExecutor;
import com.kpitracking.service.ai.action.PendingActionStore;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Test cho bước XÁC NHẬN — nơi trợ lý chuyển từ "đề nghị" sang "ghi thật".
 *
 * <p>Đây là ranh giới đáng canh nhất của cả pha P5, nên trọng tâm không phải đường vui vẻ mà là ba
 * điều: <b>không chèn thêm được mục lạ</b>, <b>không chạy được hai lần</b>, và <b>một mục hỏng
 * không nuốt mất phần còn lại cũng không được báo cáo thành công</b>.
 */
class AiActionConfirmTest {

    private PendingActionStore store;
    private KpiSubmissionService submissionService;
    private AiActionController controller;

    private final User me = new User();
    private final UUID itemA = UUID.randomUUID();
    private final UUID itemB = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        store = new PendingActionStore();
        submissionService = mock(KpiSubmissionService.class);
        PendingActionExecutor executor = new PendingActionExecutor(
                submissionService, mock(KpiCriteriaService.class),
                mock(KpiAdjustmentService.class), mock(ReminderService.class));

        UserRepository users = mock(UserRepository.class);
        me.setId(UUID.randomUUID());
        me.setEmail("truong@demo.com");
        when(users.findByEmail("truong@demo.com")).thenReturn(Optional.of(me));

        controller = new AiActionController(store, executor, users);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("truong@demo.com", "n/a", List.of()));
    }

    @AfterEach
    void clearLogin() {
        SecurityContextHolder.clearContext();
    }

    private PendingAction stored() {
        PendingAction a = new PendingAction(UUID.randomUUID().toString(), Kind.SUBMISSION_REVIEW,
                "Duyệt 2 bản nộp của Team Backend", Decision.APPROVE, "ok",
                List.of(new Item(itemA, null, "Staff A — KPI X", "kỳ Tháng 6/2026"),
                        new Item(itemB, null, "Staff B — KPI Y", "kỳ Tháng 6/2026")),
                Instant.now());
        return store.put(a, me.getId(), "conv-1");
    }

    private AiActionController.ConfirmResponse confirm(String id, List<UUID> itemIds) {
        return controller.confirm(id, new AiActionController.ConfirmRequest(itemIds))
                .getBody().getData();
    }

    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("xác nhận -> chạy ĐÚNG các mục của lời mời")
    void runsTheStoredItems() {
        PendingAction a = stored();

        AiActionController.ConfirmResponse res = confirm(a.id(), null);

        ArgumentCaptor<UUID> ids = ArgumentCaptor.forClass(UUID.class);
        verify(submissionService, org.mockito.Mockito.times(2))
                .reviewSubmission(ids.capture(), any());
        assertThat(ids.getAllValues()).containsExactlyInAnyOrder(itemA, itemB);
        assertThat(res.getSucceeded()).isEqualTo(2);
        assertThat(res.getText()).isEqualTo("Đã duyệt 2 bản nộp.");
    }

    @Test
    @DisplayName("bỏ chọn bớt -> chỉ chạy mục còn chọn")
    void narrowsToSelectedItems() {
        PendingAction a = stored();

        confirm(a.id(), List.of(itemA));

        verify(submissionService).reviewSubmission(eq(itemA), any());
        verify(submissionService, never()).reviewSubmission(eq(itemB), any());
    }

    @Test
    @DisplayName("id LẠ gửi kèm -> bị loại, KHÔNG chạy")
    void ignoresItemIdsNotInTheOffer() {
        // Đây là chốt chặn quan trọng nhất của endpoint này. Không có nó thì đây lại là một endpoint
        // nhận danh sách id tuỳ ý rồi ghi — đúng hình dạng lỗ hổng bulk-review vừa phải vá.
        PendingAction a = stored();
        UUID lachoac = UUID.randomUUID();

        confirm(a.id(), List.of(itemA, lachoac));

        verify(submissionService).reviewSubmission(eq(itemA), any());
        verify(submissionService, never()).reviewSubmission(eq(lachoac), any());
    }

    @Test
    @DisplayName("xác nhận hai lần -> lần hai KHÔNG chạy lại")
    void secondConfirmDoesNothing() {
        PendingAction a = stored();

        confirm(a.id(), null);
        AiActionController.ConfirmResponse again = confirm(a.id(), null);

        verify(submissionService, org.mockito.Mockito.times(2)).reviewSubmission(any(), any());
        assertThat(again.getSucceeded()).isZero();
        assertThat(again.getText()).contains("không còn hiệu lực");
    }

    @Test
    @DisplayName("một mục hỏng -> mục kia VẪN chạy, và báo cáo nêu rõ phần hỏng")
    void oneFailureDoesNotHideTheRest() {
        PendingAction a = stored();
        doThrow(new ForbiddenException("Bạn không có quyền phê duyệt bản nộp của đơn vị này"))
                .when(submissionService).reviewSubmission(eq(itemB), any());

        AiActionController.ConfirmResponse res = confirm(a.id(), null);

        assertThat(res.getSucceeded()).isEqualTo(1);
        assertThat(res.getFailed()).isEqualTo(1);
        // Im lặng nuốt phần hỏng là loại báo cáo sai tệ nhất: nó trông y hệt thành công.
        assertThat(res.getText()).contains("không thực hiện được").contains("Staff B");
        // Câu báo cáo phải khớp số THỰC SỰ chạy, không lấy lại con số của lời mời ban đầu.
        assertThat(res.getText()).startsWith("Đã duyệt 1 bản nộp.");
        assertThat(res.getFailures()).anyMatch(f -> f.contains("không có quyền"));
    }

    @Test
    @DisplayName("quyết định TỪ CHỐI đi tới dịch vụ đúng trạng thái và kèm lý do")
    void rejectPassesStatusAndNote() {
        PendingAction a = new PendingAction(UUID.randomUUID().toString(), Kind.SUBMISSION_REVIEW,
                "Từ chối 1 bản nộp", Decision.REJECT, "số liệu chưa khớp minh chứng",
                List.of(new Item(itemA, null, "Staff A — KPI X", "")), Instant.now());
        store.put(a, me.getId(), "conv-1");

        confirm(a.id(), null);

        ArgumentCaptor<ReviewSubmissionRequest> req =
                ArgumentCaptor.forClass(ReviewSubmissionRequest.class);
        verify(submissionService).reviewSubmission(eq(itemA), req.capture());
        assertThat(req.getValue().getStatus()).isEqualTo(SubmissionStatus.REJECTED);
        assertThat(req.getValue().getReviewNote()).isEqualTo("số liệu chưa khớp minh chứng");
    }

    @Test
    @DisplayName("bỏ chọn bớt -> câu báo cáo nêu số THỰC CHẠY, không nêu số của lời mời")
    void reportsWhatActuallyRanNotWhatWasOffered() {
        // Lần thử thật đầu tiên trả ra "Đã thực hiện xong: duyệt 3 bản nộp ... (1 mục)" — một câu
        // tự mâu thuẫn, vì nó ghép tiêu đề của LỜI MỜI vào kết quả sau khi người dùng đã bỏ chọn.
        PendingAction a = stored();

        AiActionController.ConfirmResponse res = confirm(a.id(), List.of(itemA));

        assertThat(res.getText()).isEqualTo("Đã duyệt 1 bản nộp.");
        assertThat(res.getText()).doesNotContain("2");
    }

    @Test
    @DisplayName("khoá không có thật -> nói hết hiệu lực, KHÔNG ghi gì")
    void unknownActionWritesNothing() {
        AiActionController.ConfirmResponse res = confirm("khong-co-that", null);

        assertThat(res.getText()).contains("không còn hiệu lực");
        verify(submissionService, never()).reviewSubmission(any(), any());
    }

    @Test
    @DisplayName("bỏ chọn HẾT -> không ghi gì, và nói thẳng là chưa chọn mục nào")
    void emptySelectionWritesNothing() {
        PendingAction a = stored();

        AiActionController.ConfirmResponse res =
                confirm(a.id(), List.of(UUID.randomUUID()));

        assertThat(res.getSucceeded()).isZero();
        verify(submissionService, never()).reviewSubmission(any(), any());
        assertThat(res.getText()).contains("chưa chọn mục nào");
    }
}
