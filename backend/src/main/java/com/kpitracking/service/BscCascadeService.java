package com.kpitracking.service;

import com.kpitracking.dto.response.bsc.PerspectiveScoreResponse;
import com.kpitracking.entity.BscCascadePolicy;
import com.kpitracking.entity.BscFactorBand;
import com.kpitracking.entity.BscScorecard;
import com.kpitracking.entity.BscScorecardPerspective;
import com.kpitracking.entity.BscUnitResult;
import com.kpitracking.entity.BscUnitResultItem;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.enums.BscFactorMode;
import com.kpitracking.enums.BscFactorScope;
import com.kpitracking.enums.BscGateEffect;
import com.kpitracking.enums.BscGateScope;
import com.kpitracking.enums.BscMeasurementSource;
import com.kpitracking.enums.BscScorecardLevel;
import com.kpitracking.enums.BscUnitResultStatus;
import com.kpitracking.enums.KpiType;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.BscCascadePolicyRepository;
import com.kpitracking.repository.BscScorecardPerspectiveRepository;
import com.kpitracking.repository.BscScorecardRepository;
import com.kpitracking.repository.BscUnitResultItemRepository;
import com.kpitracking.repository.BscUnitResultRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Tầng CASCADE của BSC: quy kết quả của phòng ban và công ty thành hệ số nhân vào điểm cá nhân,
 * và áp trần xếp loại của các hạng mục chặn. Xem docs/bsc-cascade-design.md mục 5.
 *
 * <p><b>ĐIỀU DỄ HIỂU SAI NHẤT</b> — "nhân viên × phòng × công ty" KHÔNG phải nhân thẳng tỉ lệ đạt.
 * Ba bước, đúng thứ tự:
 * <pre>
 *   B1. capped     = MIN(điểm gốc, recognizedCapPercent)          mặc định cap 120
 *   B2. f_unit     = tra bảng dải theo BSC đơn vị    (kẹp [floor, cap])
 *       f_company  = tra bảng dải theo BSC công ty
 *   B3. recognized = capped × f_unit × f_company
 * </pre>
 * Ví dụ chuẩn: gốc 112, phòng 92% (⇒ 0.95), công ty 97% (⇒ 1.00) = <b>106.4</b>.
 * KHÔNG phải 112 × 0.92 × 0.97 = 99.96.
 *
 * <p>Hệ số áp ĐÚNG MỘT LẦN, ở tầng ngoài cùng, trên điểm gốc. Không được nhúng vào
 * {@link BscScoringService#computeForUser} — KPI cá nhân đã roll-up lên dòng BSC phòng rồi lại
 * nhân hệ số phòng ở tầng trong thì một phần kết quả bị đếm hai lượt.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BscCascadeService {

    private final BscScorecardRepository scorecardRepository;
    private final BscScorecardPerspectiveRepository scorecardPerspectiveRepository;
    private final BscUnitResultRepository unitResultRepository;
    private final BscUnitResultItemRepository unitResultItemRepository;
    private final BscCascadePolicyRepository policyRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final KpiAchievementCalculator achievementCalculator;
    private final UserRepository userRepository;
    private final BscAccessGuard accessGuard;

    /** Hệ số khi không có chính sách hoặc chế độ NONE — nhân 1 tức không đổi gì. */
    private static final double NEUTRAL_FACTOR = 1.0;

    /**
     * Mức cao nhất của thang xếp loại (ma trận hiệu suất trả 1..5). Dùng cho BLOCK_EXCELLENT:
     * "không được mức cao nhất" nghĩa là trần = mức ngay dưới đỉnh thang.
     */
    public static final int DEFAULT_MAX_RATING = 5;

    // ============================================================
    // Kết quả của một lần áp cascade
    // ============================================================

    /**
     * @param unitAchievement    %đạt BSC của đơn vị (null = không có bộ tiêu chí đơn vị)
     * @param companyAchievement %đạt BSC của công ty
     * @param recognized         điểm công nhận sau ba bước B1–B3
     */
    public record CascadeOutcome(Double rawScore,
                                 Double unitAchievement,
                                 Double companyAchievement,
                                 Double unitFactor,
                                 Double companyFactor,
                                 Double recognized,
                                 String unitBandLabel,
                                 String companyBandLabel,
                                 BscCascadePolicy policy) {}

    /**
     * @param capRating   trần xếp loại; null = không bị chặn
     * @param failedItems tên các hạng mục chặn không đạt, ngăn cách bằng dấu phẩy
     */
    public record GateOutcome(boolean passed, Integer capRating, String failedItems) {}

    /**
     * @param enforced true = mức BLOCK (chặn hẳn), false = chỉ cảnh báo
     */
    public record LinkedWeightCheck(double linkedPercent, double minRequired, boolean satisfied, boolean enforced) {}

    // ============================================================
    // Chính sách hệ số
    // ============================================================

    /**
     * Chính sách áp dụng cho một đợt: ưu tiên chính sách gắn RIÊNG cho kỳ chứa đợt, không có thì
     * dùng chính sách mặc định của tổ chức. Trả null khi tổ chức chưa có chính sách nào — khi đó
     * tầng hệ số bị bỏ qua hoàn toàn và điểm công nhận = điểm gốc.
     */
    @Transactional(readOnly = true)
    public BscCascadePolicy resolvePolicy(UUID organizationId, UUID kpiPeriodId) {
        if (organizationId == null) return null;
        if (kpiPeriodId != null) {
            KpiPeriod period = kpiPeriodRepository.findById(kpiPeriodId).orElse(null);
            if (period != null && period.getKpiCycle() != null) {
                List<BscCascadePolicy> byCycle =
                        policyRepository.findActiveByCycle(organizationId, period.getKpiCycle().getId());
                if (!byCycle.isEmpty()) return byCycle.get(0);
            }
        }
        List<BscCascadePolicy> defaults = policyRepository.findActiveDefault(organizationId);
        return defaults.isEmpty() ? null : defaults.get(0);
    }

    // ============================================================
    // Kết quả BSC của đơn vị
    // ============================================================

    /**
     * Tính lại kết quả BSC của một bộ tiêu chí trong một đợt và LƯU lại (trạng thái DRAFT).
     *
     * <p>Từ chối tính lại khi kết quả đã chốt: sửa dữ liệu nguồn sau khi khoá không được tự động
     * làm đổi kết quả đã công bố (NFR-04) — muốn đổi thì mở khoá rồi tái tính có phiên bản.
     */
    @Transactional
    public BscUnitResult recompute(UUID scorecardId, UUID kpiPeriodId) {
        BscScorecard scorecard = scorecardRepository.findById(scorecardId)
                .orElseThrow(() -> new ResourceNotFoundException("Bộ tiêu chí", "id", scorecardId));
        KpiPeriod period = kpiPeriodRepository.findById(kpiPeriodId)
                .orElseThrow(() -> new ResourceNotFoundException("Đợt", "id", kpiPeriodId));
        // Tính lại ghi đè kết quả của đơn vị đó nên cũng phải gác phạm vi như khi sửa bộ tiêu chí.
        accessGuard.assertCanEdit(scorecard);
        // Suy từ tổ chức của chính bộ tiêu chí thay vì bắt caller truyền — cùng một tổ chức mà hai
        // đường gọi truyền hai giá trị khác nhau thì kết quả BSC đơn vị sẽ lệch nhau không rõ lý do.
        boolean enableWaterfall = Boolean.TRUE.equals(scorecard.getOrganization().getEnableWaterfall());

        BscUnitResult result = unitResultRepository
                .findByScorecardIdAndKpiPeriodId(scorecardId, kpiPeriodId)
                .orElseGet(() -> BscUnitResult.builder()
                        .scorecard(scorecard)
                        .kpiPeriod(period)
                        .kpiCycle(period.getKpiCycle())
                        .build());

        if (result.getStatus() != BscUnitResultStatus.DRAFT) {
            throw new BusinessException("Kết quả BSC của đợt này đã chốt — mở khoá trước khi tính lại");
        }

        // Giá trị nhập tay phải sống sót qua mỗi lần tính lại, nếu không người phụ trách phải
        // gõ lại toàn bộ mỗi lần bấm nút.
        java.util.Map<UUID, Double> manualActuals = new java.util.HashMap<>();
        if (result.getId() != null) {
            for (BscUnitResultItem old : unitResultItemRepository.findByUnitResultId(result.getId())) {
                if (old.getMeasurementSource() == BscMeasurementSource.MANUAL && old.getActualValue() != null) {
                    manualActuals.put(old.getScorecardPerspective().getId(), old.getActualValue());
                }
            }
        }

        result = unitResultRepository.save(result);
        unitResultItemRepository.deleteByUnitResultId(result.getId());
        // Ép DELETE xuống DB NGAY. Hibernate xếp INSERT trước DELETE trong hàng đợi action,
        // không flush ở đây thì các dòng mới đụng unique (unit_result_id, scorecard_perspective_id).
        unitResultItemRepository.flush();

        List<BscScorecardPerspective> rows =
                scorecardPerspectiveRepository.findByScorecardIdOrderByDisplayOrderAsc(scorecardId);

        // KPI của đơn vị trong đợt, nạp MỘT lần rồi chia về từng dòng chỉ tiêu ở dưới.
        List<UUID> unitIds = scorecard.getOrgUnits() == null ? List.of()
                : scorecard.getOrgUnits().stream().map(OrgUnit::getId).toList();
        List<KpiCriteria> unitKpis = unitIds.isEmpty() ? List.of()
                : kpiCriteriaRepository.findByOrgUnitsAndPeriod(
                        unitIds, kpiPeriodId, BscScoringService.ACTIVE_STATUSES);

        double weightedSum = 0.0, presentWeight = 0.0, totalWeight = 0.0;
        boolean zeroFill = scorecard.getEmptyPerspectivePolicy() == com.kpitracking.enums.BscEmptyPerspectivePolicy.ZERO_FILL;
        List<String> gateFailures = new ArrayList<>();
        List<BscUnitResultItem> items = new ArrayList<>();

        for (BscScorecardPerspective row : rows) {
            double weight = row.getWeightPercentage() != null ? row.getWeightPercentage() : 0.0;
            totalWeight += weight;

            Double target = effectiveTarget(row);
            Double minimum = effectiveMinimum(row);

            List<KpiCriteria> kpis = kpisOfRow(unitKpis, row);

            Double actual = null;
            Double achievement = null;
            BscMeasurementSource source = row.getMeasurementSource() != null
                    ? row.getMeasurementSource() : BscMeasurementSource.ROLLUP;

            if (source == BscMeasurementSource.ROLLUP) {
                // Cộng thực đạt của MỌI người trong đơn vị (targetUserId = null), vì đây là kết quả
                // của đơn vị chứ không của một cá nhân.
                double sum = 0.0;
                int contributing = 0;
                for (KpiCriteria kpi : kpis) {
                    if (kpi.getKpiType() == KpiType.QUALITATIVE) continue;
                    sum += achievementCalculator.actualValue(kpi, null, enableWaterfall);
                    contributing++;
                }
                if (contributing > 0) {
                    actual = sum;
                    achievement = target != null && target > 0
                            ? achievementCalculator.perspectiveRatioFromActual(target, minimum, sum) * 100.0
                            // Dòng không đặt mục tiêu ⇒ không quy ra % được từ tổng thực đạt;
                            // rơi về trung bình có trọng số tỉ lệ đạt của các KPI con.
                            : averageKpiAchievement(kpis, enableWaterfall);
                } else if (!kpis.isEmpty()) {
                    achievement = averageKpiAchievement(kpis, enableWaterfall);
                }
            } else {
                // MANUAL / DATASOURCE: lấy con số đã nhập. DATASOURCE chưa nối nên hành xử như MANUAL.
                actual = manualActuals.get(row.getId());
                if (actual != null) {
                    achievement = achievementCalculator.perspectiveRatioFromActual(target, minimum, actual) * 100.0;
                }
            }

            Double weighted = achievement != null ? (weight / 100.0) * achievement : null;
            if (achievement != null) {
                weightedSum += weight * achievement;
                presentWeight += weight;
            }

            // Hạng mục chặn ở CẤP ĐƠN VỊ. Cũng như ở cá nhân: chưa có số liệu thì không kết luận trượt.
            Boolean gatePassed = null;
            if (Boolean.TRUE.equals(row.getIsGate())
                    && row.getGateAppliesTo() != BscGateScope.INDIVIDUAL
                    && achievement != null) {
                double min = row.getGateMinPercent() != null ? row.getGateMinPercent() : 100.0;
                gatePassed = achievement >= min;
                if (!gatePassed) {
                    gateFailures.add(row.getPerspective().getName()
                            + " (" + Math.round(achievement) + "% / ngưỡng " + Math.round(min) + "%)");
                }
            }

            items.add(BscUnitResultItem.builder()
                    .unitResult(result)
                    .scorecardPerspective(row)
                    .actualValue(actual)
                    .targetValue(target)
                    .achievementPercent(achievement)
                    .weightPercentage(weight)
                    .weightedScore(weighted)
                    .kpiCount(kpis.size())
                    .gatePassed(gatePassed)
                    .measurementSource(source)
                    .build());
        }

        Double achievementPercent = zeroFill
                ? (totalWeight > 0 ? weightedSum / totalWeight : null)
                : (presentWeight > 0 ? weightedSum / presentWeight : null);

        result.setAchievementPercent(achievementPercent);
        result.setGatePassed(gateFailures.isEmpty());
        result.setGateFailedItems(gateFailures.isEmpty() ? null : String.join(", ", gateFailures));

        // Dải/hệ số tính sẵn ngay ở bản nháp để người dùng thấy trước tác động; con số CHỐT
        // vẫn là con số được ghi lại lúc finalize.
        BscCascadePolicy policy = resolvePolicy(scorecard.getOrganization().getId(), kpiPeriodId);
        BscFactorScope scope = scorecard.getLevel() == BscScorecardLevel.COMPANY
                ? BscFactorScope.COMPANY : BscFactorScope.UNIT;
        BscFactorBand band = matchBand(policy, scope, achievementPercent);
        result.setBandCode(band != null ? band.getLabel() : null);
        result.setFactor(factorOf(policy, scope, achievementPercent));

        unitResultItemRepository.saveAll(items);
        return unitResultRepository.save(result);
    }

    /** Kết quả đã tính của một đợt (rỗng nếu chưa tính lần nào). */
    @Transactional(readOnly = true)
    public java.util.Optional<BscUnitResult> findResult(UUID scorecardId, UUID kpiPeriodId) {
        return unitResultRepository.findByScorecardIdAndKpiPeriodId(scorecardId, kpiPeriodId);
    }

    /** Chốt kết quả: từ đây con số và hệ số không đổi nữa trừ khi mở khoá. */
    @Transactional
    public BscUnitResult finalizeResult(UUID scorecardId, UUID kpiPeriodId) {
        User actor = currentUserOrNull();
        BscUnitResult result = unitResultRepository.findByScorecardIdAndKpiPeriodId(scorecardId, kpiPeriodId)
                .orElseThrow(() -> new BusinessException("Chưa có kết quả BSC cho đợt này — hãy tính trước khi chốt"));
        if (result.getAchievementPercent() == null) {
            throw new BusinessException("Chưa tính được kết quả BSC (không có chỉ tiêu nào có số liệu) nên chưa chốt được");
        }
        result.setStatus(BscUnitResultStatus.FINALIZED);
        result.setFinalizedBy(actor);
        result.setFinalizedAt(Instant.now());
        return unitResultRepository.save(result);
    }

    /** Mở khoá để tính lại — bắt buộc đi qua đây thay vì sửa thẳng, để còn dấu vết ai mở. */
    @Transactional
    public BscUnitResult reopenResult(UUID scorecardId, UUID kpiPeriodId) {
        BscUnitResult result = unitResultRepository.findByScorecardIdAndKpiPeriodId(scorecardId, kpiPeriodId)
                .orElseThrow(() -> new ResourceNotFoundException("Kết quả BSC đơn vị", "đợt", kpiPeriodId));
        result.setStatus(BscUnitResultStatus.DRAFT);
        result.setFinalizedBy(null);
        result.setFinalizedAt(null);
        return unitResultRepository.save(result);
    }

    /** Nhập tay kết quả thực đạt cho một dòng {@code MANUAL}. */
    @Transactional
    public BscUnitResult setManualActual(UUID scorecardId, UUID kpiPeriodId, UUID itemId, Double actual) {
        BscUnitResult result = unitResultRepository.findByScorecardIdAndKpiPeriodId(scorecardId, kpiPeriodId)
                .orElseThrow(() -> new BusinessException("Chưa có kết quả BSC cho đợt này — hãy tính trước"));
        if (result.getStatus() != BscUnitResultStatus.DRAFT) {
            throw new BusinessException("Kết quả đã chốt — mở khoá trước khi sửa số liệu");
        }
        accessGuard.assertCanEdit(result.getScorecard());
        BscUnitResultItem item = unitResultItemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Dòng kết quả", "id", itemId));
        if (!item.getUnitResult().getId().equals(result.getId())) {
            throw new BusinessException("Dòng kết quả không thuộc đợt đang sửa");
        }
        if (item.getScorecardPerspective().getMeasurementSource() != BscMeasurementSource.ROLLUP) {
            item.setActualValue(actual);
            unitResultItemRepository.save(item);
        } else {
            throw new BusinessException("Chỉ tiêu này đang lấy số liệu tự động từ KPI — đổi nguồn sang Nhập tay trước");
        }
        return recompute(scorecardId, kpiPeriodId);
    }

    /**
     * %đạt BSC của một bộ tiêu chí trong một đợt.
     * Ưu tiên bản ĐÃ CHỐT (bất biến); chưa chốt thì đọc bản nháp gần nhất. Không tự tính lại ở đây
     * vì hàm này bị gọi trong luồng chấm điểm — tính lại ngầm sẽ biến một thao tác đọc thành ghi.
     */
    @Transactional(readOnly = true)
    public Double achievementOf(UUID scorecardId, UUID kpiPeriodId) {
        return unitResultRepository.findByScorecardIdAndKpiPeriodId(scorecardId, kpiPeriodId)
                .map(BscUnitResult::getAchievementPercent)
                .orElse(null);
    }

    // ============================================================
    // Hệ số
    // ============================================================

    /** Dải khớp với một %đạt (null nếu không có chính sách hoặc không dải nào phủ). */
    public BscFactorBand matchBand(BscCascadePolicy policy, BscFactorScope scope, Double achievementPercent) {
        if (policy == null || achievementPercent == null) return null;
        return policy.getBands().stream()
                .filter(b -> b.getScope() == scope)
                .filter(b -> b.contains(achievementPercent))
                .findFirst()
                .orElse(null);
    }

    /**
     * Hệ số của một cấp. Đây là bước B2 của mục 5.3 — nơi quyết định mô hình phạt nặng hay nhẹ.
     *
     * <p>BAND_TABLE (mặc định) tra dải; DIRECT_RATIO nhân thẳng tỉ lệ (%/100); NONE bỏ qua.
     * Kết quả luôn bị kẹp trong [factorFloor, factorCap] — kể cả DIRECT_RATIO, nhờ vậy sàn 0.85
     * bảo đảm không ai mất quá 15% chỉ vì kết quả của cấp trên.
     */
    public double factorOf(BscCascadePolicy policy, BscFactorScope scope, Double achievementPercent) {
        if (policy == null || achievementPercent == null) return NEUTRAL_FACTOR;
        BscFactorMode mode = scope == BscFactorScope.COMPANY
                ? policy.getCompanyFactorMode() : policy.getUnitFactorMode();
        if (mode == null || mode == BscFactorMode.NONE) return NEUTRAL_FACTOR;

        double raw;
        if (mode == BscFactorMode.DIRECT_RATIO) {
            raw = achievementPercent / 100.0;
        } else {
            BscFactorBand band = matchBand(policy, scope, achievementPercent);
            if (band == null) return NEUTRAL_FACTOR;
            raw = band.getFactor() != null ? band.getFactor() : NEUTRAL_FACTOR;
        }
        double floor = policy.getFactorFloor() != null ? policy.getFactorFloor() : 0.0;
        double cap = policy.getFactorCap() != null ? policy.getFactorCap() : Double.MAX_VALUE;
        return Math.min(Math.max(raw, floor), cap);
    }

    /**
     * Ba bước B1–B3 cho MỘT cá nhân.
     *
     * @param scorecard bộ tiêu chí đã dùng để chấm điểm gốc của người này
     */
    @Transactional(readOnly = true)
    public CascadeOutcome applyForUser(BscScorecard scorecard, UUID organizationId, UUID kpiPeriodId, Double rawScore) {
        BscCascadePolicy policy = resolvePolicy(organizationId, kpiPeriodId);

        // Thẻ dùng để chấm điểm gốc CHÍNH LÀ thẻ công ty ⇒ không có tầng đơn vị riêng. Không được
        // tra cùng một con số làm cả hệ số phòng lẫn hệ số công ty, nếu không lệch bị phạt hai lần.
        boolean unitLevel = scorecard != null && scorecard.getLevel() == BscScorecardLevel.UNIT;

        Double unitAchievement = unitLevel ? achievementOf(scorecard.getId(), kpiPeriodId) : null;

        BscScorecard companyScorecard = companyScorecardOf(organizationId, kpiPeriodId, scorecard, unitLevel);
        Double companyAchievement = companyScorecard != null
                ? achievementOf(companyScorecard.getId(), kpiPeriodId) : null;

        double unitFactor = unitLevel ? factorOf(policy, BscFactorScope.UNIT, unitAchievement) : NEUTRAL_FACTOR;
        double companyFactor = factorOf(policy, BscFactorScope.COMPANY, companyAchievement);

        Double recognized = null;
        if (rawScore != null) {
            double cap = policy != null && policy.getRecognizedCapPercent() != null
                    ? policy.getRecognizedCapPercent() : Double.MAX_VALUE;
            double capped = Math.min(rawScore, cap);            // B1
            recognized = capped * unitFactor * companyFactor;   // B3
        }

        BscFactorBand unitBand = unitLevel ? matchBand(policy, BscFactorScope.UNIT, unitAchievement) : null;
        BscFactorBand companyBand = matchBand(policy, BscFactorScope.COMPANY, companyAchievement);

        return new CascadeOutcome(rawScore, unitAchievement, companyAchievement,
                unitFactor, companyFactor, recognized,
                unitBand != null ? unitBand.getLabel() : null,
                companyBand != null ? companyBand.getLabel() : null,
                policy);
    }

    /** Bộ tiêu chí cấp công ty của đợt. Trả null khi tổ chức chưa dựng BSC công ty. */
    private BscScorecard companyScorecardOf(UUID organizationId, UUID kpiPeriodId,
                                            BscScorecard userScorecard, boolean unitLevel) {
        if (!unitLevel) return userScorecard;   // thẻ của chính người này đã là thẻ công ty
        // Ưu tiên cha trực tiếp trong cây; không có thì lấy thẻ công ty của đợt.
        BscScorecard cur = userScorecard;
        int guard = 0;
        while (cur != null && guard++ < 100) {
            if (cur.getLevel() == BscScorecardLevel.COMPANY) return cur;
            cur = cur.getParentScorecard();
        }
        List<BscScorecard> company = scorecardRepository.findCompanyByPeriod(organizationId, kpiPeriodId);
        return company.isEmpty() ? null : company.get(0);
    }

    // ============================================================
    // Hạng mục chặn (QĐ-7)
    // ============================================================

    /**
     * Trần xếp loại từ các hạng mục chặn của MỘT cá nhân.
     *
     * <p>Chạy trên breakdown đã có sẵn của {@link BscScoringService} nên không tính lại gì.
     * KHÔNG đụng vào điểm — chỉ trả về trần xếp loại và danh sách hạng mục trượt.
     *
     * @param maxRating mức cao nhất của thang xếp loại (dùng cho BLOCK_EXCELLENT)
     */
    @Transactional(readOnly = true)
    public GateOutcome evaluateGates(BscScoringService.BscUserScore score, int maxRating) {
        if (score == null || score.getScorecard() == null) return new GateOutcome(true, null, null);

        List<BscScorecardPerspective> rows =
                scorecardPerspectiveRepository.findByScorecardIdOrderByDisplayOrderAsc(score.getScorecard().getId());

        List<String> failed = new ArrayList<>();
        Integer cap = null;

        for (BscScorecardPerspective row : rows) {
            if (!Boolean.TRUE.equals(row.getIsGate())) continue;
            if (row.getGateAppliesTo() == BscGateScope.UNIT) continue;

            PerspectiveScoreResponse line = score.getPerspectives().stream()
                    .filter(p -> row.getId().equals(p.getScorecardPerspectiveId()))
                    .findFirst().orElse(null);
            // Không có số liệu ⇒ không kết luận trượt. Chặn oan một người vì hạng mục rỗng
            // là lỗi nặng hơn nhiều so với bỏ sót một trường hợp.
            if (line == null || line.getAchievementPercent() == null) continue;

            double min = row.getGateMinPercent() != null ? row.getGateMinPercent() : 100.0;
            if (line.getAchievementPercent() >= min) continue;

            failed.add(row.getPerspective().getName()
                    + " (" + Math.round(line.getAchievementPercent()) + "% / ngưỡng " + Math.round(min) + "%)");

            BscGateEffect effect = row.getGateEffect() != null ? row.getGateEffect() : BscGateEffect.WARN_ONLY;
            Integer rowCap = null;
            if (effect == BscGateEffect.BLOCK_EXCELLENT) {
                rowCap = Math.max(1, maxRating - 1);
            } else if (effect == BscGateEffect.CAP_AT_RATING) {
                rowCap = row.getGateCapRating();
            }
            // Nhiều hạng mục cùng trượt ⇒ lấy trần THẤP NHẤT.
            if (rowCap != null) cap = cap == null ? rowCap : Math.min(cap, rowCap);
        }

        return new GateOutcome(failed.isEmpty(), cap, failed.isEmpty() ? null : String.join(", ", failed));
    }

    // ============================================================
    // Ràng buộc trọng số KPI liên kết BSC (QĐ-8 — FR-021)
    // ============================================================

    /**
     * Bao nhiêu % tổng trọng số KPI của một người trong một đợt thực sự bám vào BSC.
     *
     * <p>Không được để một người khai 100% KPI tự do rồi vẫn đạt điểm cao — như vậy toàn bộ cây
     * phân rã trở thành hình thức. Mặc định chỉ CẢNH BÁO; chuyển sang chặn cứng khi tổ chức đã
     * chạy trôi ít nhất một kỳ (xem {@code linkedWeightEnforce}).
     */
    @Transactional(readOnly = true)
    public LinkedWeightCheck checkLinkedWeight(UUID userId, UUID kpiPeriodId, UUID organizationId) {
        BscCascadePolicy policy = resolvePolicy(organizationId, kpiPeriodId);
        double min = policy != null && policy.getMinBscLinkedWeight() != null ? policy.getMinBscLinkedWeight() : 0.0;
        boolean enforced = policy != null
                && policy.getLinkedWeightEnforce() == com.kpitracking.enums.BscLinkedWeightEnforce.BLOCK;

        List<KpiCriteria> kpis = kpiCriteriaRepository.findAllByAssigneeAndPeriod(
                userId, kpiPeriodId, BscScoringService.ACTIVE_STATUSES);

        double total = 0.0, linked = 0.0;
        for (KpiCriteria kpi : kpis) {
            if (!achievementCalculator.countsTowardBscScore(kpi)) continue;
            double w = kpi.getWeight() != null ? kpi.getWeight() : 0.0;
            total += w;
            if (kpi.getScorecardPerspective() != null) linked += w;
        }
        // Chưa có KPI nào thì không có gì để đánh giá — coi như đạt, tránh cảnh báo vô nghĩa
        // cho người vừa được tạo tài khoản.
        double percent = total > 0 ? (linked / total) * 100.0 : 100.0;
        return new LinkedWeightCheck(percent, min, percent >= min - 0.01, enforced);
    }

    // ============================================================
    // Helper
    // ============================================================

    /**
     * KPI thuộc về một dòng chỉ tiêu — DÙNG CHUNG LUẬT với chấm điểm cá nhân
     * ({@link BscScoringService#computeForUser}).
     *
     * <p>KPI đã gắn thẳng một dòng thì chỉ thuộc dòng đó. KPI CHƯA gắn dòng nào thì suy theo hạng
     * mục, y như tầng cá nhân vẫn làm. Bỏ nhánh suy theo hạng mục là kết quả đơn vị vĩnh viễn rỗng
     * với mọi dữ liệu đang có: ô chọn dòng chỉ tiêu trong form KPI chưa tồn tại, nên trên thực tế
     * chưa KPI nào mang {@code scorecardPerspective} cả — trong khi điểm cá nhân của cùng những
     * KPI đó vẫn tính ra bình thường. Hai tầng lệch luật nhau là chuyện không giải thích được.
     */
    private List<KpiCriteria> kpisOfRow(List<KpiCriteria> unitKpis, BscScorecardPerspective row) {
        UUID perspectiveId = row.getPerspective() != null ? row.getPerspective().getId() : null;
        List<KpiCriteria> out = new ArrayList<>();
        for (KpiCriteria kpi : unitKpis) {
            if (!achievementCalculator.countsTowardBscScore(kpi)) continue;
            if (kpi.getScorecardPerspective() != null) {
                if (kpi.getScorecardPerspective().getId().equals(row.getId())) out.add(kpi);
                continue;
            }
            UUID eff = com.kpitracking.util.BscPerspectiveResolver.effectivePerspectiveId(kpi);
            if (eff != null && eff.equals(perspectiveId)) out.add(kpi);
        }
        return out;
    }

    /** Trung bình có trọng số tỉ lệ đạt của các KPI — dùng khi dòng chỉ tiêu không đặt mục tiêu riêng. */
    private double averageKpiAchievement(List<KpiCriteria> kpis, boolean enableWaterfall) {
        double ratioWeightSum = 0.0, weightSum = 0.0;
        for (KpiCriteria kpi : kpis) {
            Double ratio = achievementCalculator.bscRatio(kpi, null, enableWaterfall);
            if (ratio == null) continue;
            double w = kpi.getWeight() != null ? kpi.getWeight() : 0.0;
            ratioWeightSum += ratio * w;
            weightSum += w;
        }
        return weightSum > 0 ? (ratioWeightSum / weightSum) * 100.0 : 0.0;
    }

    private User currentUserOrNull() {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            return userRepository.findByEmail(email).orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    private static Double effectiveTarget(BscScorecardPerspective sp) {
        if (sp.getTargetValue() != null) return sp.getTargetValue();
        return sp.getPerspective() != null ? sp.getPerspective().getTargetValue() : null;
    }

    private static Double effectiveMinimum(BscScorecardPerspective sp) {
        if (sp.getMinimumValue() != null) return sp.getMinimumValue();
        return sp.getPerspective() != null ? sp.getPerspective().getMinimumValue() : null;
    }
}
