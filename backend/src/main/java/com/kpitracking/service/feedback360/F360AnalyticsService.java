package com.kpitracking.service.feedback360;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.dto.response.feedback360.F360HeatmapResponse;
import com.kpitracking.dto.response.feedback360.F360ResultSnapshot;
import com.kpitracking.entity.*;
import com.kpitracking.enums.F360SubjectStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.Terms;
import com.kpitracking.repository.F360CampaignRepository;
import com.kpitracking.repository.F360SubjectRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.util.*;

/**
 * Góc nhìn tổng hợp của một chiến dịch 360: heatmap năng lực × đơn vị, trung bình đơn vị để so trong
 * báo cáo, và xuất Excel. Mọi thứ ở đây đọc từ BẢN CHỤP đã qua ngưỡng ẩn danh — không đụng câu trả
 * lời thô — và áp thêm ngưỡng k ở CẤP ĐƠN VỊ (§6.1).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class F360AnalyticsService {

    private static final int MAX_ROLLUP = 10;

    private final F360CampaignRepository campaignRepository;
    private final F360SubjectRepository subjectRepository;
    private final F360AccessPolicy access;
    private final ObjectMapper objectMapper;

    /** Một nhóm đơn vị đủ ngưỡng và các người trong đó. */
    record UnitGroup(OrgUnit unit, List<F360Subject> subjects, boolean rolledUp) {}

    @Transactional(readOnly = true)
    public F360HeatmapResponse heatmap(UUID campaignId) {
        User me = access.currentUser();
        F360Campaign c = requireCampaign(campaignId);
        access.requireEnabled(c.getOrganization());
        if (!access.canViewCampaigns(me, c.getOrganization().getId())) {
            throw new ForbiddenException(ErrorCode.NO_PERMISSION_VIEW_F360_CAMPAIGNS);
        }
        if (!c.getStatus().hasResults()) throw new BusinessException(ErrorCode.CAMPAIGN_NOT_CLOSED_NO_RESULTS);

        List<F360Subject> scoped = completed(c).stream().filter(s -> access.inManagerScope(me, s)).toList();
        List<String> competencies = competencyOrder(scoped);
        int k = c.getAnonymityThreshold();
        List<UnitGroup> groups = groupByUnit(scoped, k);
        int covered = groups.stream().mapToInt(g -> g.subjects().size()).sum();

        List<F360HeatmapResponse.Row> rows = groups.stream()
                .map(g -> F360HeatmapResponse.Row.builder()
                        .orgUnitId(g.unit() != null ? g.unit().getId() : null)
                        .orgUnitName(g.unit() != null ? g.unit().getName() : ErrorMessages.text("export.f360.wholeOrganization", ""))
                        .rolledUp(g.rolledUp())
                        .subjectCount(g.subjects().size())
                        .overall(round(avg(g.subjects().stream().map(F360Subject::getOverallScore).toList())))
                        .scores(averages(g.subjects()))
                        .build())
                .sorted(Comparator.comparing(F360HeatmapResponse.Row::getOrgUnitName))
                .toList();
        return F360HeatmapResponse.builder()
                .scaleMax(c.getScaleMax())
                .anonymityThreshold(k)
                .competencies(competencies)
                .rows(rows)
                .excludedCount(scoped.size() - covered)
                .build();
    }

    /**
     * Trung bình năng lực của NHÓM ĐƠN VỊ chứa người này (đã gộp theo ngưỡng k, tính trên toàn chiến
     * dịch). Null khi nhóm không đủ k — dùng cho mục "So với trung bình" trong báo cáo, chỉ hiện cho
     * người xem không phải chính subject.
     */
    @Transactional(readOnly = true)
    public Comparison unitComparison(F360Subject subject) {
        F360Campaign c = subject.getCampaign();
        for (UnitGroup g : groupByUnit(completed(c), c.getAnonymityThreshold())) {
            if (g.subjects().stream().anyMatch(s -> s.getId().equals(subject.getId()))) {
                return new Comparison(g.unit() != null ? g.unit().getName() : ErrorMessages.text("export.f360.wholeOrganization", ""),
                        g.subjects().size(), averagesByKey(g.subjects()),
                        round(avg(g.subjects().stream().map(F360Subject::getOverallScore).toList())));
            }
        }
        return null;
    }

    public record Comparison(String label, int subjectCount, Map<String, Double> byCompetencyKey, Double overall) {}

    /** Excel tổng hợp: một dòng mỗi người, KHÔNG có danh tính người chấm. Chỉ HR. */
    @Transactional(readOnly = true)
    public byte[] exportExcel(UUID campaignId) {
        User me = access.currentUser();
        F360Campaign c = requireCampaign(campaignId);
        access.requireManage(me, c.getOrganization());
        if (!c.getStatus().hasResults()) throw new BusinessException(ErrorCode.CAMPAIGN_NOT_CLOSED_NO_RESULTS_EXPORT);

        List<F360Subject> subjects = subjectRepository.findByCampaignIdWithUser(campaignId).stream()
                .filter(s -> !access.isSelf(me, s))
                .sorted(Comparator.comparing(s -> s.getUser().getFullName() == null ? "" : s.getUser().getFullName()))
                .toList();
        List<String> competencies = competencyOrder(subjects);

        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            CellStyle header = wb.createCellStyle();
            Font bold = wb.createFont();
            bold.setBold(true);
            header.setFont(bold);
            header.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            header.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            CellStyle num = wb.createCellStyle();
            num.setDataFormat(wb.createDataFormat().getFormat("0.00"));

            Sheet sheet = wb.createSheet(ErrorMessages.text("export.f360.sheet", ""));
            Row title = sheet.createRow(0);
            title.createCell(0).setCellValue(ErrorMessages.text("export.f360.title", "",
                    c.getName(), c.getScaleMax(), c.getAnonymityThreshold()));

            List<String> cols = new ArrayList<>(List.of(ErrorMessages.text("export.f360.col.fullName", ""), ErrorMessages.text("export.f360.col.email", ""), ErrorMessages.text("export.f360.col.unit", ""),
                    ErrorMessages.text("export.f360.col.status", ""), ErrorMessages.text("export.f360.col.responses", ""), ErrorMessages.text("export.f360.col.score", ""), ErrorMessages.text("export.f360.col.self", "")));
            cols.addAll(competencies);
            Row h = sheet.createRow(2);
            for (int i = 0; i < cols.size(); i++) {
                Cell cell = h.createCell(i);
                cell.setCellValue(cols.get(i));
                cell.setCellStyle(header);
            }
            int r = 3;
            for (F360Subject s : subjects) {
                Row row = sheet.createRow(r++);
                row.createCell(0).setCellValue(s.getUser().getFullName());
                row.createCell(1).setCellValue(s.getUser().getEmail());
                row.createCell(2).setCellValue(s.getOrgUnit() != null ? s.getOrgUnit().getName() : "");
                row.createCell(3).setCellValue(s.getStatus() == F360SubjectStatus.INSUFFICIENT ? ErrorMessages.text("export.f360.status.insufficient", "") : ErrorMessages.text("export.f360.status.hasResult", ""));
                if (s.getResponseCount() != null) row.createCell(4).setCellValue(s.getResponseCount());
                setNum(row, 5, s.getOverallScore(), num);
                setNum(row, 6, s.getSelfScore(), num);
                Map<String, Double> byName = othersByName(s);
                for (int i = 0; i < competencies.size(); i++) setNum(row, 7 + i, byName.get(competencies.get(i)), num);
            }
            for (int i = 0; i < cols.size(); i++) sheet.autoSizeColumn(i);
            wb.write(out);
            return out.toByteArray();
        } catch (java.io.IOException e) {
            throw new IllegalStateException("Không tạo được file Excel", e);
        }
    }

    public String exportFileName(UUID campaignId) {
        String name = requireCampaign(campaignId).getName().replaceAll("[\\\\/:*?\"<>|]", "_");
        return "Danh-gia-360_" + name + ".xlsx";
    }

    // ============================================================
    // NỘI BỘ
    // ============================================================

    private List<F360Subject> completed(F360Campaign c) {
        return subjectRepository.findByCampaignIdWithUser(c.getId()).stream()
                .filter(s -> s.getStatus() == F360SubjectStatus.COMPLETED && s.getResultSnapshot() != null)
                .toList();
    }

    /**
     * Gộp người theo đơn vị, rồi đẩy nhóm dưới ngưỡng lên đơn vị cha (nhiều lần nếu cần), sâu trước.
     * Nhóm vẫn dưới ngưỡng ở gốc thì bị bỏ.
     */
    List<UnitGroup> groupByUnit(List<F360Subject> subjects, int k) {
        Map<UUID, OrgUnit> units = new HashMap<>();
        Map<UUID, List<F360Subject>> byUnit = new LinkedHashMap<>();
        Map<UUID, Boolean> rolled = new HashMap<>();
        UUID none = new UUID(0, 0);
        for (F360Subject s : subjects) {
            OrgUnit u = s.getOrgUnit();
            UUID id = u != null ? u.getId() : none;
            if (u != null) units.put(id, u);
            byUnit.computeIfAbsent(id, x -> new ArrayList<>()).add(s);
        }
        for (int round = 0; round < MAX_ROLLUP; round++) {
            boolean moved = false;
            // Đơn vị sâu nhất trước, để con gộp vào cha rồi cha mới xét tiếp.
            List<UUID> order = new ArrayList<>(byUnit.keySet());
            order.sort(Comparator.comparingInt((UUID id) -> depth(units.get(id))).reversed());
            for (UUID id : order) {
                List<F360Subject> list = byUnit.get(id);
                if (list == null || list.size() >= k) continue;
                OrgUnit parent = units.get(id) != null ? units.get(id).getParent() : null;
                if (parent == null) continue;
                units.put(parent.getId(), parent);
                byUnit.remove(id);
                byUnit.computeIfAbsent(parent.getId(), x -> new ArrayList<>()).addAll(list);
                rolled.put(parent.getId(), true);
                moved = true;
            }
            if (!moved) break;
        }
        List<UnitGroup> out = new ArrayList<>();
        byUnit.forEach((id, list) -> {
            if (list.size() >= k) out.add(new UnitGroup(units.get(id), list, rolled.getOrDefault(id, false)));
        });
        return out;
    }

    private static int depth(OrgUnit u) {
        return u == null || u.getPath() == null ? 0 : u.getPath().split("/").length;
    }

    private List<String> competencyOrder(List<F360Subject> subjects) {
        for (F360Subject s : subjects) {
            F360ResultSnapshot r = read(s);
            if (r != null && !r.getCompetencies().isEmpty()) {
                return r.getCompetencies().stream()
                        .sorted(Comparator.comparing(x -> x.getPosition() == null ? 0 : x.getPosition()))
                        .map(F360ResultSnapshot.CompetencyScore::getName).toList();
            }
        }
        return List.of();
    }

    private Map<String, Double> averages(List<F360Subject> subjects) {
        Map<String, List<Double>> acc = new LinkedHashMap<>();
        for (F360Subject s : subjects) othersByName(s).forEach((k, v) -> acc.computeIfAbsent(k, x -> new ArrayList<>()).add(v));
        Map<String, Double> out = new LinkedHashMap<>();
        acc.forEach((k, v) -> out.put(k, round(avg(v))));
        return out;
    }

    private Map<String, Double> averagesByKey(List<F360Subject> subjects) {
        Map<String, List<Double>> acc = new LinkedHashMap<>();
        for (F360Subject s : subjects) {
            F360ResultSnapshot r = read(s);
            if (r == null) continue;
            for (F360ResultSnapshot.CompetencyScore cs : r.getCompetencies()) {
                if (cs.getOthers() != null && cs.getKey() != null) {
                    acc.computeIfAbsent(cs.getKey().toString(), x -> new ArrayList<>()).add(cs.getOthers());
                }
            }
        }
        Map<String, Double> out = new LinkedHashMap<>();
        acc.forEach((k, v) -> out.put(k, round(avg(v))));
        return out;
    }

    private Map<String, Double> othersByName(F360Subject s) {
        Map<String, Double> out = new LinkedHashMap<>();
        F360ResultSnapshot r = read(s);
        if (r == null) return out;
        for (F360ResultSnapshot.CompetencyScore cs : r.getCompetencies()) {
            if (cs.getOthers() != null) out.put(cs.getName(), cs.getOthers());
        }
        return out;
    }

    private F360ResultSnapshot read(F360Subject s) {
        if (s.getResultSnapshot() == null) return null;
        try {
            return objectMapper.readValue(s.getResultSnapshot(), F360ResultSnapshot.class);
        } catch (Exception e) {
            return null;
        }
    }

    private static void setNum(Row row, int col, Double v, CellStyle style) {
        if (v == null) return;
        Cell cell = row.createCell(col);
        cell.setCellValue(v);
        cell.setCellStyle(style);
    }

    private static Double avg(List<Double> xs) {
        List<Double> vals = xs.stream().filter(Objects::nonNull).toList();
        return vals.isEmpty() ? null : vals.stream().mapToDouble(Double::doubleValue).average().orElse(0);
    }

    private static Double round(Double v) {
        return v == null ? null : Math.round(v * 100.0) / 100.0;
    }

    private F360Campaign requireCampaign(UUID id) {
        return campaignRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.f360Campaign"), "id", id));
    }
}
