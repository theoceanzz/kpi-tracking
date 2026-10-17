package com.kpitracking.ai.personal;


import com.kpitracking.ai.conduct.ConductTool;
import com.kpitracking.ai.evaluation.CycleEvaluationTool;
import com.kpitracking.ai.org.OrgUnitStatisticToolRequests;
import com.kpitracking.ai.core.tool.ToolSupport;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.evaluation.EvaluationScorePreview;
import com.kpitracking.dto.response.kpi.KpiCriteriaResponse;
import com.kpitracking.dto.response.reward.RewardGrantResponse;
import com.kpitracking.dto.response.stats.KpiTaskResponse;
import com.kpitracking.dto.response.stats.MyKpiProgressResponse;
import com.kpitracking.dto.response.submission.SubmissionResponse;
import com.kpitracking.entity.kpi.KpiPeriod;
import com.kpitracking.entity.reward.RewardWallet;
import com.kpitracking.enums.submission.SubmissionStatus;
import com.kpitracking.repository.kpi.KpiPeriodRepository;
import com.kpitracking.service.conduct.ConductService;
import com.kpitracking.service.evaluation.EvaluationService;
import com.kpitracking.service.kpi.KpiCriteriaService;
import com.kpitracking.service.submission.KpiSubmissionService;
import com.kpitracking.service.reward.RewardWalletService;
import com.kpitracking.service.analytics.StatsService;
import com.kpitracking.service.reward.RewardGrantService;
import com.kpitracking.ai.org.OrgUnitStatisticToolRequests.PersonalRequest;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.invocation.InvocationParameters;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Nhóm tool CÁ NHÂN — dành cho NHÂN VIÊN (không phải trưởng/phó đơn vị nào).
 *
 * <p>Nguyên tắc duy nhất: mọi tool ở đây chỉ trả dữ liệu của CHÍNH người đăng nhập. Không tool nào
 * nhận tên đơn vị hay tên người khác — không phải vì kiểm rồi từ chối, mà vì tham số đó không tồn
 * tại: model không thể hỏi hộ ai. Các dịch vụ bên dưới đều là bản "của tôi" mà REST đã dùng
 * ({@code getMyKpi}, {@code getMySubmissions}, {@code getScorePreview(userId=null)},
 * {@code getSheet(userId=null)}, {@code searchMyAwards}) — cùng phạm vi với màn hình của nhân viên.
 *
 * <p>Gộp năm tool vào một bean được vì đây là tool ĐỌC: cấp phát theo nhóm PERSONAL, không theo
 * từng quyền như tool ghi. Hai tool theo cờ tổ chức (hạnh kiểm, thưởng) bị {@code KeyGoToolProvider}
 * bỏ ra theo tên khi tổ chức tắt tính năng.
 */
@Component
@RequiredArgsConstructor
public class PersonalTool {

    private final KpiCriteriaService kpiCriteriaService;
    private final KpiSubmissionService submissionService;
    private final StatsService statsService;
    private final EvaluationService evaluationService;
    private final ConductService conductService;
    private final RewardGrantService rewardGrantService;
    private final RewardWalletService rewardWalletService;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final CycleEvaluationTool cycleEvaluationTool;
    private final ToolSupport support;
    private final com.kpitracking.service.feedback360.F360ReportService f360ReportService;

