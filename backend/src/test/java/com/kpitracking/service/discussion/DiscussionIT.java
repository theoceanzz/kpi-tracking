package com.kpitracking.service.discussion;

import com.kpitracking.dto.request.discussion.UpdateCommentRequest;
import com.kpitracking.dto.response.discussion.DiscussionCommentResponse;
import com.kpitracking.dto.response.discussion.DiscussionPageResponse;
import com.kpitracking.enums.DiscussionReactionType;
import com.kpitracking.enums.DiscussionTargetType;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.service.CollabITSupport;
import com.kpitracking.service.KpiCriteriaService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Thảo luận trên PostgreSQL THẬT (DB dev đã chạy Flyway tới V37). Chạy tay: {@code ./mvnw test -Dtest=DiscussionIT}.
 * Dữ liệu dựng sẵn ở {@link CollabITSupport}. Test 1, 3, 4, 5, 6 của đặc tả.
 */
class DiscussionIT extends CollabITSupport {

    @Autowired DiscussionService discussionService;
    @Autowired KpiCriteriaService kpiCriteriaService;

    private DiscussionCommentResponse comment(UUID as, String body, UUID parentId, List<UUID> mentions) throws Exception {
        loginAs(as);
        return discussionService.create(DiscussionTargetType.KPI, kpiId, body, parentId, mentions, null);
    }

    @Test
    void test1_employeeCommentsHeadNotified_headRepliesEmployeeNotified() throws Exception {
        DiscussionCommentResponse question = comment(employee, "Chỉ tiêu này tính theo tháng hay quý ạ?", null, null);
        assertThat(waitNotifications(head, question.getId())).isEqualTo(1);

        DiscussionCommentResponse answer = comment(head, "Theo quý nhé.", question.getId(), null);
        assertThat(waitNotifications(employee, answer.getId())).isEqualTo(1);
        String type = jdbc.queryForObject("SELECT type FROM notifications WHERE user_id = ? AND reference_id = ?",
                String.class, employee, answer.getId());
        assertThat(type).isEqualTo("DISCUSSION");

        loginAs(employee);
        DiscussionPageResponse page = discussionService.page(DiscussionTargetType.KPI, kpiId, null, 20);
        assertThat(page.getContent()).hasSize(1);
        assertThat(page.getContent().get(0).getReplies()).extracting(DiscussionCommentResponse::getId).containsExactly(answer.getId());
    }

