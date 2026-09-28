package com.kpitracking.service.feedback360;

import com.kpitracking.exception.ErrorCode;
import com.kpitracking.entity.*;
import com.kpitracking.enums.CycleUnitEvalStatus;
import com.kpitracking.enums.F360CampaignStatus;
import com.kpitracking.enums.F360ScoringMode;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.repository.F360CampaignRepository;
import com.kpitracking.repository.F360SubjectRepository;
import com.kpitracking.service.kpi.CycleLockChecker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Guard hai chiều giữa chiến dịch 360 có ảnh hưởng điểm và việc khoá kỳ (§7.2-5). */
class F360CycleGuardTest {

    private final F360CampaignRepository campaigns = mock(F360CampaignRepository.class);
    private final F360SubjectRepository subjects = mock(F360SubjectRepository.class);
    private final CycleLockChecker locks = mock(CycleLockChecker.class);
    private final F360CycleGuard guard = new F360CycleGuard(campaigns, subjects, locks);

    private Organization org;
    private KpiCycle cycle;
    private OrgUnit dept;
    private OrgUnit team;
    private F360Campaign campaign;
    private F360Subject subjectInTeam;

    @BeforeEach
    void setUp() {
        org = Organization.builder().id(UUID.randomUUID()).enableFeedback360(true).feedback360AffectsRating(true).build();
        cycle = KpiCycle.builder().id(UUID.randomUUID()).name("Kỳ 1").organization(org).build();
        dept = OrgUnit.builder().id(UUID.randomUUID()).name("Phòng A").path("/1/2/").build();
        team = OrgUnit.builder().id(UUID.randomUUID()).name("Nhóm X").path("/1/2/3/").build();
        campaign = F360Campaign.builder().id(UUID.randomUUID()).name("360 kỳ 1").organization(org).kpiCycle(cycle)
                .scoringMode(F360ScoringMode.BEHAVIOR_AXIS).status(F360CampaignStatus.OPEN).build();
        subjectInTeam = F360Subject.builder().id(UUID.randomUUID()).campaign(campaign).orgUnit(team).build();
        when(campaigns.findScoringByCycle(eq(cycle.getId()), any())).thenReturn(List.of(campaign));
        when(subjects.findByCampaignIdWithUser(campaign.getId())).thenReturn(List.of(subjectInTeam));
    }

    @Test
    @DisplayName("chiến dịch ảnh hưởng điểm đang mở, có người trong đơn vị con ⇒ chặn chốt dữ liệu kỳ ở đơn vị cha")
    void blocksCalibration() {
        assertThatThrownBy(() -> guard.assertCanCalibrate(cycle.getId(), dept))
                .isInstanceOf(BusinessException.class).hasMessageContaining("360 kỳ 1")
                .extracting("errorCode").isEqualTo(ErrorCode.CLOSE_F360_CAMPAIGN_BEFORE_FINALIZING_CYCLE_DATA);
    }

    @Test
    @DisplayName("đơn vị không liên quan thì không bị chặn")
    void otherUnitNotBlocked() {
        OrgUnit other = OrgUnit.builder().id(UUID.randomUUID()).path("/1/9/").build();
        assertThatCode(() -> guard.assertCanCalibrate(cycle.getId(), other)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("tổ chức chưa cho 360 ảnh hưởng xếp loại ⇒ guard không áp")
    void orgFlagOff() {
        org.setFeedback360AffectsRating(false);
        assertThatCode(() -> guard.assertCanCalibrate(cycle.getId(), dept)).doesNotThrowAnyException();
        assertThatCode(() -> guard.assertInputsOpen(campaign, List.of(subjectInTeam))).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("khởi động/mở lại/thêm người bị chặn khi đơn vị của người được đánh giá đã chốt dữ liệu kỳ")
    void blocksLaunchIntoLockedUnit() {
        CycleUnitEvaluation lock = CycleUnitEvaluation.builder().orgUnit(dept).status(CycleUnitEvalStatus.CALIBRATING).build();
        when(locks.inputLockFor(cycle.getId(), team)).thenReturn(lock);
        assertThatThrownBy(() -> guard.assertInputsOpen(campaign, List.of(subjectInTeam)))
                .isInstanceOf(BusinessException.class).hasMessageContaining("Phòng A")
                .extracting("errorCode").isEqualTo(ErrorCode.FOLLOWING_UNITS_FINALIZED_CYCLE_DATA_F360_CANNOT);
    }

    @Test
    @DisplayName("chiến dịch chỉ để phát triển không qua guard")
    void developmentOnlyIgnored() {
        campaign.setScoringMode(F360ScoringMode.DEVELOPMENT_ONLY);
        CycleUnitEvaluation lock = CycleUnitEvaluation.builder().orgUnit(dept).build();
        when(locks.inputLockFor(cycle.getId(), team)).thenReturn(lock);
        assertThatCode(() -> guard.assertInputsOpen(campaign, List.of(subjectInTeam))).doesNotThrowAnyException();
    }
}
