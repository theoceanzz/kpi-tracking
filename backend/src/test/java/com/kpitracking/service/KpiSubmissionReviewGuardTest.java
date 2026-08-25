package com.kpitracking.service;

import com.kpitracking.dto.request.submission.BulkReviewRequest;
import com.kpitracking.dto.response.submission.SubmissionResponse;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.KpiSubmissionRepository;
import com.kpitracking.mapper.SubmissionMapper;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.security.PermissionChecker;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Test cho chốt chặn quyền phê duyệt bản nộp, và trọng tâm là <b>đường HÀNG LOẠT</b>.
 *
 * <p><b>Lỗ hổng có thật, phát hiện 24/08/2026.</b> {@code POST /api/v1/submissions/bulk-review}
 * không có {@code @PreAuthorize} nào — cả mức lớp lẫn mức phương thức — và
 * {@code KpiSubmissionService.bulkReview} cũng không gọi {@code permissionChecker} một lần. Bất kỳ
 * người dùng đã đăng nhập nào cũng duyệt được bản nộp bất kỳ theo id, xuyên đơn vị và xuyên tổ
 * chức, chỉ bằng cách gọi bản hàng loạt thay vì bản đơn lẻ ngay cạnh nó — vốn đòi
 * {@code SUBMISSION:REVIEW} trong chính đơn vị đó CỘNG với cấp bậc cao hơn người nộp.
 *
 * <p>Vì thế lớp test này khẳng định hai điều, và điều thứ hai mới là điều chống tái phát:
 * <ul>
 *   <li>bốn luật của chốt chặn là đúng;</li>
 *   <li><b>đường hàng loạt đi qua đúng chốt chặn đó</b>, và kiểm TỪNG bản nộp một — danh sách id do
 *       client gửi lên nên không có gì buộc chúng thuộc cùng một đơn vị.</li>
 * </ul>
 */
class KpiSubmissionReviewGuardTest {

    /** Số NHỎ hơn là cao hơn, ở cả hai trục — xem ghi chú trong {@code requireCanReview}. */
    private static final int LEVEL_PHONG = 1;
    private static final int LEVEL_TEAM = 2;
    private static final int RANK_TRUONG = 1;
    private static final int RANK_NHAN_VIEN = 5;

    private KpiSubmissionRepository submissionRepository;
    private UserRepository userRepository;
    private PermissionChecker permissionChecker;
    private SubmissionMapper submissionMapper;
    private KpiSubmissionService service;

    private final UUID unitId = UUID.randomUUID();
    private final UUID otherUnitId = UUID.randomUUID();
    private User reviewer;
    private User submitter;

    @BeforeEach
    void setUp() {
        submissionRepository = mock(KpiSubmissionRepository.class);
        userRepository = mock(UserRepository.class);
        permissionChecker = mock(PermissionChecker.class);

        submissionMapper = mock(SubmissionMapper.class);
        ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);

        // Chỉ tiêm những phụ thuộc mà đường HÀNG LOẠT thật sự chạm tới; phần còn lại để null nên
        // nếu bản vá vô tình đi lạc sang nhánh khác thì test nổ ngay thay vì âm thầm xanh.
        service = new KpiSubmissionService(
                submissionRepository, null, null, userRepository, null, submissionMapper, events,
                permissionChecker, null);

        // Đủ để một bản nộp HỢP LỆ chạy trọn vòng lặp, nhờ đó kiểm được rằng bản THỨ HAI cũng bị soi.
        when(submissionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(submissionMapper.toResponse(any())).thenAnswer(inv -> new SubmissionResponse());

        reviewer = user("truong@demo.com");
        submitter = user("nhanvien@demo.com");
        when(userRepository.findByEmail("truong@demo.com")).thenReturn(Optional.of(reviewer));
        login("truong@demo.com");

        // Mặc định: người duyệt là trưởng phòng cấp trên, người nộp là nhân viên cấp dưới.
        when(permissionChecker.isGlobalAdmin(any())).thenReturn(false);
        when(permissionChecker.hasAnyPermissionInOrgUnit(eq(reviewer.getId()), eq(unitId), any()))
                .thenReturn(true);
        when(permissionChecker.getMinLevelInOrgUnit(reviewer.getId(), unitId)).thenReturn(LEVEL_PHONG);
        when(permissionChecker.getMinRankInOrgUnit(reviewer.getId(), unitId)).thenReturn(RANK_TRUONG);
        when(permissionChecker.getMinLevelInOrgUnit(submitter.getId(), unitId)).thenReturn(LEVEL_TEAM);
        when(permissionChecker.getMinRankInOrgUnit(submitter.getId(), unitId)).thenReturn(RANK_NHAN_VIEN);
    }

    @AfterEach
    void clearLogin() {
        SecurityContextHolder.clearContext();
    }

    private static User user(String email) {
        User u = new User();
        u.setId(UUID.randomUUID());
        u.setEmail(email);
        return u;
    }