    @Tool(name = "get_my_kpis", value = "Các chỉ tiêu KPI CỦA TÔI (người đang hỏi): tên, kỳ, mục tiêu, trọng số, "
            + "hạn nộp, tiến độ, trạng thái nộp/duyệt. periodName để xem một kỳ; bỏ trống = mọi kỳ, mới nhất trước. "
            + "Dùng cho 'KPI của tôi', 'tôi được giao gì', 'tôi còn phải nộp gì'.")
    public String getMyKpis(PersonalRequest request, InvocationParameters context) {
        try {
            UUID periodId = support.resolvePeriodId(request.periodName(), context);
            PageResponse<KpiCriteriaResponse> page = kpiCriteriaService.getMyKpi(0, 50, periodId, null, null,
                    "createdAt", "desc", null, null);
            MyKpiProgressResponse progress = statsService.getMyKpiProgress(0, 50);
            Map<UUID, KpiTaskResponse> tasks = new LinkedHashMap<>();
            if (progress != null && progress.getTasks() != null && progress.getTasks().getContent() != null) {
                for (KpiTaskResponse t : progress.getTasks().getContent()) tasks.put(t.getId(), t);
            }
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("period", ToolSupport.notBlank(request.periodName()) ? request.periodName().trim() : "mọi kỳ");
            out.put("count", page.getContent().size());
            out.put("kpis", page.getContent().stream().map(k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("name", k.getName());
                m.put("periodName", k.getKpiPeriod() != null ? k.getKpiPeriod().getName() : null);
                m.put("targetValue", k.getTargetValue());
                m.put("unit", k.getUnit());
                m.put("weight", k.getWeight());
                m.put("status", k.getStatus() != null ? k.getStatus().name() : null);
                KpiTaskResponse t = tasks.get(k.getId());
                if (t != null) {
                    m.put("submissionStatus", t.getStatus());
                    m.put("deadline", t.getDeadline() != null ? t.getDeadline().toString() : null);
                    m.put("submissionCount", t.getSubmissionCount());
                    m.put("expectedSubmissions", t.getExpectedSubmissions());
                    m.put("managerScore", t.getManagerScore());
                }
                return m;
            }).toList());
            if (progress != null) {
                out.put("summary", Map.of(
                        "totalAssignedKpi", progress.getTotalAssignedKpi(),
                        "pendingTaskCount", progress.getPendingTaskCount(),
                        "lateSubmissions", progress.getLateSubmissions(),
                        "averageScore", progress.getAverageScore() == null ? 0 : progress.getAverageScore()));
            }
            if (page.getContent().isEmpty()) out.put("message", "Bạn chưa được giao chỉ tiêu nào trong phạm vi này.");
            return support.respond(context, "get_my_kpis", out);
        } catch (Exception e) {
            return support.toolError("get_my_kpis", e);
        }
    }

    @Tool(name = "get_my_submissions", value = "Các BÀI NỘP CỦA TÔI: KPI, kỳ, giá trị đạt, trạng thái (chờ duyệt / đã duyệt / "
            + "bị từ chối) và LÝ DO từ chối nếu có. status=PENDING|APPROVED|REJECTED để lọc; periodName để xem một kỳ. "
            + "Dùng cho 'bài nộp của tôi bị từ chối vì sao', 'tôi đã nộp gì'.")
    public String getMySubmissions(PersonalRequest request, InvocationParameters context) {
        try {
            SubmissionStatus status = statusOf(request.status());
            UUID periodId = support.resolvePeriodId(request.periodName(), context);
            PageResponse<SubmissionResponse> page = submissionService.getMySubmissions(0, 50, status, periodId, "createdAt", "desc");
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("count", page.getContent().size());
            out.put("submissions", page.getContent().stream().map(s -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("kpiName", s.getKpiCriteriaName());
                m.put("periodName", s.getKpiPeriod() != null ? s.getKpiPeriod().getName() : null);
                m.put("actualValue", s.getActualValue());
                m.put("targetValue", s.getTargetValue());
                m.put("qualitativeLevel", s.getQualitativeLevelName());
                m.put("status", s.getStatus() != null ? s.getStatus().name() : null);
                m.put("reviewNote", s.getReviewNote());
                m.put("reviewedBy", s.getReviewedByName());
                m.put("managerScore", s.getManagerScore());
                return m;
            }).toList());
            if (page.getContent().isEmpty()) out.put("message", "Bạn chưa có bài nộp nào khớp yêu cầu.");
            return support.respond(context, "get_my_submissions", out);
        } catch (Exception e) {
            return support.toolError("get_my_submissions", e);
        }
    }

    @Tool(name = "get_my_score", value = "ĐIỂM DỰ KIẾN CỦA TÔI trong một kỳ: điểm hệ thống (từ KPI định lượng), điểm hành vi, "
            + "% hoàn thành KPI, xếp loại ma trận, điểm thưởng, điểm chính thức nếu đã chốt. periodName bỏ trống = kỳ đang diễn ra/gần nhất. "
            + "Dùng cho 'kỳ này tôi được bao nhiêu điểm', 'tôi xếp loại gì'.")
    public String getMyScore(PersonalRequest request, InvocationParameters context) {
        try {
            KpiPeriod period = resolvePeriod(request.periodName(), context);
            if (period == null) {
                return support.respond(context, "get_my_score", Map.of("message", "Không xác định được kỳ KPI để tính điểm."));
            }
            EvaluationScorePreview p = evaluationService.getScorePreview(period.getId(), null);
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("periodName", period.getName());
            out.put("systemScore", p.getSystemScore());
            out.put("maxAllowedScore", p.getMaxAllowedScore());
            out.put("kpiCompletionPercent", p.getKpiCompletionPercent());
            out.put("behaviorScore", p.getBehaviorScore());
            out.put("bonusScore", p.getBonusScore());
            out.put("matrixRating", p.getMatrixRating());
            out.put("bscScore", p.getBscScore());
            out.put("officialScore", p.getOfficialScore());
            out.put("note", p.getOfficialScore() == null
                    ? "Điểm DỰ KIẾN, tính từ dữ liệu hiện có; điểm chính thức chỉ có sau khi quản lý chốt đợt."
                    : "Đã có điểm chính thức (officialScore).");
            return support.respond(context, "get_my_score", out);
        } catch (Exception e) {
            return support.toolError("get_my_score", e);
        }
    }

    @Tool(name = "get_my_conduct", value = "PHIẾU KPI HÀNH VI (hạnh kiểm) CỦA TÔI: từng tiêu chí, điểm tự chấm, điểm quản lý chấm, "
            + "nhận xét, trạng thái (chưa tự chấm / chờ quản lý / đã chấm). periodName = theo kỳ; bỏ trống = đợt đánh giá gần nhất.")
    public String getMyConduct(PersonalRequest request, InvocationParameters context) {
        try {
            ConductTool.Target t;
            if (ToolSupport.notBlank(request.periodName())) {
                UUID periodId = support.resolvePeriodId(request.periodName(), context);
                if (periodId == null) throw new IllegalArgumentException("Không tìm thấy kỳ '" + request.periodName().trim() + "'.");
                t = new ConductTool.Target(com.kpitracking.enums.conduct.ConductScope.PERIOD, periodId, null, "kỳ " + request.periodName().trim());
            } else {
                var cycle = cycleEvaluationTool.resolveCycle(null, support.getOrgId(context));
                if (cycle == null) {
                    return support.respond(context, "get_my_conduct", Map.of("message", "Tổ chức chưa có đợt đánh giá nào."));
                }
                t = new ConductTool.Target(com.kpitracking.enums.conduct.ConductScope.CYCLE, null, cycle.getId(), "đợt " + cycle.getName());
            }
            var sheet = conductService.getSheet(null, t.scope(), t.periodId(), t.cycleId());
            return support.respond(context, "get_my_conduct", Map.of("target", t.label(), "sheet", sheet));
        } catch (Exception e) {
            return support.toolError("get_my_conduct", e);
        }
    }

    /**
     * Báo cáo 360 đã CÔNG BỐ của chính người hỏi. Đi qua đúng hai hàm REST của màn "Của tôi"
     * ({@code myReports}, {@code getReport}) — {@code getReport} tự chặn báo cáo chưa công bố, nên
     * trợ lý không đọc sớm được thứ màn hình chưa cho xem. Chỉ trả điểm và tóm tắt, KHÔNG trả nguyên
     * văn nhận xét: model không cần chúng để trả lời, và nhắc lại nguyên văn dễ lộ giọng người viết.
     */
    @Tool(name = "get_my_feedback360", value = "BÁO CÁO ĐÁNH GIÁ 360 CỦA TÔI (đã công bố): điểm người khác đánh giá, "
            + "tự đánh giá, từng năng lực, điểm mù (tự đánh giá cao hơn người khác thấy), thế mạnh ẩn, câu được đánh giá "
            + "cao nhất/thấp nhất và tóm tắt nhận xét. Lấy báo cáo mới nhất; nêu periodName = tên chiến dịch để chọn chiến dịch khác.")
    public String getMyFeedback360(PersonalRequest request, InvocationParameters context) {
        try {
            var reports = f360ReportService.myReports();
            if (reports.isEmpty()) {
                return support.respond(context, "get_my_feedback360",
                        Map.of("message", "Bạn chưa có báo cáo đánh giá 360 nào được công bố."));
            }
            var chosen = reports.get(0);
            if (ToolSupport.notBlank(request.periodName())) {
                String q = request.periodName().trim().toLowerCase(Locale.ROOT);
                chosen = reports.stream().filter(r -> r.getCampaignName().toLowerCase(Locale.ROOT).contains(q))
                        .findFirst().orElse(chosen);
            }
            var report = f360ReportService.getReport(chosen.getSubjectId());
            var r = report.getResult();
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("campaign", report.getCampaignName());
            out.put("otherCampaigns", reports.stream().map(x -> x.getCampaignName()).toList());
            if (r != null) {
                out.put("scale", "1-" + r.getScaleMax());
                out.put("othersScore", r.getOthersScore());
                out.put("selfScore", r.getSelfScore());
                out.put("responseCount", r.getResponseCount());
                out.put("insufficient", r.getInsufficient());
                out.put("competencies", r.getCompetencies().stream().map(c -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", c.getName());
                    m.put("others", c.getOthers());
                    m.put("self", c.getSelf());
                    m.put("divergentOpinions", c.getDivergent());
                    return m;
                }).toList());
                out.put("blindSpots", r.getBlindSpots().stream().map(g -> g.getName()).toList());
                out.put("hiddenStrengths", r.getHiddenStrengths().stream().map(g -> g.getName()).toList());
                out.put("topItems", r.getTop().stream().map(h -> h.getText()).toList());
                out.put("bottomItems", r.getBottom().stream().map(h -> h.getText()).toList());
            }
            if (report.getAiSummary() != null) out.put("commentSummary", report.getAiSummary());
            out.put("note", "Điểm đã qua ngưỡng ẩn danh; không có thông tin ai chấm gì.");
            return support.respond(context, "get_my_feedback360", out);
        } catch (Exception e) {
            return support.toolError("get_my_feedback360", e);
        }
    }

    @Tool(name = "get_my_todo", value = "VIỆC CẦN LÀM CỦA TÔI (nhân viên) — dùng cho 'hôm nay tôi cần làm gì', 'tôi còn việc gì', "
            + "'việc của tôi', 'tôi phải nộp gì'. Gom một lần: chỉ tiêu QUÁ HẠN chưa nộp, chỉ tiêu cần nộp (hạn gần nhất trước), "
            + "bài bị TRẢ LẠI cần nộp lại (lý do + hạn nộp lại), bài bị TỪ CHỐI cần sửa (lý do), bài đang chờ quản lý duyệt.")
    public String getMyTodo(PersonalRequest request, InvocationParameters context) {
        try {
            MyKpiProgressResponse progress = statsService.getMyKpiProgress(0, 200);
            List<KpiTaskResponse> tasks = progress == null || progress.getTasks() == null
                    || progress.getTasks().getContent() == null ? List.of() : progress.getTasks().getContent();
            List<SubmissionResponse> returned = submissionService.getMySubmissions(0, 100, SubmissionStatus.RETURNED, null,
                    "createdAt", "desc").getContent();
            List<SubmissionResponse> rejected = submissionService.getMySubmissions(0, 100, SubmissionStatus.REJECTED, null,
                    "createdAt", "desc").getContent();
            return support.respond(context, "get_my_todo", todoOf(tasks, returned, rejected, Instant.now()));
        } catch (Exception e) {
            return support.toolError("get_my_todo", e);
        }
    }

    /**
     * Danh sách việc của nhân viên từ đúng dữ liệu của trang "Việc cần làm" ({@code getMyKpiProgress}) cộng bài bị trả
     * lại. Chỉ tiêu có bài bị trả lại đang chờ nộp lại chỉ nằm ở mục "nộp lại", không lặp ở "cần nộp". Kỳ chưa mở
     * không tính.
     */
    static Map<String, Object> todoOf(List<KpiTaskResponse> tasks, List<SubmissionResponse> returned,
                                      List<SubmissionResponse> rejected, Instant now) {
        List<SubmissionResponse> toResubmit = returned.stream().filter(SubmissionResponse::isAwaitingResubmission).toList();
        java.util.Set<UUID> resubmitKpis = new java.util.HashSet<>();
        toResubmit.forEach(s -> resubmitKpis.add(s.getKpiCriteriaId()));
        Map<UUID, String> rejectReason = new LinkedHashMap<>();
        rejected.forEach(s -> rejectReason.putIfAbsent(s.getKpiCriteriaId(), s.getReviewNote()));

        List<KpiTaskResponse> open = tasks.stream()
                .filter(t -> t.getStartDate() == null || !t.getStartDate().isAfter(now))
                .filter(t -> !resubmitKpis.contains(t.getId()))
                .sorted(Comparator.comparing(KpiTaskResponse::getDeadline, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        List<Map<String, Object>> overdue = open.stream().filter(t -> "OVERDUE".equals(t.getStatus())).map(PersonalTool::taskRow).toList();
        List<Map<String, Object>> toSubmit = open.stream().filter(t -> "NOT_STARTED".equals(t.getStatus())).map(PersonalTool::taskRow).toList();
        List<Map<String, Object>> toFix = open.stream().filter(t -> "REJECTED".equals(t.getStatus())).map(t -> {
            Map<String, Object> m = taskRow(t);
            m.put("reason", rejectReason.get(t.getId()));
            return m;
        }).toList();
        List<Map<String, Object>> waiting = open.stream().filter(t -> "PENDING".equals(t.getStatus())).map(PersonalTool::taskRow).toList();
        List<Map<String, Object>> resubmit = toResubmit.stream().map(s -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("kpiName", s.getKpiCriteriaName());
            m.put("periodName", s.getKpiPeriod() != null ? s.getKpiPeriod().getName() : null);
            m.put("returnReason", s.getReturnReason());
            m.put("resubmitDeadline", s.getResubmitDeadline() != null ? s.getResubmitDeadline().toString() : null);
            m.put("returnedBy", s.getReturnedByName());
            return m;
        }).toList();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("today", now.toString());
        out.put("overdue", overdue);
        out.put("resubmit", resubmit);
        out.put("toFix", toFix);
        out.put("toSubmit", toSubmit);
        out.put("waitingReview", waiting);
        int todo = overdue.size() + resubmit.size() + toFix.size() + toSubmit.size();
        out.put("todoCount", todo);
        if (todo == 0) {
            out.put("message", waiting.isEmpty()
                    ? "Bạn không còn việc nào phải làm: không có chỉ tiêu cần nộp, bài bị trả lại hay bị từ chối."
                    : "Bạn đã nộp đủ; chỉ còn bài đang chờ quản lý duyệt.");
        }
        return out;
    }

    private static Map<String, Object> taskRow(KpiTaskResponse t) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("kpiName", t.getName());
        m.put("periodName", t.getPeriodName());
        m.put("deadline", t.getDeadline() != null ? t.getDeadline().toString() : null);
        if (t.getExpectedSubmissions() != null && t.getExpectedSubmissions() > 1) {
            m.put("submitted", t.getSubmissionCount());
            m.put("expected", t.getExpectedSubmissions());
        }
        return m;
    }

    @Tool(name = "get_my_rewards", value = "THƯỞNG ĐIỂM CỦA TÔI: số dư ví điểm và các lần được thưởng (ai thưởng, bao nhiêu, lý do, khi nào).")
    public String getMyRewards(PersonalRequest request, InvocationParameters context) {
        try {
            Object rawUser = context.get("userId");
            UUID me = rawUser == null ? null : UUID.fromString(rawUser.toString());
            PageResponse<RewardGrantResponse> page = rewardGrantService.searchMyAwards(0, 30);
            Map<String, Object> out = new LinkedHashMap<>();
            if (me != null) {
                RewardWallet wallet = rewardWalletService.getWalletOrEmpty(support.getOrgId(context), me);
                out.put("walletBalance", wallet != null ? wallet.getBalance() : 0);
            }
            out.put("awardCount", page.getContent().size());
            out.put("awards", page.getContent().stream().map(g -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("grantorName", g.getGrantorName());
                m.put("points", g.getPointsPerRecipient());
                m.put("reason", g.getReason());
                m.put("createdAt", g.getCreatedAt() != null ? g.getCreatedAt().toString() : null);
                return m;
            }).toList());
            if (page.getContent().isEmpty()) out.put("message", "Bạn chưa được thưởng điểm lần nào.");
            return support.respond(context, "get_my_rewards", out);
        } catch (Exception e) {
            return support.toolError("get_my_rewards", e);
        }
    }

    /** Kỳ theo tên; không nêu tên thì kỳ đang diễn ra, không có thì kỳ gần nhất. */
    private KpiPeriod resolvePeriod(String periodName, InvocationParameters context) {
        UUID orgId = support.getOrgId(context);
        if (ToolSupport.notBlank(periodName)) {
            UUID id = support.resolvePeriodId(periodName, context);
            return id == null ? null : kpiPeriodRepository.findById(id).orElse(null);
        }
        List<KpiPeriod> periods = kpiPeriodRepository.findByOrganizationId(orgId);
        Instant now = Instant.now();
        return periods.stream()
                .filter(p -> p.getStartDate() != null && p.getEndDate() != null && !now.isBefore(p.getStartDate()) && !now.isAfter(p.getEndDate()))
                .findFirst()
                .orElseGet(() -> periods.stream()
                        .filter(p -> p.getStartDate() != null)
                        .max(Comparator.comparing(KpiPeriod::getStartDate)).orElse(null));
    }

    private static SubmissionStatus statusOf(String raw) {
        if (!ToolSupport.notBlank(raw)) return null;
        String s = raw.trim().toUpperCase(Locale.ROOT);
        for (SubmissionStatus v : SubmissionStatus.values()) if (v.name().equals(s)) return v;
        throw new IllegalArgumentException("status không hợp lệ: '" + raw + "'. Chỉ nhận: "
                + java.util.Arrays.stream(SubmissionStatus.values()).map(Enum::name).toList());
    }
}
