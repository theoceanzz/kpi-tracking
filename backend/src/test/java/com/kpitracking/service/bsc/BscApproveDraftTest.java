package com.kpitracking.service.bsc;

import com.kpitracking.entity.bsc.BscScorecard;
import com.kpitracking.entity.bsc.BscScorecardPerspective;
import com.kpitracking.enums.bsc.BscScorecardStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.repository.bsc.BscPerspectiveRepository;
import com.kpitracking.repository.bsc.BscScorecardPerspectiveRepository;
import com.kpitracking.repository.bsc.BscScorecardRepository;
import com.kpitracking.repository.bsc.BscUnitResultItemRepository;
import com.kpitracking.repository.bsc.BscUnitResultRepository;
import com.kpitracking.repository.kpi.KpiCriteriaRepository;
import com.kpitracking.repository.kpi.KpiPeriodRepository;
import com.kpitracking.repository.organization.OrgUnitRepository;
import com.kpitracking.repository.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Người duyệt duyệt thẳng thẻ nháp — không phải "trình" cho chính mình — nhưng vẫn qua điều kiện của lúc trình. */
class BscApproveDraftTest {

    BscScorecardRepository scorecardRepository = mock(BscScorecardRepository.class);
    BscScorecardPerspectiveRepository itemRepository = mock(BscScorecardPerspectiveRepository.class);
    BscTreeService service;
    BscScorecard draft;

    @BeforeEach
    void setUp() {
        service = new BscTreeService(scorecardRepository, itemRepository, mock(BscPerspectiveRepository.class),
                mock(BscUnitResultRepository.class), mock(BscUnitResultItemRepository.class), mock(KpiCriteriaRepository.class),
                mock(OrgUnitRepository.class), mock(KpiPeriodRepository.class), mock(UserRepository.class),
                mock(BscAccessGuard.class), mock(ApplicationEventPublisher.class), mock(com.kpitracking.service.kpi.approval.KpiApprovalChainService.class), mock(BscCycleLockGuard.class));
        draft = BscScorecard.builder().id(UUID.randomUUID()).name("Thẻ phòng").status(BscScorecardStatus.DRAFT).build();
        when(scorecardRepository.findById(draft.getId())).thenReturn(Optional.of(draft));
        when(scorecardRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    void rows(double... weights) {
        List<BscScorecardPerspective> list = java.util.Arrays.stream(weights)
                .mapToObj(w -> BscScorecardPerspective.builder().id(UUID.randomUUID()).weightPercentage(w).build()).toList();
        when(itemRepository.findByScorecardIdOrderByDisplayOrderAsc(draft.getId())).thenReturn(list);
    }

    @Test
    @DisplayName("Thẻ nháp đủ 100% ⇒ duyệt thẳng thành Đang áp dụng")
    void approvesCompleteDraft() {
        rows(60, 40);
        assertThat(service.approve(draft.getId()).getStatus()).isEqualTo(BscScorecardStatus.ACTIVE);
    }

    @Test
    @DisplayName("Thẻ nháp mới 20% (đơn vị chưa thêm hạng mục riêng) ⇒ không duyệt được")
    void rejectsIncompleteDraft() {
        rows(20);
        assertThatThrownBy(() -> service.approve(draft.getId()))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getErrorCode())
                .isEqualTo(ErrorCode.TOTAL_WEIGHT_MUST_100_PERCENT_SUBMIT);
        assertThat(draft.getStatus()).isEqualTo(BscScorecardStatus.DRAFT);
    }
}
