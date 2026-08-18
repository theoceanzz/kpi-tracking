package com.kpitracking.service.kpi;

import com.kpitracking.dto.response.kpi.CycleUserEvaluationResponse;
import com.kpitracking.dto.response.kpi.CycleUserEvaluationResponse.PeriodBreakdown;
import com.kpitracking.enums.CycleEvaluationMode;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * Xuất kết quả đánh giá kỳ của MỘT nhân viên ra tệp Excel, để đính kèm email gửi cho họ.
 *
 * <p>Nhân viên không có quyền vào màn hình đánh giá kỳ, nên đường dẫn "xem chi tiết trên
 * hệ thống" trong email là ngõ cụt với họ. Tệp đính kèm là bản chi tiết duy nhất họ thực
 * sự mở được, vì vậy nó phải đủ để đọc độc lập: thông tin kỳ, điểm tổng hợp, nhận xét và
 * bảng điểm từng đợt.
 *
 * <p>Nội dung bám theo bản xuất Excel của màn hình quản lý ({@code cycleEvaluationExport.ts})
 * để hai bên nhìn thấy cùng một tờ giấy khi đối chiếu với nhau.
 */
public final class CycleEvaluationExcelWriter {

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private CycleEvaluationExcelWriter() {}

    /**
     * @param scoreLabel nhãn xếp loại của điểm chốt, do nơi gọi tính theo thang điểm của
     *                   tổ chức — lớp này không truy cập DB.
     */
    public static byte[] build(CycleUserEvaluationResponse eval, String cycleName, String unitName,
                               double maxScore, String scoreLabel) {
        boolean isQual = eval.getMode() == CycleEvaluationMode.QUALITATIVE;
        // Chỉ chế độ "Cả hai" mới tách được hai trục định lượng/định tính theo từng đợt.
        boolean showDimensions = eval.getMode() == CycleEvaluationMode.BOTH;
        int lastCol = showDimensions ? 6 : 3;

        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("Chi tiết cá nhân");
            Styles styles = new Styles(wb);
            int r = 0;

            // Tiêu đề
            Row title = sheet.createRow(r);
            Cell titleCell = title.createCell(0);
            titleCell.setCellValue("CHI TIẾT ĐÁNH GIÁ KỲ — "
                    + (eval.getUserName() == null ? "" : eval.getUserName().toUpperCase()));
            titleCell.setCellStyle(styles.title);
            title.setHeightInPoints(26);
            sheet.addMergedRegion(new CellRangeAddress(r, r, 0, lastCol));
            r++;

            // Thông tin tổng hợp
            for (String[] line : infoLines(eval, cycleName, unitName, maxScore, scoreLabel, isQual)) {
                Row row = sheet.createRow(r);
                Cell label = row.createCell(0);
                label.setCellValue(line[0]);
                label.setCellStyle(styles.infoLabel);
                Cell value = row.createCell(1);
                value.setCellValue(line[1]);
                value.setCellStyle(styles.infoValue);
                sheet.addMergedRegion(new CellRangeAddress(r, r, 1, lastCol));
                r++;
            }

            r++; // một dòng trống ngăn khối thông tin với bảng điểm

            Row section = sheet.createRow(r);
            Cell sectionCell = section.createCell(0);
            sectionCell.setCellValue("CHI TIẾT ĐIỂM TỪNG ĐỢT TRONG KỲ");
            sectionCell.setCellStyle(styles.section);
            sheet.addMergedRegion(new CellRangeAddress(r, r, 0, lastCol));
            r++;

            List<PeriodBreakdown> rows = eval.getPeriodBreakdown();
            if (rows == null || rows.isEmpty()) {
                sheet.createRow(r).createCell(0).setCellValue("Kỳ này chưa có đợt nào được gán.");
                r++;
            } else {
                List<String> headers = new ArrayList<>();
                headers.add("Đợt");
                if (showDimensions) {
                    headers.add("Định lượng");
                    headers.add("Định tính");
                    headers.add("Xếp loại");
                }
                headers.add("% hoàn thành");
                headers.add(isQual ? "Mức tự đánh giá" : "Tự đánh giá");
                headers.add(isQual ? "Mức QLTT" : "QLTT đánh giá");

                Row headerRow = sheet.createRow(r);
                for (int i = 0; i < headers.size(); i++) {
                    Cell c = headerRow.createCell(i);
                    c.setCellValue(headers.get(i));
                    c.setCellStyle(styles.tableHeader);
                }
                r++;

                for (PeriodBreakdown p : rows) {
                    Row row = sheet.createRow(r);
                    int c = 0;
                    cell(row, c++, p.getPeriodName() == null ? "—" : p.getPeriodName(), styles.cellLeft);
                    if (showDimensions) {
                        cell(row, c++, number(p.getQuantScore()), styles.cellCenter);
                        cell(row, c++, outOfFive(p.getQualScore()), styles.cellCenter);
                        cell(row, c++, p.getMatrixRating() == null ? "—" : p.getMatrixRating() + "/5", styles.cellCenter);
                    }
                    cell(row, c++, percent(p.getCompletionPercent()), styles.cellCenter);
                    cell(row, c++, score(p.getSelfScore(), isQual, maxScore), styles.cellCenter);
                    cell(row, c, score(p.getManagerScore(), isQual, maxScore), styles.cellCenter);
                    r++;
                }
            }

            sheet.setColumnWidth(0, 30 * 256);
            for (int i = 1; i <= lastCol; i++) {
                sheet.setColumnWidth(i, 18 * 256);
            }

            wb.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            // Không ném ra ngoài: hỏng tệp đính kèm không đáng để chặn cả email kết quả,
            // thân mail vẫn có bảng điểm. Nơi gọi coi mảng rỗng là "không có đính kèm".
            return new byte[0];
        }
    }

    /** Tên tệp đính kèm — có tên người và tên kỳ để nhân viên lưu về không bị đè lên nhau. */
    public static String fileName(String userName, String cycleName) {
        return "Ket-qua-danh-gia_" + slug(userName) + "_" + slug(cycleName) + ".xlsx";
    }

    private static List<String[]> infoLines(CycleUserEvaluationResponse eval, String cycleName, String unitName,
                                            double maxScore, String scoreLabel, boolean isQual) {
        List<String[]> info = new ArrayList<>();
        info.add(new String[]{"Nhân viên", nullSafe(eval.getUserName())});
        info.add(new String[]{"Đơn vị", nullSafe(eval.getOrgUnitName() != null ? eval.getOrgUnitName() : unitName)});
        info.add(new String[]{"Kỳ đánh giá", nullSafe(cycleName)});
        info.add(new String[]{"Chế độ đánh giá", modeLabel(eval.getMode())});
        info.add(new String[]{isQual ? "Mức tự đánh giá" : "Nhân viên tự đánh giá",
                score(eval.getSelfScore(), isQual, maxScore)});
        info.add(new String[]{isQual ? "Mức QLTT" : "Cán bộ QLTT đánh giá",
                score(eval.getManagerScore(), isQual, maxScore)});

        String finalText = score(eval.getFinalScore(), isQual, maxScore);
        if (eval.getFinalScore() != null && !isQual && scoreLabel != null && !scoreLabel.isBlank()) {
            finalText = finalText + " (" + scoreLabel + ")";
        }
        info.add(new String[]{isQual ? "Mức chốt kỳ" : "Điểm chốt kỳ", finalText});

        if (eval.getMode() != CycleEvaluationMode.QUANTITATIVE) {
            info.add(new String[]{"Mức định tính", outOfFive(eval.getQualScore())});
            info.add(new String[]{"Xếp loại ma trận",
                    eval.getMatrixRating() == null ? "—" : eval.getMatrixRating() + "/5"});
        }
        if (eval.getAvgCompletionPercent() != null) {
            info.add(new String[]{"TB % hoàn thành định lượng", percent(eval.getAvgCompletionPercent())});
        }
        if (eval.getEvaluatedByName() != null) {
            info.add(new String[]{"Người chấm điểm kỳ", eval.getEvaluatedByName()});
        }
        if (eval.getEvaluatedAt() != null) {
            info.add(new String[]{"Thời điểm chấm", DATE_TIME.format(eval.getEvaluatedAt().atZone(ZONE))});
        }
        info.add(new String[]{"Nhận xét",
                eval.getComment() != null && !eval.getComment().isBlank()
                        ? eval.getComment() : "Không có nhận xét thêm."});
        info.add(new String[]{"Ngày xuất", DATE_TIME.format(Instant.now().atZone(ZONE))});
        return info;
    }

    private static void cell(Row row, int index, String value, CellStyle style) {
        Cell c = row.createCell(index);
        c.setCellValue(value);
        c.setCellStyle(style);
    }

    /** Chế độ Định tính hiển thị lại mức gốc 0–5 thay vì số đã quy đổi sang thang điểm. */
    private static String score(Double v, boolean isQual, double maxScore) {
        if (v == null) return "—";
        if (!isQual || maxScore <= 0) return trimZero(v);
        return trimZero(Math.round(v / maxScore * 5 * 100) / 100.0) + "/5";
    }

    private static String number(Double v) {
        return v == null ? "—" : trimZero(v);
    }

    private static String outOfFive(Double v) {
        return v == null ? "—" : trimZero(v) + "/5";
    }

    private static String percent(Double v) {
        return v == null ? "—" : Math.round(v) + "%";
    }

    /** 89.0 → "89", 89.5 → "89.5" — số nguyên không nên hiện đuôi .0 trong bảng điểm. */
    private static String trimZero(double v) {
        return v == Math.rint(v) ? String.valueOf((long) v) : String.valueOf(v);
    }

    private static String modeLabel(CycleEvaluationMode mode) {
        if (mode == null) return "—";
        return switch (mode) {
            case QUANTITATIVE -> "Định lượng";
            case QUALITATIVE -> "Định tính";
            case BOTH -> "Cả hai";
        };
    }

    private static String nullSafe(String s) {
        return s != null && !s.isBlank() ? s : "—";
    }

    /** Bỏ dấu và ký tự lạ để tên tệp an toàn với mọi hệ điều hành và mọi email client. */
    private static String slug(String s) {
        if (s == null || s.isBlank()) return "khong-ten";
        String noAccent = java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('đ', 'd').replace('Đ', 'D');
        String cleaned = noAccent.replaceAll("[^a-zA-Z0-9]+", "-").replaceAll("(^-|-$)", "");
        return cleaned.isBlank() ? "khong-ten" : cleaned;
    }

    /** Gom style vào một chỗ: POI giới hạn số style mỗi workbook nên không tạo lại theo từng ô. */
    private static final class Styles {
        final CellStyle title;
        final CellStyle infoLabel;
        final CellStyle infoValue;
        final CellStyle section;
        final CellStyle tableHeader;
        final CellStyle cellLeft;
        final CellStyle cellCenter;

        Styles(Workbook wb) {
            Font titleFont = wb.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 14);
            titleFont.setColor(IndexedColors.WHITE.getIndex());
            title = wb.createCellStyle();
            title.setFont(titleFont);
            title.setAlignment(HorizontalAlignment.CENTER);
            title.setVerticalAlignment(VerticalAlignment.CENTER);
            title.setFillForegroundColor(IndexedColors.SEA_GREEN.getIndex());
            title.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            Font boldFont = wb.createFont();
            boldFont.setBold(true);
            infoLabel = wb.createCellStyle();
            infoLabel.setFont(boldFont);
            infoLabel.setVerticalAlignment(VerticalAlignment.TOP);

            infoValue = wb.createCellStyle();
            infoValue.setWrapText(true);
            infoValue.setVerticalAlignment(VerticalAlignment.TOP);

            Font sectionFont = wb.createFont();
            sectionFont.setBold(true);
            sectionFont.setColor(IndexedColors.SEA_GREEN.getIndex());
            section = wb.createCellStyle();
            section.setFont(sectionFont);

            Font headerFont = wb.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            tableHeader = wb.createCellStyle();
            tableHeader.setFont(headerFont);
            tableHeader.setAlignment(HorizontalAlignment.CENTER);
            tableHeader.setVerticalAlignment(VerticalAlignment.CENTER);
            tableHeader.setWrapText(true);
            tableHeader.setFillForegroundColor(IndexedColors.BLACK1.getIndex());
            tableHeader.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            border(tableHeader);

            cellLeft = wb.createCellStyle();
            cellLeft.setAlignment(HorizontalAlignment.LEFT);
            border(cellLeft);

            cellCenter = wb.createCellStyle();
            cellCenter.setAlignment(HorizontalAlignment.CENTER);
            border(cellCenter);
        }

        private static void border(CellStyle style) {
            style.setBorderTop(BorderStyle.THIN);
            style.setBorderBottom(BorderStyle.THIN);
            style.setBorderLeft(BorderStyle.THIN);
            style.setBorderRight(BorderStyle.THIN);
        }
    }
}
