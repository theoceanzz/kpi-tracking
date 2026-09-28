package com.kpitracking.ai.agent;

import com.kpitracking.i18n.SupportedLanguages;

/**
 * Ngôn ngữ trả lời của trợ lý AI. Prompt gốc viết cho tiếng Việt; với ngôn ngữ khác thì chèn thêm một
 * luật ngôn ngữ (kèm thuật ngữ bắt buộc theo {@code docs/i18n/GLOSSARY.md}) để luật này thắng mọi chỗ
 * prompt ghi "tiếng Việt". Tiếng Việt thì không chèn gì — prompt giữ nguyên như đã đo.
 */
public final class AiLanguage {

    private AiLanguage() {}

    private static final String EN_RULE = """

            ## LANGUAGE (overrides every "tiếng Việt" instruction above)
            - The user's interface is in ENGLISH. Write the whole answer in English, including refusals, tables, headings and suggestions.
            - Use these terms: KPI (chỉ tiêu), cycle (kỳ), period (đợt), BSC scorecard (bộ tiêu chí BSC), item (hạng mục), unit (đơn vị), \
            unit head (trưởng đơn vị), reviewee (người được đánh giá), rater (người chấm), conduct score (hạnh kiểm), unit of measure (đơn vị tính), \
            target value (giá trị mục tiêu), weight (trọng số), submission (bài nộp), delegation (uỷ quyền), final approval (duyệt cuối).
            - Names of people, units, KPIs and other data stay exactly as stored (do not translate them).
            """;

    /** Khối chèn vào system prompt; rỗng với tiếng Việt. */
    public static String rule(String language) {
        return isEnglish(language) ? EN_RULE : "";
    }

    /** Dòng đặt đầu user message cho các agent có system prompt cố định từ resource. */
    public static String prefix(String language) {
        return isEnglish(language)
                ? "[Output language: English. Write every sentence in English; keep names from the data as they are.]\n\n"
                : "";
    }

    private static boolean isEnglish(String language) {
        return "en".equals(SupportedLanguages.toLocale(language).getLanguage());
    }
}
