package com.kpitracking.service.reward;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.dto.request.reward.RewardProgramRequest;
import com.kpitracking.dto.response.reward.RewardProgramResponse;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.RewardProgram;
import com.kpitracking.enums.RewardProgramScope;
import com.kpitracking.enums.RewardRankWithin;
import com.kpitracking.enums.RewardRankingMetric;
import com.kpitracking.enums.RewardRunStatus;
import com.kpitracking.enums.RewardTiePolicy;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.KpiCycleRepository;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.RewardProgramRepository;
import com.kpitracking.repository.RewardProgramRunRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/** Cấu hình chương trình thưởng tự động theo thứ hạng. */
@Slf4j
@Service
@RequiredArgsConstructor
public class RewardProgramService {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final RewardProgramRepository programRepository;
    private final RewardProgramRunRepository runRepository;
    private final OrganizationRepository organizationRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final KpiCycleRepository kpiCycleRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final RewardContext context;

    @Transactional(readOnly = true)
    public List<RewardProgramResponse> list() {
        return programRepository
                .findByOrganizationIdOrderByCreatedAtDesc(context.getCurrentOrgId())
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public RewardProgramResponse getById(UUID id) {
        return toResponse(load(id));
    }

    @Transactional
    public RewardProgramResponse create(RewardProgramRequest request) {
        UUID orgId = context.getCurrentOrgId();
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));