    private static void login(String email) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(email, "n/a", List.of()));
    }

    /** Một bản nộp CHỜ DUYỆT của {@link #submitter}, thuộc đơn vị cho trước. */
    private KpiSubmission submissionIn(UUID orgUnitId) {
        OrgUnit unit = new OrgUnit();
        unit.setId(orgUnitId);

        // KpiCriteria không cha: nhánh gộp lên KPI cha (waterfall) không chạy, đúng hình dạng của
        // dữ liệu mẫu và đủ cho phần cần kiểm ở đây.
        KpiCriteria kpi = new KpiCriteria();
        kpi.setId(UUID.randomUUID());

        KpiSubmission s = new KpiSubmission();
        s.setId(UUID.randomUUID());
        s.setKpiCriteria(kpi);
        s.setOrgUnit(unit);
        s.setSubmittedBy(submitter);
        s.setStatus(SubmissionStatus.PENDING);
        when(submissionRepository.findById(s.getId())).thenReturn(Optional.of(s));
        return s;
    }

    private BulkReviewRequest bulkOf(KpiSubmission... subs) {
        BulkReviewRequest r = new BulkReviewRequest();
        ReflectionTestUtils.setField(r, "submissionIds",
                java.util.Arrays.stream(subs).map(KpiSubmission::getId).toList());
        return r;
    }

    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("HÀNG LOẠT: bản nộp của đơn vị mình KHÔNG có quyền -> chặn, và KHÔNG ghi gì")
    void bulkRefusesSubmissionOfAnotherUnit() {
        // Đây chính là lỗ hổng: trước khi vá, lời gọi này duyệt trót lọt bản nộp của đơn vị bất kỳ.
        KpiSubmission foreign = submissionIn(otherUnitId);
        when(permissionChecker.hasAnyPermissionInOrgUnit(eq(reviewer.getId()), eq(otherUnitId), any()))
                .thenReturn(false);

        assertThatThrownBy(() -> service.bulkReview(bulkOf(foreign)))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("không có quyền phê duyệt bản nộp của đơn vị này");

        verify(submissionRepository, never()).save(any());
    }

    @Test
    @DisplayName("HÀNG LOẠT: kiểm TỪNG bản — một bản lạ trong lô hợp lệ vẫn phải chặn cả lô")
    void bulkChecksEveryItemNotJustTheFirst() {
        // Kiểm theo bản ĐẦU rồi cho qua phần còn lại là lỗ hổng cũ mặc áo mới: chỉ cần kèm một id
        // hợp lệ lên đầu là buôn lậu được cả danh sách.
        KpiSubmission mine = submissionIn(unitId);
        KpiSubmission foreign = submissionIn(otherUnitId);
        when(permissionChecker.hasAnyPermissionInOrgUnit(eq(reviewer.getId()), eq(otherUnitId), any()))
                .thenReturn(false);

        assertThatThrownBy(() -> service.bulkReview(bulkOf(mine, foreign)))
                .isInstanceOf(ForbiddenException.class);

        // Bản ĐẦU đã ghi xong rồi mới tới bản thứ hai bị chặn. Không có dòng này thì test vẫn xanh
        // kể cả khi phép kiểm nằm NGOÀI vòng lặp — tức nó chẳng chứng minh được điều đang khai.
        verify(submissionRepository, times(1)).save(any());
    }

    @Test
    @DisplayName("HÀNG LOẠT: không thể duyệt bản nộp của người ngang hàng hoặc cao hơn")
    void bulkRefusesPeerOrSenior() {
        KpiSubmission s = submissionIn(unitId);
        // Người nộp cũng là trưởng phòng, cùng cấp cùng chức vụ.
        when(permissionChecker.getMinLevelInOrgUnit(submitter.getId(), unitId)).thenReturn(LEVEL_PHONG);
        when(permissionChecker.getMinRankInOrgUnit(submitter.getId(), unitId)).thenReturn(RANK_TRUONG);

        assertThatThrownBy(() -> service.bulkReview(bulkOf(s)))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("tương đương/cao hơn");
    }

    @Test
    @DisplayName("HÀNG LOẠT: KHÔNG ai tự duyệt bản nộp của chính mình")
    void bulkRefusesSelfReview() {
        // Hệ quả của luật "phải cao hơn người nộp": với chính mình thì cấp và chức vụ luôn bằng
        // nhau, nên không bao giờ vượt qua. Kiểm riêng vì đây là cách lạm dụng dễ nghĩ ra nhất.
        KpiSubmission s = submissionIn(unitId);
        s.setSubmittedBy(reviewer);
        when(permissionChecker.getMinLevelInOrgUnit(reviewer.getId(), unitId)).thenReturn(LEVEL_PHONG);
        when(permissionChecker.getMinRankInOrgUnit(reviewer.getId(), unitId)).thenReturn(RANK_TRUONG);

        assertThatThrownBy(() -> service.bulkReview(bulkOf(s)))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("HÀNG LOẠT: bản đã duyệt bởi người ngang cấp -> không ghi đè được")
    void bulkRefusesOverridingAPeerReviewer() {
        KpiSubmission s = submissionIn(unitId);
        User prev = user("truongkhac@demo.com");
        s.setStatus(SubmissionStatus.APPROVED);
        s.setReviewedBy(prev);
        when(permissionChecker.getMinLevelInOrgUnit(prev.getId(), unitId)).thenReturn(LEVEL_PHONG);
        when(permissionChecker.getMinRankInOrgUnit(prev.getId(), unitId)).thenReturn(RANK_TRUONG);

        assertThatThrownBy(() -> service.bulkReview(bulkOf(s)))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("tương đương hoặc cao hơn phê duyệt");
    }

    @Test
    @DisplayName("HÀNG LOẠT: quản trị toàn hệ thống đi thẳng, không vướng cấp bậc")
    void bulkLetsGlobalAdminThrough() {
        // Chốt chặn phải KHÔNG chặn nhầm, nếu không bản vá này biến thành một lỗi khác.
        KpiSubmission s = submissionIn(otherUnitId);
        when(permissionChecker.isGlobalAdmin(reviewer.getId())).thenReturn(true);

        assertThatCode(() -> service.bulkReview(bulkOf(s))).doesNotThrowAnyException();
        verify(submissionRepository).save(any());
    }
}
