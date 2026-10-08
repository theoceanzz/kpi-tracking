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
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.any;
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
        // Bảng item giả: báo cáo gộp item mới nhất của từng chỉ tiêu qua findAllByReviewIdIn (AiReviewLatestView).
        when(items.findAllByReviewIdIn(anyCollection())).thenAnswer(inv -> {
            java.util.Collection<UUID> ids = inv.getArgument(0);
            return ids.stream().flatMap(id -> itemsByRun.getOrDefault(id, List.of()).stream()).toList();
        });
        // Phiếu AI của mỗi người = mọi chỉ tiêu có trong các lượt giả, trừ chỉ tiêu ghi vào `paused`.
        when(contextBuilder.reviewableCriteria(any(), any())).thenAnswer(inv -> itemsByRun.values().stream()
                .flatMap(List::stream).map(AiSubmissionReviewItem::getKpiCriteriaId)
                .filter(id -> id != null && !paused.contains(id)).collect(java.util.stream.Collectors.toSet()));
        levels = mock(com.kpitracking.repository.QualitativeLevelRepository.class);
        service = new AiReviewAdminService(mock(AiReviewUnitSettingRepository.class), reviews, items, evaluations,
                units, users, assignments, contextBuilder, new AiReviewLatestView(items), levels);

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
                .kpiPeriodId(periodId).userId(userId).status(AiReviewStatus.DONE).createdAt(Instant.now().minusSeconds(600)).build();
        rows.add(r);
        List<AiSubmissionReviewItem> its = new java.util.ArrayList<>();
        for (double s : suggested) its.add(AiSubmissionReviewItem.builder().reviewId(r.getId()).kpiCriteriaId(UUID.randomUUID())
                .kpiSubmissionId(UUID.randomUUID()).suggestedScore(BigDecimal.valueOf(s)).build());
        // chỉ tiêu lỗi: không cộng
        its.add(AiSubmissionReviewItem.builder().reviewId(r.getId()).kpiCriteriaId(UUID.randomUUID()).suggestedScore(null).build());
        // Định tính nằm trên thang hành vi riêng — không cộng vào điểm đánh giá để so với quản lý.
        if (suggested.length > 0) its.add(AiSubmissionReviewItem.builder().reviewId(r.getId()).kpiCriteriaId(UUID.randomUUID())
                .kpiSubmissionId(UUID.randomUUID()).suggestedScore(BigDecimal.valueOf(92.5)).qualitative(true).build());
        itemsByRun.put(r.getId(), its);
        lastRun.put(userId, r);

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
    private final java.util.Map<UUID, List<AiSubmissionReviewItem>> itemsByRun = new java.util.HashMap<>();
    private final java.util.Map<UUID, AiSubmissionReview> lastRun = new java.util.HashMap<>();
    private final java.util.Set<UUID> paused = new java.util.HashSet<>();
    private com.kpitracking.repository.QualitativeLevelRepository levels;

    /** Thang chất lượng của tổ chức trong DB: KÉM 0 · TRUNG BÌNH 50 · TỐT 100. */
    private static List<com.kpitracking.entity.QualitativeLevel> dbScale() {
        java.util.List<com.kpitracking.entity.QualitativeLevel> out = new java.util.ArrayList<>();
        String[] names = {"KÉM", "TRUNG BÌNH", "TỐT"};
        double[] pct = {0, 50, 100};
        for (int i = 0; i < names.length; i++) {
            com.kpitracking.entity.QualitativeLevel l = new com.kpitracking.entity.QualitativeLevel();
            l.setName(names[i]);
            l.setScorePercent(pct[i]);
            l.setPosition(i + 1);
            out.add(l);
        }
        return out;
    }

    @Test
    @DisplayName("mức tin cậy của dòng báo cáo = thấp nhất trong các chỉ tiêu, mỗi chỉ tiêu theo chất lượng AI chấm")
    void reportConfidenceFollowsQuality() {
        when(levels.findByOrganizationIdOrderByPositionAsc(org.getId())).thenReturn(dbScale());
        UUID userId = staff(80.0, 50, 32);
        AiSubmissionReview full = lastRun.get(userId);
        List<AiSubmissionReviewItem> its = itemsByRun.get(full.getId());
        its.get(0).setQualityLevel("TỐT");
        its.get(1).setQualityLevel("TRUNG BÌNH");
        its.removeIf(i -> i.getKpiSubmissionId() == null || Boolean.TRUE.equals(i.getQualitative()));
        its.get(0).setConfidence("THAP");   // giá trị lưu theo luật cũ — phải bị tính lại, không đọc thẳng
        when(reviews.findByOrganizationIdAndKpiPeriodIdAndStatusOrderByCreatedAtDesc(org.getId(), periodId, AiReviewStatus.DONE))
                .thenReturn(List.of(full));

        assertThat(service.report(periodId, null).getRows()).singleElement()
                .satisfies(x -> assertThat(x.getConfidence()).isEqualTo("TRUNG_BINH"));
    }

    @Test
    @DisplayName("chỉ tiêu nay đã xin tạm dừng -> kết quả AI cũ của nó không cộng vào báo cáo")
    void reportSkipsPausedCriteria() {
        UUID userId = staff(80.0, 50, 32);
        AiSubmissionReview full = lastRun.get(userId);
        paused.add(itemsByRun.get(full.getId()).get(0).getKpiCriteriaId());   // chỉ tiêu 50 điểm
        when(reviews.findByOrganizationIdAndKpiPeriodIdAndStatusOrderByCreatedAtDesc(org.getId(), periodId, AiReviewStatus.DONE))
                .thenReturn(List.of(full));

        assertThat(service.report(periodId, null).getRows()).singleElement()
                .satisfies(x -> assertThat(x.getAiScore()).isEqualTo(32.0));
    }

    @Test
    @DisplayName("lượt mới nhất chỉ chấm lẻ một bài -> báo cáo vẫn cộng đủ chỉ tiêu (item mới nhất của từng chỉ tiêu)")
    void reportSumsMergedItemsAcrossRuns() {
        UUID userId = staff(80.0, 50, 32);   // lượt cả phiếu: 50 + 32
        AiSubmissionReview full = lastRun.get(userId);
        AiSubmissionReviewItem first = itemsByRun.get(full.getId()).get(0);
        // Chấm lại riêng chỉ tiêu đầu: 50 -> 45, mức tin cậy riêng THAP.
        AiSubmissionReview redo = AiSubmissionReview.builder().id(UUID.randomUUID()).organizationId(org.getId())
                .kpiPeriodId(periodId).userId(userId).status(AiReviewStatus.DONE).createdAt(Instant.now())
                .scopeCriteriaIds(first.getKpiCriteriaId().toString()).confidence("THAP").build();
        itemsByRun.put(redo.getId(), List.of(AiSubmissionReviewItem.builder().reviewId(redo.getId())
                .kpiCriteriaId(first.getKpiCriteriaId()).kpiSubmissionId(first.getKpiSubmissionId())
                .suggestedScore(BigDecimal.valueOf(45)).confidence("THAP").build()));
        when(reviews.findByOrganizationIdAndKpiPeriodIdAndStatusOrderByCreatedAtDesc(org.getId(), periodId, AiReviewStatus.DONE))
                .thenReturn(List.of(redo, full));

        AiReviewReportResponse r = service.report(periodId, null);

        assertThat(r.getRows()).singleElement().satisfies(x -> {
            assertThat(x.getAiScore()).isEqualTo(77.0);          // 45 + 32, không phải chỉ 45
            assertThat(x.getReviewId()).isEqualTo(full.getId());
            assertThat(x.getConfidence()).isEqualTo("THAP");     // mức thấp nhất của các chỉ tiêu
        });
    }

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
