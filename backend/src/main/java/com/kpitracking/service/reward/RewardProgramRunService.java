package com.kpitracking.service.reward;

import com.kpitracking.dto.request.reward.RewardProgramRequest;
import com.kpitracking.dto.response.reward.RewardProgramRunResponse;
import com.kpitracking.entity.*;
import com.kpitracking.enums.RewardProgramScope;
import com.kpitracking.enums.RewardRunStatus;
import com.kpitracking.enums.RewardSourceType;
import com.kpitracking.enums.RewardTiePolicy;
import com.kpitracking.enums.RewardTransactionType;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.*;
import com.kpitracking.service.RewardWalletService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

/**
 * Chạy chương trình thưởng: xem trước → phát → (nếu cần) thu hồi.
 *
 * <h2>Vì sao phải hai bước</h2>
 * {@code kpi_periods} và {@code kpi_cycles} không có cột trạng thái, nên hệ thống không
 * có sự kiện "đóng đợt" để tự động bám vào. Thay vào đó quản trị viên chủ động xem trước
 * rồi mới phát. Điều này cũng đúng về nghiệp vụ: phát thưởng hàng loạt là việc cần nhìn
 * tận mắt danh sách trước khi bấm.
 *
 * <h2>Ba lớp chống phát trùng</h2>
 * <ol>
 *   <li>Unique index một phần ở DB trên {@code (program_id, target) WHERE status='ISSUED'} —
 *       lớp DUY NHẤT sống sót trước hai cú bấm đồng thời.</li>
 *   <li>Kiểm trạng thái ở service — bắt sớm, báo lỗi dễ hiểu.</li>
 *   <li>{@code snapshotHash} — lúc phát, tính LẠI bảng xếp hạng và so hash với bản đã
 *       xem trước. Lệch nghĩa là dữ liệu nguồn đã đổi ⇒ từ chối. Đây là thứ khiến câu
 *       "tôi đã duyệt đúng danh sách đó" là sự thật chứ không phải niềm tin.</li>
 * </ol>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RewardProgramRunService {

    private final RewardProgramRunRepository runRepository;
    private final RewardProgramRunItemRepository runItemRepository;
    private final KpiCycleRepository kpiCycleRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final UserRepository userRepository;
    private final RewardProgramService programService;
    private final RewardRankingService rankingService;
    private final RewardWalletService walletService;
    private final RewardContext context;

    /** Kết quả tính toán chưa lưu — dùng chung cho xem trước và cho lúc so hash khi phát. */
    private record Computed(
            List<RewardProgramRunResponse.Item> items,
            List<RewardProgramRunResponse.Skipped> skipped,
            int totalPoints,
            String hash
    ) {}

    // ────────────────────────────── XEM TRƯỚC ──────────────────────────────

    /**
     * Tính bảng xếp hạng và lưu thành bản PREVIEW. Chưa đụng tới điểm của ai.
     *
     * <p>Xem trước lại cùng một (chương trình, đợt/kỳ) sẽ THAY THẾ bản cũ — thao tác tự
     * nhiên sau khi sửa dữ liệu nguồn, và tránh để lại một đống bản nháp vô nghĩa.
     */
    @Transactional
    public RewardProgramRunResponse preview(UUID programId, UUID requestedTargetId,
                                            List<RewardProgramRequest.Tier> tierOverride) {
        return previewInternal(programService.load(programId), requestedTargetId, tierOverride);
    }

    /**
     * Bản dành cho bộ chạy nền: không kiểm tổ chức vì job không có phiên đăng nhập.
     * Mọi luật nghiệp vụ khác (chống phát trùng, trần điểm, vân tay) vẫn áp y hệt.
     */
    @Transactional
    public RewardProgramRunResponse previewAsSystem(UUID programId, UUID targetId) {
        return previewInternal(programService.loadForSystem(programId), targetId, null);
    }

    private RewardProgramRunResponse previewInternal(RewardProgram program, UUID requestedTargetId,
                                                     List<RewardProgramRequest.Tier> tierOverride) {
        UUID orgId = program.getOrganization().getId();

        // Chương trình gắn cứng kỳ/đợt thì mục tiêu do CẤU HÌNH quyết, không nhận từ
        // request — nếu không, gọi API trực tiếp có thể phát nhầm sang kỳ khác.
        final UUID targetId = program.hasFixedTarget() ? program.fixedTargetId() : requestedTargetId;
        if (targetId == null) {
            throw new BusinessException("Vui lòng chọn kỳ hoặc đợt để xếp hạng.");
        }

        assertNotIssued(program, targetId);

        // Bậc của chương trình chỉ là MẶC ĐỊNH. Người quản trị sửa được cho riêng lần
        // chạy này — ví dụ thưởng cuối năm hậu hĩnh hơn các quý khác — mà không phải
        // sửa cấu hình chương trình (việc đó sẽ làm sai lịch sử các lần phát trước).
        List<RewardProgramRequest.Tier> tiers = (tierOverride == null || tierOverride.isEmpty())
                ? programService.parseTiers(program)
                : tierOverride;
        programService.validateTiers(tiers);

        Computed c = compute(program, targetId, orgId, tiers);

        // Xoá bản xem trước cũ của đúng cặp (chương trình, mục tiêu).
        findExistingPreview(program, targetId).ifPresent(old -> {
            runItemRepository.deleteByRunId(old.getId());
            runRepository.delete(old);
            runRepository.flush();
        });

        RewardProgramRun run = RewardProgramRun.builder()
                .program(program)
                .organization(program.getOrganization())
                .status(RewardRunStatus.PREVIEW)
                .totalPoints(c.totalPoints())
                .recipientCount(c.items().size())
                .snapshotHash(c.hash())
                .tiers(programService.writeTiers(tiers))
                .build();
        attachTarget(run, program, targetId);
        runRepository.save(run);

        List<RewardProgramRunItem> entities = c.items().stream()
                .map(i -> RewardProgramRunItem.builder()
                        .run(run)
                        .user(userRepository.getReferenceById(i.getUserId()))
                        .rank(i.getRank())
                        .orderIndex(i.getOrderIndex())
                        .metricValue(i.getMetricValue())
                        .points(i.getPoints())
                        .build())
                .toList();
        runItemRepository.saveAll(entities);

        return toResponse(run, c.items(), c.skipped());
    }

    // ──────────────────────────────── PHÁT ────────────────────────────────

    @Transactional
    public RewardProgramRunResponse issue(UUID runId) {
        return issueInternal(loadRun(runId), context.getCurrentUser());
    }

    /**
     * Bản dành cho bộ chạy nền. {@code actor = null} nên sổ cái ghi nhận giao dịch do hệ
     * thống tạo — trung thực hơn là gán bừa cho một người nào đó không hề bấm nút.
     */
    @Transactional
    public RewardProgramRunResponse issueAsSystem(UUID runId) {
        RewardProgramRun run = runRepository.findById(runId)
                .orElseThrow(() -> new ResourceNotFoundException("Lần chạy chương trình", "id", runId));
        return issueInternal(run, null);
    }

    private RewardProgramRunResponse issueInternal(RewardProgramRun run, User actor) {
        UUID runId = run.getId();
        if (run.getStatus() != RewardRunStatus.PREVIEW) {
            throw new BusinessException("Chỉ phát thưởng được từ bản xem trước. "
                    + "Lần chạy này đang ở trạng thái " + run.getStatus() + ".");
        }

        RewardProgram program = run.getProgram();
        UUID targetId = targetIdOf(run);
        assertNotIssued(program, targetId);

        // Tính lại và so hash: dữ liệu đánh giá có thể đã đổi từ lúc xem trước tới giờ.
        // Dùng bậc thưởng ĐÃ CHỤP của lần chạy, không phải bậc hiện tại của chương trình —
        // nếu ai đó sửa cấu hình sau lúc xem trước, phải phát đúng cái đã duyệt.
        Computed fresh = compute(program, targetId, program.getOrganization().getId(),
                programService.readTiers(run.getTiers(), program));
        if (!fresh.hash().equals(run.getSnapshotHash())) {
            throw new BusinessException("Bảng xếp hạng đã thay đổi so với lúc xem trước "
                    + "(điểm đánh giá hoặc nhân sự có cập nhật). Vui lòng xem trước lại rồi phát.");
        }

        if (program.getMaxPointsPerRun() != null && fresh.totalPoints() > program.getMaxPointsPerRun()) {
            throw new BusinessException("Tổng điểm phát (" + fresh.totalPoints()
                    + ") vượt trần an toàn " + program.getMaxPointsPerRun()
                    + " điểm/lần của chương trình. Hãy sửa bậc thưởng hoặc nâng trần.");
        }
        if (fresh.items().isEmpty()) {
            throw new BusinessException("Không có ai đủ điều kiện nhận thưởng trong lần chạy này.");
        }

        List<RewardProgramRunItem> items = runItemRepository.findByRunIdOrderByOrderIndexAsc(runId);

        for (RewardProgramRunItem item : items) {
            RewardTransaction tx = walletService.applyTransaction(RewardWalletService.LedgerEntry.builder()
                    .organizationId(program.getOrganization().getId())
                    .userId(item.getUser().getId())
                    .amount(item.getPoints())
                    .type(RewardTransactionType.EARN)
                    .sourceType(RewardSourceType.AUTO_RANKING)
                    .sourceRefId(item.getId())
                    .idempotencyKey(RewardWalletService.key("run", runId, item.getUser().getId()))
                    .note(program.getName() + " — hạng " + item.getRank())
                    .actor(actor)
                    .build());
            item.setTransactionId(tx.getId());
        }
        runItemRepository.saveAll(items);

        run.setStatus(RewardRunStatus.ISSUED);
        run.setExecutedBy(actor);
        run.setExecutedAt(Instant.now());
        runRepository.save(run);

        return toResponse(run, fresh.items(), fresh.skipped());
    }

    // ────────────────────────────── THU HỒI ──────────────────────────────

    /**
     * Thu hồi cả lần phát: ghi bút toán âm bù trừ cho từng người.
     *
     * <p>Cho phép số dư xuống âm, cùng lý do với thu hồi thưởng thủ công — kẹp về 0 sẽ
     * phá bất biến của sổ cái. Sau khi thu hồi, unique index nhả ra nên chương trình có
     * thể xem trước và phát lại cho cùng đợt/kỳ đó.
     */
    @Transactional
    public RewardProgramRunResponse revert(UUID runId) {
        RewardProgramRun run = loadRun(runId);
        if (run.getStatus() != RewardRunStatus.ISSUED) {
            throw new BusinessException("Chỉ thu hồi được lần chạy đã phát thưởng.");
        }

        User actor = context.getCurrentUser();
        List<RewardProgramRunItem> items = runItemRepository.findByRunIdOrderByOrderIndexAsc(runId);

        for (RewardProgramRunItem item : items) {
            walletService.applyTransaction(RewardWalletService.LedgerEntry.builder()
                    .organizationId(run.getOrganization().getId())
                    .userId(item.getUser().getId())
                    .amount(-item.getPoints())
                    .type(RewardTransactionType.ADJUST)
                    .sourceType(RewardSourceType.AUTO_RANKING)
                    .sourceRefId(item.getId())
                    .reversalOfTransactionId(item.getTransactionId())
                    .idempotencyKey(RewardWalletService.key("run_revert", runId, item.getUser().getId()))
                    .note("Thu hồi thưởng chương trình: " + run.getProgram().getName())
                    .actor(actor)
                    .build());
        }

        run.setStatus(RewardRunStatus.REVERTED);
        run.setRevertedBy(actor);
        run.setRevertedAt(Instant.now());
        runRepository.save(run);

        return toResponse(run, toItemDtos(items), List.of());
    }

    // ────────────────────────────── TÍNH TOÁN ──────────────────────────────

    /**
     * Xếp hạng → gán hạng thi đấu → tra bậc thưởng → tính hash.
     *
     * <p>Hàm này phải THUẦN: cùng dữ liệu nguồn thì cùng kết quả, kể cả thứ tự. Nó được
     * gọi hai lần (lúc xem trước và lúc phát) và hai kết quả phải khớp hash.
     */
    private Computed compute(RewardProgram program, UUID targetId, UUID orgId,
                             List<RewardProgramRequest.Tier> tiers) {
        var result = rankingService.rank(program, targetId, orgId);
        boolean strict = program.getTiePolicy() == RewardTiePolicy.STRICT;

        List<RewardProgramRunResponse.Item> items = new ArrayList<>();
        int orderIndex = 0;
        int rank = 0;
        Double prevScore = null;

        for (var u : result.ranked()) {
            orderIndex++;
            // Hạng THI ĐẤU: cùng điểm thì cùng hạng, hạng kế tiếp nhảy cóc
            // (1, 2, 2, 4). STRICT thì bỏ qua đồng hạng, mỗi người một hạng riêng.
            if (strict || prevScore == null || !Objects.equals(prevScore, u.metricValue())) {
                rank = orderIndex;
            }
            prevScore = u.metricValue();

            Integer points = pointsForRank(tiers, rank);
            if (points == null) continue; // ngoài mọi bậc thưởng ⇒ không nhận gì

            items.add(RewardProgramRunResponse.Item.builder()
                    .userId(u.userId())
                    .fullName(u.fullName())
                    .employeeCode(u.employeeCode())
                    .orgUnitName(u.orgUnitName())
                    .rank(rank)
                    .orderIndex(orderIndex)
                    .metricValue(u.metricValue())
                    .points(points)
                    .build());
        }

        List<RewardProgramRunResponse.Skipped> skipped = result.skipped().stream()
                .map(s -> RewardProgramRunResponse.Skipped.builder()
                        .userId(s.userId()).fullName(s.fullName()).reason(s.reason()).build())
                .toList();

        int total = items.stream().mapToInt(RewardProgramRunResponse.Item::getPoints).sum();
        return new Computed(items, skipped, total, hashOf(items));
    }

    private Integer pointsForRank(List<RewardProgramRequest.Tier> tiers, int rank) {
        return tiers.stream()
                .filter(t -> rank >= t.getFromRank() && rank <= t.getToRank())
                .map(RewardProgramRequest.Tier::getPoints)
                .findFirst()
                .orElse(null);
    }

    /**
     * Vân tay của danh sách phát thưởng: chỉ gồm (người, điểm) theo đúng thứ tự.
     *
     * <p>Cố ý KHÔNG đưa điểm đánh giá vào hash: điểm có thể được làm tròn khác đi giữa
     * hai lần đọc mà danh sách nhận thưởng vẫn y hệt — lúc đó chặn phát là chặn nhầm.
     * Thứ cần bảo vệ là "ai nhận bao nhiêu", không phải mọi con số trung gian.
     */
    private String hashOf(List<RewardProgramRunResponse.Item> items) {
        String raw = items.stream()
                .map(i -> i.getUserId() + ":" + i.getPoints())
                .reduce("", (a, b) -> a + "|" + b);
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(raw.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("Không tính được vân tay bảng xếp hạng", e);
        }
    }

    // ──────────────────────────────── ĐỌC ────────────────────────────────

    @Transactional(readOnly = true)
    public List<RewardProgramRunResponse> listByProgram(UUID programId) {
        programService.load(programId); // kiểm tra thuộc tổ chức
        return runRepository.findByProgramIdOrderByCreatedAtDesc(programId).stream()
                .map(r -> toResponse(r, List.of(), List.of()))
                .toList();
    }

    @Transactional(readOnly = true)
    public RewardProgramRunResponse getById(UUID runId) {
        RewardProgramRun run = loadRun(runId);
        return toResponse(run, toItemDtos(runItemRepository.findByRunIdOrderByOrderIndexAsc(runId)), List.of());
    }

    // ──────────────────────────────── HỖ TRỢ ────────────────────────────────

    private void assertNotIssued(RewardProgram program, UUID targetId) {
        boolean issued = program.getScope() == RewardProgramScope.CYCLE
                ? runRepository.existsByProgramIdAndKpiCycleIdAndStatus(
                        program.getId(), targetId, RewardRunStatus.ISSUED)
                : runRepository.existsByProgramIdAndKpiPeriodIdAndStatus(
                        program.getId(), targetId, RewardRunStatus.ISSUED);
        if (issued) {
            throw new BusinessException("Chương trình này đã phát thưởng cho "
                    + (program.getScope() == RewardProgramScope.CYCLE ? "kỳ" : "đợt")
                    + " đó rồi. Muốn phát lại, hãy thu hồi lần phát cũ trước.");
        }
    }

    private Optional<RewardProgramRun> findExistingPreview(RewardProgram program, UUID targetId) {
        return program.getScope() == RewardProgramScope.CYCLE
                ? runRepository.findByProgramIdAndKpiCycleIdAndStatus(
                        program.getId(), targetId, RewardRunStatus.PREVIEW)
                : runRepository.findByProgramIdAndKpiPeriodIdAndStatus(
                        program.getId(), targetId, RewardRunStatus.PREVIEW);
    }

    private void attachTarget(RewardProgramRun run, RewardProgram program, UUID targetId) {
        if (program.getScope() == RewardProgramScope.CYCLE) {
            run.setKpiCycle(kpiCycleRepository.findById(targetId)
                    .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá", "id", targetId)));
        } else {
            run.setKpiPeriod(kpiPeriodRepository.findById(targetId)
                    .orElseThrow(() -> new ResourceNotFoundException("Đợt đánh giá", "id", targetId)));
        }
    }

    private UUID targetIdOf(RewardProgramRun run) {
        return run.getKpiCycle() != null ? run.getKpiCycle().getId() : run.getKpiPeriod().getId();
    }

    private RewardProgramRun loadRun(UUID runId) {
        RewardProgramRun run = runRepository.findById(runId)
                .orElseThrow(() -> new ResourceNotFoundException("Lần chạy chương trình", "id", runId));
        if (!run.getOrganization().getId().equals(context.getCurrentOrgId())) {
            throw new BusinessException("Lần chạy này không thuộc tổ chức của bạn.");
        }
        return run;
    }

    private List<RewardProgramRunResponse.Item> toItemDtos(List<RewardProgramRunItem> items) {
        return items.stream()
                .map(i -> RewardProgramRunResponse.Item.builder()
                        .userId(i.getUser().getId())
                        .fullName(i.getUser().getFullName())
                        .employeeCode(i.getUser().getEmployeeCode())
                        .orgUnitName(i.getOrgUnit() != null ? i.getOrgUnit().getName() : null)
                        .rank(i.getRank())
                        .orderIndex(i.getOrderIndex())
                        .metricValue(i.getMetricValue())
                        .points(i.getPoints())
                        .build())
                .toList();
    }

    private RewardProgramRunResponse toResponse(RewardProgramRun run,
                                                List<RewardProgramRunResponse.Item> items,
                                                List<RewardProgramRunResponse.Skipped> skipped) {
        return RewardProgramRunResponse.builder()
                .id(run.getId())
                .programId(run.getProgram().getId())
                .programName(run.getProgram().getName())
                .tiers(programService.readTiers(run.getTiers(), run.getProgram()))
                .kpiPeriodId(run.getKpiPeriod() != null ? run.getKpiPeriod().getId() : null)
                .kpiCycleId(run.getKpiCycle() != null ? run.getKpiCycle().getId() : null)
                .targetName(run.getKpiCycle() != null
                        ? run.getKpiCycle().getName()
                        : (run.getKpiPeriod() != null ? run.getKpiPeriod().getName() : null))
                .status(run.getStatus())
                .totalPoints(run.getTotalPoints())
                .recipientCount(run.getRecipientCount())
                .executedByUserId(run.getExecutedBy() != null ? run.getExecutedBy().getId() : null)
                .executedByName(run.getExecutedBy() != null ? run.getExecutedBy().getFullName() : null)
                .executedAt(run.getExecutedAt())
                .revertedAt(run.getRevertedAt())
                .createdAt(run.getCreatedAt())
                .items(items)
                .skipped(skipped)
                .build();
    }
}
