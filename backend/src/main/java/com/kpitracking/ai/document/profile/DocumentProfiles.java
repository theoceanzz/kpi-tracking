package com.kpitracking.ai.document.profile;

import com.kpitracking.ai.document.model.ParsedDocument;
import com.kpitracking.ai.document.section.HeadingSectioning;
import com.kpitracking.ai.document.section.LegalStructureSectioning;
import com.kpitracking.ai.document.section.SectioningStrategy;
import com.kpitracking.ai.document.section.SheetSectioning;
import com.kpitracking.ai.document.section.SizeSectioning;
import org.springframework.stereotype.Component;

import java.util.List;

import static com.kpitracking.ai.document.profile.CriteriaScheme.THAM_KHAO;
import static com.kpitracking.ai.document.profile.CriteriaScheme.THANG_MUC;
import static com.kpitracking.ai.document.profile.CriteriaScheme.TIEU_CHI;
import static com.kpitracking.ai.document.profile.CriteriaScheme.TRA_CUU;

/**
 * Các loại tài liệu có sẵn. Mỗi lớp một bean — {@link DocumentProfileRegistry} gom tất cả. Lớp lồng trong một
 * tệp cho dễ nhìn; loại mới có thể là lớp riêng ở bất kỳ đâu, miễn là bean {@link DocumentProfile}.
 */
public final class DocumentProfiles {

    private DocumentProfiles() {}

    /** Bộ hướng dẫn sử dụng KeyGo (quản trị nền tảng nạp): cắt theo tiêu đề, giữ ảnh + màn hình liên quan. */
    @Component
    public static class GuideProfile implements DocumentProfile {
        public DocumentKind kind() { return DocumentKind.GUIDE; }
        public String label() { return "Hướng dẫn sử dụng KeyGo"; }
        public SectioningStrategy sectioning(ParsedDocument doc) {
            return doc.hasHeadings() ? HeadingSectioning.INSTANCE : SizeSectioning.INSTANCE;
        }
    }

    /**
     * Quy chế, quy định — văn bản tự do. Nhận ra bằng số dòng "Điều N." / "CHƯƠNG". Bóc đủ 4 vai trò, chủ đề
     * lấy theo chương (tài liệu ít chương ra ít nhóm, nhiều chương ra nhiều nhóm).
     */
    @Component
    public static class RegulationProfile implements DocumentProfile {
        public DocumentKind kind() { return DocumentKind.REGULATION; }
        public String label() { return "Quy chế, quy định"; }
        public int detect(ParsedDocument doc) {
            int markers = LegalStructureSectioning.markerCount(doc.plainText());
            if (markers >= 3) return 90;
            if (markers >= 1) return 50;
            return DocumentProfile.headMentions(doc, 600, "quy chế", "quy định", "quyết định") ? 40 : 0;
        }
        public SectioningStrategy sectioning(ParsedDocument doc) { return DocumentProfile.structural(doc); }
        public CriteriaScheme criteriaScheme() {
            return new CriteriaScheme(List.of(TIEU_CHI, THANG_MUC, THAM_KHAO, TRA_CUU), CriteriaScheme.TopicSource.CHAPTER_OR_MODEL);
        }
    }

    /** Mô tả công việc: nhiệm vụ theo vị trí / bộ phận — không có căn cứ chấm, chủ đề = tên mục (vị trí). */
    @Component
    public static class JobDescriptionProfile implements DocumentProfile {
        public DocumentKind kind() { return DocumentKind.JOB_DESCRIPTION; }
        public String label() { return "Mô tả công việc"; }
        public int detect(ParsedDocument doc) {
            return DocumentProfile.headMentions(doc, 1500, "mô tả công việc", "bản mô tả", "chức danh",
                    "yêu cầu công việc", "nhiệm vụ chính") ? 60 : 0;
        }
        public SectioningStrategy sectioning(ParsedDocument doc) { return DocumentProfile.structural(doc); }
        public CriteriaScheme criteriaScheme() {
            return new CriteriaScheme(List.of(THAM_KHAO, TRA_CUU), CriteriaScheme.TopicSource.SECTION_TITLE);
        }
    }

    /** Chiến lược, mục tiêu năm: đọc để tham khảo, chủ đề = tên mục. */
    @Component
    public static class StrategyProfile implements DocumentProfile {
        public DocumentKind kind() { return DocumentKind.STRATEGY; }
        public String label() { return "Chiến lược, mục tiêu"; }
        public int detect(ParsedDocument doc) {
            return DocumentProfile.headMentions(doc, 1500, "chiến lược", "mục tiêu năm", "bản đồ chiến lược",
                    "tầm nhìn", "sứ mệnh") ? 55 : 0;
        }
        public SectioningStrategy sectioning(ParsedDocument doc) { return DocumentProfile.structural(doc); }
        public CriteriaScheme criteriaScheme() {
            return new CriteriaScheme(List.of(THAM_KHAO, TRA_CUU), CriteriaScheme.TopicSource.SECTION_TITLE);
        }
    }

    /**
     * Bảng tiêu chí / bảng KPI (Excel có cột "Trọng số" và "Chỉ tiêu"/"KPI"/"Tiêu chí"): mỗi trang tính một
     * nhóm, chỉ có căn cứ chấm và thang mức.
     */
    @Component
    public static class KpiTableProfile implements DocumentProfile {
        public DocumentKind kind() { return DocumentKind.KPI_TABLE; }
        public String label() { return "Bảng tiêu chí / KPI"; }
        public int detect(ParsedDocument doc) {
            if (!doc.format().startsWith("xls")) return 0;
            String t = doc.plainText().toLowerCase();
            boolean weight = t.contains("trọng số") || t.contains("tỷ trọng") || t.contains("weight");
            boolean criteria = t.contains("chỉ tiêu") || t.contains("kpi") || t.contains("tiêu chí");
            return weight && criteria ? 85 : 20;
        }
        public SectioningStrategy sectioning(ParsedDocument doc) { return SheetSectioning.INSTANCE; }
        public CriteriaScheme criteriaScheme() {
            return new CriteriaScheme(List.of(TIEU_CHI, THANG_MUC), CriteriaScheme.TopicSource.SHEET);
        }
    }

    /** Không nhận ra loại: cắt theo cấu trúc có sẵn, bóc đủ 4 vai trò. */
    @Component
    public static class GenericProfile implements DocumentProfile {
        public DocumentKind kind() { return DocumentKind.GENERIC; }
        public String label() { return "Tài liệu khác"; }
        public SectioningStrategy sectioning(ParsedDocument doc) { return DocumentProfile.structural(doc); }
        public CriteriaScheme criteriaScheme() {
            return new CriteriaScheme(List.of(TIEU_CHI, THANG_MUC, THAM_KHAO, TRA_CUU), CriteriaScheme.TopicSource.CHAPTER_OR_MODEL);
        }
    }

    /** Minh chứng bài nộp: chỉ đọc để chấm, KHÔNG nạp kho tri thức. */
    @Component
    public static class EvidenceProfile implements DocumentProfile {
        public DocumentKind kind() { return DocumentKind.EVIDENCE; }
        public String label() { return "Minh chứng bài nộp"; }
        public SectioningStrategy sectioning(ParsedDocument doc) { return SizeSectioning.INSTANCE; }
        public IndexPolicy indexPolicy() { return IndexPolicy.NO_INDEX; }
    }
}
