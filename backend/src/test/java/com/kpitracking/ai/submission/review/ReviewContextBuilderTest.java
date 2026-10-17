package com.kpitracking.ai.submission.review;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.entity.OrgHierarchyLevel;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.SubmissionAttachment;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.KpiType;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.KpiSubmissionRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.KpiAchievementCalculator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Ngữ cảnh gửi cho AI: phạm vi theo đơn vị (không chỉ theo tổ chức), độ dài cắt tại đây, tệp minh chứng
 * mang theo địa chỉ để bước đọc tệp xử lý, lịch sử chấm và trọng số theo cấu hình đơn vị.
 */
class ReviewContextBuilderTest {

    private PermissionChecker permissions;
    private UserRoleOrgUnitRepository assignments;
    private KpiCriteriaRepository kpiRepository;
    private KpiAchievementCalculator calculator;
    private KpiSubmissionRepository submissions;
    private AiReviewSettingsResolver resolver;
    private ReviewContextBuilder builder;
    private com.kpitracking.repository.KpiAdjustmentRequestRepository adjustments;

    private final UUID managerId = UUID.randomUUID();
    private final UUID staffId = UUID.randomUUID();
    private final UUID periodId = UUID.randomUUID();
    private final Organization org = new Organization();
    private final OrgUnit team = new OrgUnit();

    @BeforeEach
    void setUp() {
        permissions = mock(PermissionChecker.class);
        assignments = mock(UserRoleOrgUnitRepository.class);
        kpiRepository = mock(KpiCriteriaRepository.class);
        calculator = mock(KpiAchievementCalculator.class);
        // Pool trọng số nay hỏi core "chỉ tiêu này có tính điểm không"; mock mặc định trả false
        // nên không khai báo là rụng sạch chỉ tiêu.
        when(calculator.countsTowardBscScore(any())).thenReturn(true);
        UserRepository users = mock(UserRepository.class);
        KpiPeriodRepository periods = mock(KpiPeriodRepository.class);
        submissions = mock(KpiSubmissionRepository.class);
        resolver = mock(AiReviewSettingsResolver.class);
        adjustments = mock(com.kpitracking.repository.KpiAdjustmentRequestRepository.class);
        builder = new ReviewContextBuilder(kpiRepository, periods, users, assignments, permissions, calculator,
                submissions, resolver, mock(ReviewConductSource.class), adjustments);
        when(resolver.resolve(any(), any())).thenReturn(
                new AiReviewSettingsResolver.Effective(true, null, "đơn vị"));
        // Thang điểm AI của công ty: hai mức, tối đa 10.
        when(resolver.aiScale(any())).thenReturn(AiReviewSettingsResolver.scaleOf(List.of(
                com.kpitracking.entity.AiReviewLevel.builder().name("Yếu").position(1).points(java.math.BigDecimal.ZERO).build(),
                com.kpitracking.entity.AiReviewLevel.builder().name("Tốt").position(2).points(java.math.BigDecimal.TEN).build())));

        org.setId(UUID.randomUUID());
        OrgHierarchyLevel level = new OrgHierarchyLevel();
        level.setOrganization(org);
        team.setId(UUID.randomUUID());
        team.setOrgHierarchyLevel(level);
        UserRoleOrgUnit a = new UserRoleOrgUnit();
        a.setOrgUnit(team);
        when(assignments.findByUserId(staffId)).thenReturn(List.of(a));

        User staff = new User();
        staff.setId(staffId);
        staff.setFullName("Nguyễn Văn An");
        when(users.findById(staffId)).thenReturn(Optional.of(staff));
        KpiPeriod p = new KpiPeriod();
        p.setName("Tháng 9/2026");
        when(periods.findById(periodId)).thenReturn(Optional.of(p));
        when(calculator.ratio(any(), eq(staffId), anyBoolean())).thenReturn(0.8);
    }

    @Test
    @DisplayName("có quyền duyệt ở đơn vị của nhân viên VÀ cấp cao hơn -> được; trả tổ chức")
    void managerOfTheUnitCanReview() {
        when(permissions.hasAnyPermissionInOrgUnit(managerId, team.getId(), "SUBMISSION:REVIEW")).thenReturn(true);
        when(permissions.isSuperiorTo(managerId, staffId, team.getId())).thenReturn(true);

        assertThat(builder.requireCanReview(managerId, staffId)).isSameAs(org);
    }

