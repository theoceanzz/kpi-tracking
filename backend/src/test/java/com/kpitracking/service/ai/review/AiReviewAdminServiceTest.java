package com.kpitracking.service.ai.review;

import com.kpitracking.dto.request.ai.AiReviewSettingsRequest;
import com.kpitracking.dto.response.ai.AiReviewReportResponse;
import com.kpitracking.entity.AiSubmissionReview;
import com.kpitracking.entity.AiSubmissionReviewItem;
import com.kpitracking.entity.Evaluation;
import com.kpitracking.entity.OrgHierarchyLevel;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.AiReviewStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.AiReviewUnitSettingRepository;
import com.kpitracking.repository.AiSubmissionReviewItemRepository;
import com.kpitracking.repository.AiSubmissionReviewRepository;
import com.kpitracking.repository.EvaluationRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Báo cáo lệch AI – quản lý: điểm AI = tổng điểm đề xuất các chỉ tiêu; điểm quản lý = lần chấm mới nhất của
 * người KHÁC nhân viên; chỉ gồm người mà người xem chấm được.
 */
class AiReviewAdminServiceTest {

    private AiSubmissionReviewRepository reviews;
    private AiSubmissionReviewItemRepository items;
    private EvaluationRepository evaluations;
    private ReviewContextBuilder contextBuilder;
    private UserRoleOrgUnitRepository assignments;
    private UserRepository users;
    private AiReviewAdminService service;

    private final Organization org = new Organization();
    private final OrgUnit team = new OrgUnit();
    private final User me = new User();
    private final UUID periodId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        reviews = mock(AiSubmissionReviewRepository.class);
        items = mock(AiSubmissionReviewItemRepository.class);
        evaluations = mock(EvaluationRepository.class);
        contextBuilder = mock(ReviewContextBuilder.class);
        assignments = mock(UserRoleOrgUnitRepository.class);
        users = mock(UserRepository.class);
        OrgUnitRepository units = mock(OrgUnitRepository.class);
        service = new AiReviewAdminService(mock(AiReviewUnitSettingRepository.class), reviews, items, evaluations,
                units, users, assignments, contextBuilder);

        org.setId(UUID.randomUUID());
        OrgHierarchyLevel level = new OrgHierarchyLevel();
        level.setOrganization(org);
        team.setId(UUID.randomUUID());
        team.setName("Phòng KD");
        team.setPath("/r/kd/");
        team.setOrgHierarchyLevel(level);
        me.setId(UUID.randomUUID());
        me.setEmail("director@demo.com");
        when(assignments.findByUserId(me.getId())).thenReturn(List.of(assign(team)));
        when(users.findByEmail("director@demo.com")).thenReturn(Optional.of(me));
        when(units.findSubtree("/", org.getId())).thenReturn(List.of(team));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("director@demo.com", null, List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private static UserRoleOrgUnit assign(OrgUnit u) {
        UserRoleOrgUnit a = new UserRoleOrgUnit();
        a.setOrgUnit(u);
        return a;
    }

    /** Một nhân viên có lượt AI xong với các điểm đề xuất cho trước, và (tuỳ) điểm quản lý. */
    private UUID staff(Double managerScore, double... suggested) {
        UUID userId = UUID.randomUUID();
        User u = new User();
        u.setId(userId);
        u.setFullName("NV " + userId.toString().substring(0, 4));
        when(users.findById(userId)).thenReturn(Optional.of(u));
        when(assignments.findByUserId(userId)).thenReturn(List.of(assign(team)));
        when(contextBuilder.requireCanReview(me.getId(), userId)).thenReturn(org);

        AiSubmissionReview r = AiSubmissionReview.builder().id(UUID.randomUUID()).organizationId(org.getId())
                .kpiPeriodId(periodId).userId(userId).status(AiReviewStatus.DONE).build();
        rows.add(r);
        List<AiSubmissionReviewItem> its = new java.util.ArrayList<>();
        for (double s : suggested) its.add(AiSubmissionReviewItem.builder()
                .kpiSubmissionId(UUID.randomUUID()).suggestedScore(BigDecimal.valueOf(s)).build());
        its.add(AiSubmissionReviewItem.builder().suggestedScore(null).build());   // chỉ tiêu lỗi: không cộng
        // Định tính nằm trên thang hành vi riêng — không cộng vào điểm đánh giá để so với quản lý.
        if (suggested.length > 0) its.add(AiSubmissionReviewItem.builder().kpiSubmissionId(UUID.randomUUID())
                .suggestedScore(BigDecimal.valueOf(92.5)).qualitative(true).build());
        when(items.findAllByReviewId(r.getId())).thenReturn(its);

        List<Evaluation> evs = new java.util.ArrayList<>();
        Evaluation self = new Evaluation();
        self.setEvaluator(u);
        self.setScore(100.0);   // tự đánh giá: phải bị bỏ
        self.setCreatedAt(Instant.now());
        evs.add(self);
        if (managerScore != null) {
            Evaluation m = new Evaluation();
            m.setEvaluator(me);
            m.setScore(managerScore);
            m.setCreatedAt(Instant.now().minusSeconds(60));
            evs.add(m);
        }
        when(evaluations.findByUserIdAndKpiPeriodId(userId, periodId)).thenReturn(evs);
        return userId;
    }

    private final List<AiSubmissionReview> rows = new java.util.ArrayList<>();

    @Test
    @DisplayName("sai số trung bình, tỷ lệ trong ±5, độ lệch; người chưa có điểm quản lý không vào mẫu; ngoài phạm vi bị loại")
    void computesAgreement() {
        staff(80.0, 50, 32);          // AI 82 → lệch +2
        staff(70.0, 40, 20);          // AI 60 → lệch −10
        staff(null, 30);              // chưa chấm
        UUID nothingSubmitted = staff(90.0);   // chưa nộp gì: AI 0, không vào mẫu

        UUID outsider = staff(50.0, 50);
        when(contextBuilder.requireCanReview(me.getId(), outsider)).thenThrow(new ForbiddenException("x"));
        when(reviews.findByOrganizationIdAndKpiPeriodIdAndStatusOrderByCreatedAtDesc(org.getId(), periodId, AiReviewStatus.DONE))
                .thenReturn(rows);

        AiReviewReportResponse r = service.report(periodId, null);

        assertThat(r.getRows()).hasSize(4);
        assertThat(r.getRows()).filteredOn(x -> x.getUserId().equals(nothingSubmitted))
                .singleElement().satisfies(x -> assertThat(x.getDifference()).isNull());
        assertThat(r.getCompared()).isEqualTo(2);
        assertThat(r.getMeanAbsoluteError()).isEqualTo(6.0);
        assertThat(r.getWithinFivePercent()).isEqualTo(50.0);
        assertThat(r.getMeanBias()).isEqualTo(-4.0);
        assertThat(r.getRows().get(0).getDifference()).isEqualTo(-10.0);   // lệch nhiều nhất lên đầu
        assertThat(r.getUnits()).singleElement().satisfies(u -> assertThat(u.getUnitName()).isEqualTo("Phòng KD"));
    }

    @Test
    @DisplayName("cấu hình đơn vị: tổng trọng số khác 100 -> từ chối; đơn vị ngoài tổ chức -> 403")
    void unitSettingGuards() {
        assertThatThrownBy(() -> service.saveUnitSetting(team.getId(), new AiReviewSettingsRequest(true, 50, 30, 10)))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.saveUnitSetting(UUID.randomUUID(), new AiReviewSettingsRequest(true, 60, 30, 10)))
                .isInstanceOf(ForbiddenException.class);
    }
}