        RewardProgram program = RewardProgram.builder()
                .organization(org)
                .createdBy(context.getCurrentUser())
                .build();
        apply(program, request);
        return toResponse(programRepository.save(program));
    }

    @Transactional
    public RewardProgramResponse update(UUID id, RewardProgramRequest request) {
        RewardProgram program = load(id);

        // Đổi phạm vi (đợt ↔ kỳ) của chương trình đã từng phát thưởng sẽ khiến các lần
        // phát cũ không còn giải thích được bằng cấu hình hiện tại — người xem lại lịch
        // sử sẽ thấy một đợt phát mà chương trình lại nói là chạy theo kỳ.
        if (program.getScope() != request.getScope() && hasIssuedRun(id)) {
            throw new BusinessException("Không thể đổi phạm vi của chương trình đã từng phát thưởng. "
                    + "Hãy tạo chương trình mới nếu muốn chạy theo phạm vi khác.");
        }

        apply(program, request);
        return toResponse(programRepository.save(program));
    }

    @Transactional
    public void delete(UUID id) {
        RewardProgram program = load(id);

        // Cùng lý do với quà tặng và hạn mức: các lần phát vẫn trỏ về chương trình này.
        // Xoá mềm sẽ khiến chúng không nạp được (entity có @SQLRestriction), làm hỏng
        // lịch sử phát thưởng.
        if (hasIssuedRun(id)) {
            throw new BusinessException("Không thể xoá \"" + program.getName()
                    + "\" vì đã có lần phát thưởng thực tế. Hãy TẮT chương trình để ngừng dùng — "
                    + "lịch sử phát thưởng vẫn tra cứu được.");
        }

        program.setDeletedAt(Instant.now());
        programRepository.save(program);
    }

    private boolean hasIssuedRun(UUID programId) {
        return runRepository.findByProgramIdOrderByCreatedAtDesc(programId).stream()
                .anyMatch(r -> r.getStatus() != RewardRunStatus.PREVIEW);
    }

    private void apply(RewardProgram program, RewardProgramRequest request) {
        validateTiers(request.getTiers());

        // Xếp loại ma trận chỉ tồn tại khi tổ chức bật KPI định tính: cột matrix_rating
        // do luồng đó điền, và getEffectivePerformanceScore cũng chỉ trả về nó khi
        // enableQualitative bật. Cho chọn lúc tắt sẽ ra bảng xếp hạng rỗng mà không rõ
        // vì sao — chặn ngay lúc lưu cấu hình.
        if (request.getMetric() == RewardRankingMetric.MATRIX_RATING
                && !Boolean.TRUE.equals(program.getOrganization().getEnableQualitative())) {
            throw new BusinessException("Chỉ số \"Xếp loại (ma trận)\" cần bật KPI định tính cho tổ chức. "
                    + "Hãy bật ở Thiết lập công ty, hoặc chọn chỉ số khác.");
        }

        program.setName(request.getName());
        program.setDescription(request.getDescription());
        program.setScope(request.getScope());
        program.setMetric(request.getMetric());
        program.setMinMetricValue(request.getMinMetricValue());
        program.setMaxPointsPerRun(request.getMaxPointsPerRun());
        program.setRankWithin(request.getRankWithin() != null
                ? request.getRankWithin() : RewardRankWithin.SCOPE);
        program.setTiePolicy(request.getTiePolicy() != null
                ? request.getTiePolicy() : RewardTiePolicy.SHARE_ALL);
        program.setIncludeUnitHeads(request.getIncludeUnitHeads() == null
                || request.getIncludeUnitHeads());
        program.setEnabled(request.getEnabled() == null || request.getEnabled());
        program.setAutoTrigger(Boolean.TRUE.equals(request.getAutoTrigger()));

        if (request.getOrgUnitId() != null) {
            OrgUnit unit = orgUnitRepository.findById(request.getOrgUnitId())
                    .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", request.getOrgUnitId()));
            program.setOrgUnit(unit);
        } else {
            program.setOrgUnit(null);
        }

        applyFixedTarget(program, request);

        try {
            program.setTiers(MAPPER.writeValueAsString(request.getTiers()));
        } catch (Exception e) {
            throw new BusinessException("Không đọc được cấu hình bậc thưởng.");
        }
    }

    /**
     * Bậc thưởng phải liền mạch và không chồng nhau.
     *
     * <p>Chồng nhau thì một người có thể rơi vào hai bậc và không rõ nhận mức nào —
     * chặn ở đây thay vì để service phát thưởng tự chọn bừa một bậc.
     */
    /**
     * Gắn (hoặc gỡ) kỳ/đợt cố định. Đặt vào đúng cột theo {@code scope} — ràng buộc ở DB
     * cấm gắn kỳ cho chương trình theo đợt và ngược lại.
     */
    private void applyFixedTarget(RewardProgram program, RewardProgramRequest request) {
        program.setKpiCycle(null);
        program.setKpiPeriod(null);
        if (request.getFixedTargetId() == null) return;

        if (request.getScope() == RewardProgramScope.CYCLE) {
            program.setKpiCycle(kpiCycleRepository.findById(request.getFixedTargetId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Kỳ đánh giá", "id", request.getFixedTargetId())));
        } else {
            program.setKpiPeriod(kpiPeriodRepository.findById(request.getFixedTargetId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Đợt đánh giá", "id", request.getFixedTargetId())));
        }
    }

    public void validateTiers(List<RewardProgramRequest.Tier> tiers) {
        if (tiers == null || tiers.isEmpty()) {
            throw new BusinessException("Cần ít nhất một bậc thưởng.");
        }
        List<RewardProgramRequest.Tier> sorted = new ArrayList<>(tiers);
        sorted.sort(Comparator.comparing(RewardProgramRequest.Tier::getFromRank));

        for (RewardProgramRequest.Tier t : sorted) {
            if (t.getToRank() < t.getFromRank()) {
                throw new BusinessException("Bậc thưởng có hạng kết thúc (" + t.getToRank()
                        + ") nhỏ hơn hạng bắt đầu (" + t.getFromRank() + ").");
            }
        }
        for (int i = 1; i < sorted.size(); i++) {
            if (sorted.get(i).getFromRank() <= sorted.get(i - 1).getToRank()) {
                throw new BusinessException("Hai bậc thưởng bị chồng nhau tại hạng "
                        + sorted.get(i).getFromRank()
                        + " — mỗi hạng chỉ được thuộc về đúng một bậc.");
            }
        }
    }

    /** Đọc bậc thưởng mặc định của chương trình. */
    public List<RewardProgramRequest.Tier> parseTiers(RewardProgram program) {
        try {
            return MAPPER.readValue(program.getTiers(), new TypeReference<>() {});
        } catch (Exception e) {
            log.error("Cấu hình bậc thưởng hỏng, programId={}", program.getId(), e);
            throw new BusinessException("Cấu hình bậc thưởng của chương trình \""
                    + program.getName() + "\" bị lỗi. Hãy mở ra và lưu lại.");
        }
    }

    /**
     * Đọc bậc thưởng đã chụp của một lần chạy, lùi về bậc của chương trình nếu chưa có.
     *
     * <p>Lùi về là để tương thích với các lần chạy tạo trước migration V7 — chúng đã
     * được backfill nhưng vẫn phòng trường hợp cột trống.
     */
    public List<RewardProgramRequest.Tier> readTiers(String json, RewardProgram fallback) {
        if (json == null || json.isBlank()) return parseTiers(fallback);
        try {
            return MAPPER.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Bậc thưởng của lần chạy hỏng, lùi về bậc của chương trình {}", fallback.getId());
            return parseTiers(fallback);
        }
    }

    public String writeTiers(List<RewardProgramRequest.Tier> tiers) {
        try {
            return MAPPER.writeValueAsString(tiers);
        } catch (Exception e) {
            throw new BusinessException("Không lưu được cấu hình bậc thưởng.");
        }
    }

    public RewardProgram load(UUID id) {
        RewardProgram program = loadForSystem(id);
        if (!program.getOrganization().getId().equals(context.getCurrentOrgId())) {
            throw new BusinessException("Chương trình này không thuộc tổ chức của bạn.");
        }
        return program;
    }

    /**
     * Bản KHÔNG kiểm tổ chức, dành cho bộ chạy nền.
     *
     * <p>Job tự động không có phiên đăng nhập nên {@code context.getCurrentOrgId()} sẽ
     * ném lỗi. Bỏ kiểm ở đây là an toàn vì job tự lấy danh sách chương trình từ DB,
     * không nhận id từ bên ngoài.
     */
    public RewardProgram loadForSystem(UUID id) {
        return programRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Chương trình thưởng", "id", id));
    }

    public RewardProgramResponse toResponse(RewardProgram p) {
        long issued = runRepository.findByProgramIdOrderByCreatedAtDesc(p.getId()).stream()
                .filter(r -> r.getStatus() == RewardRunStatus.ISSUED)
                .count();

        return RewardProgramResponse.builder()
                .id(p.getId())
                .name(p.getName())
                .description(p.getDescription())
                .scope(p.getScope())
                .orgUnitId(p.getOrgUnit() != null ? p.getOrgUnit().getId() : null)
                .orgUnitName(p.getOrgUnit() != null ? p.getOrgUnit().getName() : null)
                .fixedTargetId(p.fixedTargetId())
                .fixedTargetName(p.getKpiCycle() != null ? p.getKpiCycle().getName()
                        : (p.getKpiPeriod() != null ? p.getKpiPeriod().getName() : null))
                .rankWithin(p.getRankWithin())
                .metric(p.getMetric())
                .tiePolicy(p.getTiePolicy())
                .minMetricValue(p.getMinMetricValue())
                .maxPointsPerRun(p.getMaxPointsPerRun())
                .includeUnitHeads(p.getIncludeUnitHeads())
                .tiers(parseTiersSafe(p))
                .enabled(p.getEnabled())
                .autoTrigger(p.getAutoTrigger())
                .createdAt(p.getCreatedAt())
                .issuedRunCount((int) issued)
                .build();
    }

    /** Bản không ném lỗi, để một chương trình hỏng cấu hình không làm sập cả danh sách. */
    private List<RewardProgramRequest.Tier> parseTiersSafe(RewardProgram p) {
        try {
            return MAPPER.readValue(p.getTiers(), new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Bỏ qua cấu hình bậc thưởng hỏng khi liệt kê, programId={}", p.getId());
            return List.of();
        }
    }
}
