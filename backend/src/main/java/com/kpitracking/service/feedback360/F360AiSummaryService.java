package com.kpitracking.service.feedback360;

import com.kpitracking.ai.agent.Feedback360SummaryAgent;
import com.kpitracking.entity.AiTokenUsage;
import com.kpitracking.entity.F360Campaign;
import com.kpitracking.entity.F360Subject;
import com.kpitracking.repository.F360CampaignRepository;
import com.kpitracking.repository.F360SubjectRepository;
import com.kpitracking.service.AiTokenUsageRecorder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Tóm tắt nhận xét báo cáo 360 bằng AI (§9.5).
 *
 * <ul>
 *   <li>Chỉ chạy khi tổ chức bật AI, chiến dịch bật tóm tắt, và số nhận xét hiển thị ≥ k — ít hơn
 *       thì một bản tóm tắt dễ để lộ giọng văn của từng người.</li>
 *   <li>Đầu vào đúng bằng nhận xét báo cáo đang hiện: nhận xét bị ẩn hoặc của nhóm dưới ngưỡng
 *       không bao giờ tới model.</li>
 *   <li>Lỗi AI không làm hỏng việc gì khác: bản tóm tắt để trống, HR bấm "Tạo lại" được.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class F360AiSummaryService {

    /** Chặn trên độ dài đầu vào — báo cáo lớn không được đẩy chi phí AI lên vô hạn. */
    private static final int MAX_INPUT_CHARS = 8000;

    private final F360CampaignRepository campaignRepository;
    private final F360SubjectRepository subjectRepository;
    private final F360ReportService reportService;
    private final Feedback360SummaryAgent agent;

    /** Tóm tắt cho cả chiến dịch ({@code subjectId} null) hoặc một người. */
    @Transactional
    public void generate(UUID campaignId, UUID subjectId) {
        F360Campaign c = campaignRepository.findById(campaignId).orElse(null);
        if (c == null || !enabled(c)) return;
        List<F360Subject> targets = subjectId != null
                ? subjectRepository.findById(subjectId).stream().toList()
                : subjectRepository.findByCampaignIdWithUser(campaignId);
        for (F360Subject s : targets) {
            try {
                s.setAiSummary(summarize(c, s));
                subjectRepository.save(s);
            } catch (Exception e) {
                // Không log nội dung nhận xét (audit bảo mật 09/2026) — chỉ lớp lỗi.
                log.warn("Không tạo được tóm tắt 360 cho subject {}: {}", s.getId(), e.getClass().getSimpleName());
            }
        }
    }

    static boolean enabled(F360Campaign c) {
        return c.getStatus().hasResults()
                && Boolean.TRUE.equals(c.getOrganization().getEnableAi())
                && Boolean.TRUE.equals(c.getOrganization().getEnableFeedback360())
                && F360Settings.reportSettings(c).aiSummary();
    }

    private String summarize(F360Campaign c, F360Subject s) {
        List<String> comments = reportService.visibleCommentsForSummary(s);
        if (comments.size() < c.getAnonymityThreshold()) return null;
        StringBuilder in = new StringBuilder();
        for (String line : comments) {
            if (in.length() + line.length() > MAX_INPUT_CHARS) break;
            in.append("- ").append(line.replace('\n', ' ')).append('\n');
        }
        AiTokenUsage.AiFeature previous = AiTokenUsageRecorder.currentFeature();
        AiTokenUsageRecorder.setFeature(AiTokenUsage.AiFeature.FEEDBACK360);
        try {
            // Bản tóm tắt lưu lại cho cả HR lẫn người được đánh giá đọc: viết theo ngôn ngữ mặc định của tổ chức.
            String out = agent.summarize(com.kpitracking.ai.agent.AiLanguage.prefix(c.getOrganization().getDefaultLanguage()) + in);
            if (out == null || out.isBlank()) return null;
            // Model đôi khi vẫn trả Markdown dù đã dặn; báo cáo hiển thị văn bản thuần.
            return out.replace("**", "").replaceAll("(?m)^#+\s*", "").trim();
        } finally {
            if (previous != null) AiTokenUsageRecorder.setFeature(previous);
            else AiTokenUsageRecorder.clearFeature();
        }
    }
}