    @Test
    void test3_mentionOfNonViewerIsNotSuggestedAndRejectedByApi() throws Exception {
        loginAs(employee);
        assertThat(discussionService.mentionCandidates(DiscussionTargetType.KPI, kpiId, null))
                .extracting(m -> m.getId()).contains(head).doesNotContain(outsider);

        assertThatThrownBy(() -> comment(employee, "@ai đó xem giúp", null, List.of(outsider)))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.DISCUSSION_MENTION_NOT_ALLOWED));

        DiscussionCommentResponse ok = comment(employee, "Anh xem giúp em", null, List.of(head));
        assertThat(ok.getMentions()).extracting(m -> m.getId()).containsExactly(head);
    }

    @Test
    void test4_editOrDeleteOthersCommentWithoutModerateIsBlocked() throws Exception {
        DiscussionCommentResponse mine = comment(employee, "Bình luận của nhân viên", null, null);

        loginAs(colleague);
        UpdateCommentRequest edit = new UpdateCommentRequest();
        edit.setBody("sửa trộm");
        assertThatThrownBy(() -> discussionService.update(mine.getId(), edit))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.DISCUSSION_EDIT_NOT_AUTHOR));
        assertThatThrownBy(() -> discussionService.delete(mine.getId()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.DISCUSSION_DELETE_NOT_ALLOWED));

        // Người ngoài tổ chức không đọc được, không thả cảm xúc được.
        loginAs(outsider);
        assertThatThrownBy(() -> discussionService.page(DiscussionTargetType.KPI, kpiId, null, 20))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.DISCUSSION_NO_PERMISSION_VIEW));
        assertThatThrownBy(() -> discussionService.toggleReaction(mine.getId(), DiscussionReactionType.LIKE))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.DISCUSSION_NO_PERMISSION_COMMENT));

        // Trưởng đơn vị có MODERATE ⇒ xoá được; còn trả lời thì gốc hiện "đã xoá" và giữ trả lời.
        comment(colleague, "Trả lời", mine.getId(), null);
        loginAs(head);
        discussionService.delete(mine.getId());
        DiscussionPageResponse page = discussionService.page(DiscussionTargetType.KPI, kpiId, null, 20);
        assertThat(page.getContent()).hasSize(1);
        assertThat(page.getContent().get(0).isDeleted()).isTrue();
        assertThat(page.getContent().get(0).getBody()).isNull();
        assertThat(page.getContent().get(0).getReplies()).hasSize(1);
    }

    @Test
    void test6_unreadCountDropsToZeroAfterOpening() throws Exception {
        comment(employee, "Một", null, null);
        comment(employee, "Hai", null, null);

        loginAs(head);
        assertThat(kpiCriteriaService.getKpiCriteriaById(kpiId).getUnreadComments()).isEqualTo(2L);
        // Bình luận của chính mình không tính là chưa đọc.
        loginAs(employee);
        assertThat(kpiCriteriaService.getKpiCriteriaById(kpiId).getUnreadComments()).isZero();

        loginAs(head);
        discussionService.markRead(DiscussionTargetType.KPI, kpiId);
        assertThat(kpiCriteriaService.getKpiCriteriaById(kpiId).getUnreadComments()).isZero();
    }

    @Test
    void test5_rejectingKpiPostsSystemLineWithReasonCountedUnreadForCreator() throws Exception {
        // KPI nhân viên tự lập, đang chờ trưởng đơn vị duyệt ở bước 1.
        jdbc.update("UPDATE kpi_criteria SET status = 'PENDING_APPROVAL', created_by = ?, origin = 'SELF' WHERE id = ?", employee, kpiId);
        UUID flowId = UUID.randomUUID();
        jdbc.update("INSERT INTO kpi_approval_flows (id, organization_id, subject_type, kpi_criteria_id, requester_id, current_step_order) "
                + "VALUES (?, ?, 'CRITERIA', ?, ?, 1)", flowId, orgId, kpiId, employee);
        UUID stepId = UUID.randomUUID();
        jdbc.update("INSERT INTO kpi_approval_steps (id, flow_id, step_order, org_unit_id, org_unit_name, status, pending_since) "
                + "VALUES (?, ?, 1, ?, 'IT', 'PENDING', now())", stepId, flowId, unitId);
        jdbc.update("INSERT INTO kpi_approval_step_approvers (step_id, user_id, user_name) VALUES (?, ?, 'IT')", stepId, head);

        loginAs(head);
        kpiCriteriaService.rejectKpi(kpiId, com.kpitracking.dto.request.kpi.RejectKpiRequest.builder()
                .reason("Thiếu số liệu nền").expectedStepId(stepId).build());

        loginAs(employee);
        DiscussionPageResponse page = discussionService.page(DiscussionTargetType.KPI, kpiId, null, 20);
        DiscussionCommentResponse line = page.getContent().get(0);
        assertThat(line.getKind()).isEqualTo(com.kpitracking.enums.DiscussionCommentKind.SYSTEM);
        assertThat(line.getSystemText()).contains("từ chối").contains("Thiếu số liệu nền");
        assertThat(line.getSystemMeta()).containsEntry("action", "REJECTED");
        // Dòng từ chối tính vào số chưa đọc của người tạo KPI, không tính cho người khác.
        assertThat(kpiCriteriaService.getKpiCriteriaById(kpiId).getUnreadComments()).isEqualTo(1L);
        loginAs(head);
        assertThat(kpiCriteriaService.getKpiCriteriaById(kpiId).getUnreadComments()).isZero();
    }

    @Autowired KpiDiscussionTimeline timeline;
    @Autowired com.kpitracking.repository.KpiCriteriaRepository kpiCriteriaRepository;
    @Autowired com.kpitracking.repository.UserRepository users;
    @Autowired org.springframework.transaction.PlatformTransactionManager txManager;

    @Test
    void adjustmentChainLinesAreWordedAsAdjustmentNotKpiRejection() {
        new org.springframework.transaction.support.TransactionTemplate(txManager).executeWithoutResult(s -> {
            var kpi = kpiCriteriaRepository.findById(kpiId).orElseThrow();
            var flow = com.kpitracking.entity.KpiApprovalFlow.builder()
                    .subjectType(com.kpitracking.enums.ApprovalSubjectType.ADJUSTMENT).kpiCriteria(kpi).build();
            timeline.onApprovalEvent(flow, null, com.kpitracking.enums.ApprovalEventAction.REJECTED,
                    users.findById(head).orElseThrow(), "Chưa đủ căn cứ");
        });

        loginAs(employee);
        DiscussionCommentResponse line = discussionService.page(DiscussionTargetType.KPI, kpiId, null, 20).getContent().get(0);
        assertThat(line.getSystemText()).startsWith("Yêu cầu điều chỉnh").contains("Chưa đủ căn cứ");
        assertThat(line.getSystemMeta()).containsEntry("action", "ADJ_REJECTED");
        // Không tính vào số chưa đọc (chỉ dòng từ chối CHÍNH KPI mới tính cho người tạo).
        loginAs(head);
        assertThat(kpiCriteriaService.getKpiCriteriaById(kpiId).getUnreadComments()).isZero();
    }

    @Test
    void consecutiveCommentsAreGroupedIntoOneNotification() throws Exception {
        DiscussionCommentResponse c1 = comment(employee, "Một", null, null);
        assertThat(waitNotifications(head, c1.getId())).isEqualTo(1);
        comment(employee, "Hai", null, null);
        comment(employee, "Ba", null, null);
        // Chờ listener của bình luận thứ ba cập nhật thông báo gộp.
        String message = null;
        for (int i = 0; i < 50; i++) {
            message = jdbc.queryForObject("SELECT message FROM notifications WHERE user_id = ? AND reference_id = ?",
                    String.class, head, c1.getId());
            if (message.startsWith("Có 3")) break;
            Thread.sleep(200);
        }
        assertThat(message).startsWith("Có 3 bình luận mới");
        Long total = jdbc.queryForObject("SELECT COUNT(*) FROM notifications n JOIN discussion_comments c ON c.id = n.reference_id "
                + "WHERE n.user_id = ? AND c.target_id = ?", Long.class, head, kpiId);
        assertThat(total).isEqualTo(1L);
    }

    @Test
    void editMarksEditedAndPagingByCursorWorks() throws Exception {
        DiscussionCommentResponse first = comment(employee, "cũ nhất", null, null);
        for (int i = 0; i < 4; i++) comment(employee, "bình luận " + i, null, null);

        loginAs(employee);
        UpdateCommentRequest edit = new UpdateCommentRequest();
        edit.setBody("cũ nhất (đã sửa nội dung)");
        assertThat(discussionService.update(first.getId(), edit).getEditedAt()).isNotNull();

        DiscussionPageResponse p1 = discussionService.page(DiscussionTargetType.KPI, kpiId, null, 3);
        assertThat(p1.getContent()).hasSize(3);
        assertThat(p1.isHasMore()).isTrue();
        DiscussionPageResponse p2 = discussionService.page(DiscussionTargetType.KPI, kpiId, p1.getNextCursor(), 3);
        assertThat(p2.getContent()).hasSize(2);
        assertThat(p2.isHasMore()).isFalse();
        assertThat(p2.getContent().get(1).getId()).isEqualTo(first.getId());
    }
}