    @Test
    @DisplayName("quản lý đơn vị KHÁC (không có quyền ở đơn vị này) -> 403")
    void managerOfAnotherUnitIsForbidden() {
        when(permissions.hasAnyPermissionInOrgUnit(managerId, team.getId(), "SUBMISSION:REVIEW")).thenReturn(false);

        assertThatThrownBy(() -> builder.requireCanReview(managerId, staffId)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("cùng đơn vị nhưng ngang cấp -> 403")
    void peerIsForbidden() {
        when(permissions.hasAnyPermissionInOrgUnit(managerId, team.getId(), "SUBMISSION:REVIEW")).thenReturn(true);
        when(permissions.isSuperiorTo(managerId, staffId, team.getId())).thenReturn(false);

        assertThatThrownBy(() -> builder.requireCanReview(managerId, staffId)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("chữ bài nộp cắt ở 4.000 ký tự; tệp minh chứng mang địa chỉ; chỉ bài của đúng người; lịch sử + trọng số đơn vị")
    void cutsNotesCarriesFilesHistoryAndAiMaxPoints() {
        User staff = new User();
        staff.setId(staffId);
        User other = new User();
        other.setId(UUID.randomUUID());

        KpiCriteria kpi = new KpiCriteria();
        kpi.setId(UUID.randomUUID());
        kpi.setName("Số task hoàn thành");
        kpi.setKpiType(KpiType.QUANTITATIVE);
        kpi.setTargetValue(10.0);
        kpi.setWeight(20.0);
        kpi.setSubmissions(new ArrayList<>());

        KpiSubmission mine = new KpiSubmission();
        mine.setId(UUID.randomUUID());
        mine.setSubmittedBy(staff);
        mine.setNote("a".repeat(5000));
        mine.setStatus(SubmissionStatus.PENDING);
        mine.setCreatedAt(Instant.now());
        mine.setAttachments(new ArrayList<>(List.of(SubmissionAttachment.builder().fileName("bao-cao.pdf").fileUrl("https://x/bao-cao.pdf").build())));
        KpiSubmission theirs = new KpiSubmission();
        theirs.setId(UUID.randomUUID());
        theirs.setSubmittedBy(other);
        theirs.setNote("không phải của An");
        theirs.setAttachments(new ArrayList<>());
        kpi.getSubmissions().addAll(List.of(mine, theirs));

        when(kpiRepository.findByUserIdInAssigneesAndKpiPeriodId(eq(staffId), eq(periodId), any(), any()))
                .thenReturn(new PageImpl<>(List.of(kpi)));

        KpiPeriod old = new KpiPeriod();
        old.setName("Tháng 8/2026");
        KpiCriteria oldKpi = new KpiCriteria();
        oldKpi.setKpiPeriod(old);
        KpiSubmission reviewed = new KpiSubmission();
        reviewed.setKpiCriteria(oldKpi);
        reviewed.setManagerScore(8.0);
        reviewed.setReviewNote("Tốt");
        when(submissions.findReviewedHistory(eq(staffId), eq("Số task hoàn thành"), eq(periodId), any()))
                .thenReturn(List.of(reviewed));

        ReviewContext ctx = builder.build(org.getId(), periodId, staffId, org);

        ReviewContext.Criterion c = ctx.criteria().get(0);
        assertThat(c.submissions()).hasSize(1);
        assertThat(c.submissions().get(0).note()).hasSizeLessThan(4100).endsWith("[đã cắt]");
        assertThat(c.submissions().get(0).attachments())
                .containsExactly(new ReviewContext.Attachment("bao-cao.pdf", "https://x/bao-cao.pdf"));
        assertThat(ctx.unreadableFiles()).isEmpty();
        assertThat(c.history()).singleElement().satisfies(h -> {
            assertThat(h.periodName()).isEqualTo("Tháng 8/2026");
            assertThat(h.managerScore()).isEqualTo(8.0);
        });
        assertThat(c.achievementRatio()).isEqualTo(0.8);
        assertThat(ctx.aiMaxPoints()).isEqualByComparingTo("10");
    }

    private static KpiCriteria kpi(String name, double weight, com.kpitracking.enums.KpiStatus status) {
        KpiCriteria k = new KpiCriteria();
        k.setId(UUID.randomUUID());
        k.setName(name);
        k.setKpiType(KpiType.QUANTITATIVE);
        k.setTargetValue(10.0);
        k.setWeight(weight);
        k.setStatus(status);
        k.setSubmissions(new ArrayList<>());
        return k;
    }

    @Test
    @DisplayName("chỉ tiêu xin tạm dừng (đã duyệt hoặc đang chờ) không vào phiếu AI và không vào mẫu số: 4 KPI 25 -> tối đa 25, không phải 19,2")
    void pausedCriteriaLeaveTheSheetAndTheScale() {
        KpiCriteria a = kpi("Kiểm thử phần mềm", 25, com.kpitracking.enums.KpiStatus.APPROVED);
        KpiCriteria b = kpi("Mức độ bao phủ", 25, com.kpitracking.enums.KpiStatus.APPROVED);
        KpiCriteria c = kpi("Tỷ lệ nhiệm vụ A", 25, com.kpitracking.enums.KpiStatus.EDITED);
        // Đang chờ duyệt ĐỔI CHỈ TIÊU (không phải tạm dừng) — vẫn chấm như thường.
        KpiCriteria d = kpi("Tỷ lệ nhiệm vụ B", 25, com.kpitracking.enums.KpiStatus.EDIT);
        KpiCriteria pausedApproved = kpi("Phát triển thêm tính năng mới", 30, com.kpitracking.enums.KpiStatus.INACTIVE);
        pausedApproved.setCompensatedAchievementPercent(15.0);   // core vẫn tính theo % bù — AI thì không
        KpiCriteria pausePending = kpi("Đang xin tạm dừng", 20, com.kpitracking.enums.KpiStatus.EDIT);
        when(kpiRepository.findByUserIdInAssigneesAndKpiPeriodId(eq(staffId), eq(periodId), any(), any()))
                .thenReturn(new PageImpl<>(List.of(a, b, c, d, pausedApproved, pausePending)));
        when(adjustments.findPendingDeactivationCriteriaIds(any())).thenReturn(List.of(pausePending.getId()));

        ReviewContext ctx = builder.build(org.getId(), periodId, staffId, org);

        assertThat(ctx.criteria()).extracting(ReviewContext.Criterion::kpiCriteriaId)
                .containsExactlyInAnyOrder(a.getId(), b.getId(), c.getId(), d.getId());
        assertThat(builder.reviewableCriteria(periodId, staffId)).containsExactlyInAnyOrder(a.getId(), b.getId(), c.getId(), d.getId());
        assertThat(builder.pausedCriteria(periodId, staffId)).containsExactlyInAnyOrder(pausedApproved.getId(), pausePending.getId());
    }

    @Test
    @DisplayName("bài đã TRẢ LẠI không vào ngữ cảnh AI — nộp lại thì AI chỉ đọc bài mới")
    void returnedSubmissionIsLeftOut() {
        User staff = new User();
        staff.setId(staffId);
        KpiCriteria kpi = kpi("Số task hoàn thành", 25, com.kpitracking.enums.KpiStatus.APPROVED);

        KpiSubmission returned = new KpiSubmission();
        returned.setId(UUID.randomUUID());
        returned.setSubmittedBy(staff);
        returned.setNote("Bài cũ — đã bị trả lại");
        returned.setStatus(SubmissionStatus.RETURNED);
        returned.setCreatedAt(Instant.now().minusSeconds(3600));
        returned.setAttachments(new ArrayList<>());
        KpiSubmission resubmitted = new KpiSubmission();
        resubmitted.setId(UUID.randomUUID());
        resubmitted.setSubmittedBy(staff);
        resubmitted.setNote("Bài nộp lại");
        resubmitted.setStatus(SubmissionStatus.PENDING);
        resubmitted.setCreatedAt(Instant.now());
        resubmitted.setAttachments(new ArrayList<>());
        kpi.getSubmissions().addAll(List.of(returned, resubmitted));
        when(kpiRepository.findByUserIdInAssigneesAndKpiPeriodId(eq(staffId), eq(periodId), any(), any()))
                .thenReturn(new PageImpl<>(List.of(kpi)));

        ReviewContext ctx = builder.build(org.getId(), periodId, staffId, org);

        assertThat(ctx.criteria().get(0).submissions()).extracting(ReviewContext.Submission::id)
                .containsExactly(resubmitted.getId());
    }
}
