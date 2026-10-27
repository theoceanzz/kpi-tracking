package com.kpitracking.service.task;

import com.kpitracking.dto.request.task.CreateKpiTaskRequest;
import com.kpitracking.dto.request.task.TaskListRequests;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.task.KpiTaskResponse;
import com.kpitracking.dto.response.task.TaskListResponses;

import com.kpitracking.enums.task.KpiTaskEventAction;
import com.kpitracking.enums.task.KpiTaskPriority;
import com.kpitracking.enums.task.KpiTaskStatus;
import com.kpitracking.enums.task.TaskListRole;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.repository.task.TaskListSectionRepository;
import com.kpitracking.repository.task.TaskTagRepository;
import com.kpitracking.repository.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

import com.kpitracking.entity.task.KpiTask;
import com.kpitracking.entity.task.TaskList;
import com.kpitracking.entity.task.TaskListSection;
import com.kpitracking.entity.task.TaskTag;
import com.kpitracking.entity.user.User;
/**
 * Xuất / nhập công việc bằng Excel.
 * <ul>
 *   <li>Xuất: đúng bộ lọc đang xem (qua {@link KpiTaskService#list} — chỉ việc người gọi xem được), tối đa {@link #MAX_EXPORT}.</li>
 *   <li>Nhập vào MỘT danh sách (cần EDITOR): xem trước (kiểm từng dòng, câu lỗi đã dịch) → xác nhận (mỗi dòng một transaction).
 *       Việc nhập vào là việc KHÔNG KPI; người thực hiện theo email (cùng tổ chức); nhóm / nhãn chưa có thì tạo.</li>
 * </ul>
 * Cột của tệp mẫu cố định theo VỊ TRÍ (tên cột dịch theo ngôn ngữ, nên không đọc theo tên).
 */
@Service
@RequiredArgsConstructor
public class TaskExcelService {

    public static final int MAX_EXPORT = 5000;
    public static final int MAX_IMPORT = 500;
    private static final DateTimeFormatter VN = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final String[] IMPORT_COLUMNS = {"title", "description", "assignees", "start", "due", "priority", "status", "section", "tags"};

    private final KpiTaskService taskService;
    private final TaskListService listService;
    private final TaskListAccess listAccess;
    private final TaskListSectionRepository sectionRepository;
    private final TaskTagRepository tagRepository;
    private final UserRepository userRepository;
    private final KpiTaskAccess access;
    private final PlatformTransactionManager txManager;

    private static String t(String key) {
        return ErrorMessages.text("taskExcel." + key, key);
    }

    // ══ Xuất ═════════════════════════════════════════════════════════════════════════════════════

    public byte[] export(KpiTaskService.ListQuery base) throws IOException {
        List<KpiTaskResponse> rows = new ArrayList<>();
        for (int page = 0; rows.size() < MAX_EXPORT; page++) {
            KpiTaskService.ListQuery q = new KpiTaskService.ListQuery(base.view(), base.kpiId(), base.periodId(), base.ownerId(),
                    base.statuses(), base.priority(), base.due(), base.dueFrom(), base.dueTo(), base.keyword(), base.sort(),
                    base.topLevel(), page, 500, base.listId(), base.sectionId(), base.noSection(), base.hasKpi(), base.tagIds(),
                    base.fieldFilters(), base.sortFieldId(), base.rangeFrom(), base.rangeTo());
            PageResponse<KpiTaskResponse> p = taskService.list(q);
            rows.addAll(p.getContent());
            if (p.isLast() || p.getContent().isEmpty()) break;
        }
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet(t("sheet"));
            CellStyle head = headerStyle(wb);
            String[] cols = {"col.title", "col.status", "col.priority", "col.assignees", "col.start", "col.due", "col.kpi",
                    "col.lists", "col.tags", "col.creator", "col.createdAt", "col.completedAt"};
            Row h = sheet.createRow(0);
            for (int i = 0; i < cols.length; i++) {
                Cell c = h.createCell(i);
                c.setCellValue(t(cols[i]));
                c.setCellStyle(head);
            }
            ZoneId zone = KpiTaskService.ZONE;
            int r = 1;
            for (KpiTaskResponse x : rows.subList(0, Math.min(rows.size(), MAX_EXPORT))) {
                Row row = sheet.createRow(r++);
                int c = 0;
                row.createCell(c++).setCellValue((x.getParentTitle() != null ? "↳ " : "") + x.getTitle());
                row.createCell(c++).setCellValue(t("status." + x.getStatus().name()));
                row.createCell(c++).setCellValue(t("priority." + x.getPriority().name()));
                row.createCell(c++).setCellValue(x.getAssignees() == null ? "" : x.getAssignees().stream()
                        .map(KpiTaskResponse.Assignee::getFullName).filter(Objects::nonNull).collect(Collectors.joining(", ")));
                row.createCell(c++).setCellValue(x.getStartDate() == null ? "" : VN.format(x.getStartDate()));
                row.createCell(c++).setCellValue(x.getDueDate() == null ? "" : VN.format(x.getDueDate())
                        + (x.getDueTime() != null ? " " + x.getDueTime().toString().substring(0, 5) : ""));
                row.createCell(c++).setCellValue(x.getKpiName() == null ? "" : x.getKpiName());
                row.createCell(c++).setCellValue(x.getLists() == null ? "" : x.getLists().stream()
                        .map(l -> l.getListName() + (l.getSectionName() != null ? " / " + l.getSectionName() : ""))
                        .collect(Collectors.joining("; ")));
                row.createCell(c++).setCellValue(x.getTags() == null ? "" : x.getTags().stream()
                        .map(KpiTaskResponse.Tag::getName).collect(Collectors.joining(", ")));
                row.createCell(c++).setCellValue(x.getCreatedByName() == null ? "" : x.getCreatedByName());
                row.createCell(c++).setCellValue(x.getCreatedAt() == null ? "" : VN.format(LocalDate.ofInstant(x.getCreatedAt(), zone)));
                row.createCell(c).setCellValue(x.getCompletedAt() == null ? "" : VN.format(LocalDate.ofInstant(x.getCompletedAt(), zone)));
            }
            for (int i = 0; i < cols.length; i++) sheet.setColumnWidth(i, i == 0 ? 50 * 256 : 20 * 256);
            sheet.createFreezePane(0, 1);
            wb.write(out);
            return out.toByteArray();
        }
    }

    /** Tệp mẫu nhập: một dòng tiêu đề + một dòng ví dụ. */
    public byte[] importTemplate() throws IOException {
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet(t("sheet"));
            CellStyle head = headerStyle(wb);
            Row h = sheet.createRow(0);
            for (int i = 0; i < IMPORT_COLUMNS.length; i++) {
                Cell c = h.createCell(i);
                c.setCellValue(t("import." + IMPORT_COLUMNS[i]));
                c.setCellStyle(head);
                sheet.setColumnWidth(i, (i == 0 || i == 1 ? 40 : 22) * 256);
            }
            Row ex = sheet.createRow(1);
            String[] sample = {t("import.sample.title"), t("import.sample.description"), "", VN.format(KpiTaskService.today()),
                    VN.format(KpiTaskService.today().plusDays(7)), t("priority.HIGH"), t("status.TODO"), t("import.sample.section"),
                    t("import.sample.tags")};
            for (int i = 0; i < sample.length; i++) ex.createCell(i).setCellValue(sample[i]);
            wb.write(out);
            return out.toByteArray();
        }
    }

    // ══ Nhập ═════════════════════════════════════════════════════════════════════════════════════

    public TaskListResponses.ImportPreview preview(UUID listId, MultipartFile file) {
        TransactionTemplate tx = new TransactionTemplate(txManager);
        tx.setReadOnly(true);
        return tx.execute(s -> {
            User me = taskService.currentUser();
            TaskList list = listService.editableList(me, listId, TaskListRole.EDITOR);
            List<TaskListRequests.ImportRow> rows = parse(file);
            List<TaskListResponses.ImportPreviewRow> out = new ArrayList<>();
            int i = 0;
            for (TaskListRequests.ImportRow r : rows) out.add(check(me, list, r, ++i + 1));
            int errors = (int) out.stream().filter(r -> !r.getErrors().isEmpty()).count();
            return TaskListResponses.ImportPreview.builder().rows(out).errorCount(errors).validCount(out.size() - errors).build();
        });
    }

    /** Tạo các dòng hợp lệ; dòng lỗi trả lại kèm lý do. Mỗi dòng một transaction. */
    public TaskListResponses.ImportResult commit(UUID listId, TaskListRequests.ImportCommit req) {
        if (req.getRows().size() > MAX_IMPORT) throw new BusinessException(ErrorCode.TASK_IMPORT_TOO_MANY_ROWS, MAX_IMPORT);
        TransactionTemplate tx = new TransactionTemplate(txManager);
        User me = tx.execute(s -> taskService.currentUser());
        tx.executeWithoutResult(s -> listService.editableList(me, listId, TaskListRole.EDITOR));
        int created = 0;
        List<TaskListResponses.ImportPreviewRow> failed = new ArrayList<>();
        int n = 1;
        for (TaskListRequests.ImportRow r : req.getRows()) {
            int rowNumber = ++n;
            try {
                Boolean ok = tx.execute(s -> {
                    TaskList list = listService.editableList(me, listId, TaskListRole.EDITOR);
                    TaskListResponses.ImportPreviewRow checked = check(me, list, r, rowNumber);
                    if (!checked.getErrors().isEmpty()) {
                        failed.add(checked);
                        return false;
                    }
                    createRow(me, list, r);
                    return true;
                });
                if (Boolean.TRUE.equals(ok)) created++;
            } catch (Exception e) {
                failed.add(TaskListResponses.ImportPreviewRow.builder().rowNumber(rowNumber).title(r.getTitle())
                        .errors(List.of(e.getMessage() == null ? t("import.err.unknown") : e.getMessage())).build());
            }
        }
        return TaskListResponses.ImportResult.builder().created(created).failed(failed).build();
    }

    private void createRow(User me, TaskList list, TaskListRequests.ImportRow r) {
        UUID sectionId = null;
        if (r.getSection() != null && !r.getSection().isBlank()) {
            String name = r.getSection().strip();
            sectionId = sectionRepository.findByListIdOrderBySortOrderAscCreatedAtAsc(list.getId()).stream()
                    .filter(s -> s.getName().equalsIgnoreCase(name)).map(TaskListSection::getId).findFirst()
                    .orElseGet(() -> sectionRepository.save(TaskListSection.builder().listId(list.getId())
                            .name(KpiTaskService.truncate(name, 120)).sortOrder(sectionRepository.maxSortOrder(list.getId()) + 1).build()).getId());
        }
        List<UUID> tagIds = new ArrayList<>();
        for (String name : split(r.getTags())) {
            TaskTag tag = tagRepository.findByName(list.getOrganizationId(), name)
                    .orElseGet(() -> tagRepository.save(TaskTag.builder().organizationId(list.getOrganizationId())
                            .name(KpiTaskService.truncate(name, 60)).createdBy(me.getId()).build()));
            tagIds.add(tag.getId());
        }
        List<UUID> assignees = split(r.getAssigneeEmails()).stream()
                .map(e -> userRepository.findByEmail(e).map(User::getId).orElse(null)).filter(Objects::nonNull).toList();
        KpiTask task = taskService.createInternal(me, CreateKpiTaskRequest.builder().title(r.getTitle()).description(r.getDescription())
                .assigneeIds(assignees.isEmpty() ? null : assignees).startDate(r.getStartDate()).dueDate(r.getDueDate())
                .priority(r.getPriority()).listId(list.getId()).sectionId(sectionId).tagIds(tagIds).build());
        taskService.log(task, me, KpiTaskEventAction.IMPORTED, null, list.getName());
        if (r.getStatus() != null && r.getStatus() != KpiTaskStatus.TODO) {
            taskService.applyStatus(me, task, r.getStatus(), null, true);
        }
    }

    /** Kiểm một dòng — câu lỗi dịch theo ngôn ngữ người gọi. */
    private TaskListResponses.ImportPreviewRow check(User me, TaskList list, TaskListRequests.ImportRow r, int rowNumber) {
        List<String> errors = new ArrayList<>();
        if (r.getTitle() == null || r.getTitle().isBlank()) errors.add(t("import.err.title"));
        if (r.getStartDate() != null && r.getDueDate() != null && r.getStartDate().isAfter(r.getDueDate())) {
            errors.add(ErrorMessages.resolve(ErrorCode.TASK_START_AFTER_DUE, new Object[0]));
        }
        for (String email : split(r.getAssigneeEmails())) {
            UUID id = userRepository.findByEmail(email).map(User::getId).orElse(null);
            if (id == null || !access.canAssignWithoutKpi(me.getId(), id, list.getOrganizationId())) {
                errors.add(ErrorMessages.text("taskExcel.import.err.assignee", "assignee", email));
            }
        }
        return TaskListResponses.ImportPreviewRow.builder().rowNumber(rowNumber).title(r.getTitle()).description(r.getDescription())
                .assigneeEmails(r.getAssigneeEmails()).startDate(r.getStartDate()).dueDate(r.getDueDate()).priority(r.getPriority())
                .status(r.getStatus()).section(r.getSection()).tags(r.getTags()).errors(errors).build();
    }

    private List<TaskListRequests.ImportRow> parse(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new BusinessException(ErrorCode.TASK_IMPORT_FILE_INVALID);
        try (InputStream in = file.getInputStream(); Workbook wb = WorkbookFactory.create(in)) {
            Sheet sheet = wb.getSheetAt(0);
            DataFormatter fmt = new DataFormatter();
            List<TaskListRequests.ImportRow> rows = new ArrayList<>();
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                String title = text(fmt, row, 0);
                String desc = text(fmt, row, 1);
                if ((title == null || title.isBlank()) && (desc == null || desc.isBlank())) continue;
                if (rows.size() >= MAX_IMPORT) throw new BusinessException(ErrorCode.TASK_IMPORT_TOO_MANY_ROWS, MAX_IMPORT);
                rows.add(TaskListRequests.ImportRow.builder().title(title).description(desc).assigneeEmails(text(fmt, row, 2))
                        .startDate(date(fmt, row, 3)).dueDate(date(fmt, row, 4)).priority(priority(text(fmt, row, 5)))
                        .status(status(text(fmt, row, 6))).section(text(fmt, row, 7)).tags(text(fmt, row, 8)).build());
            }
            return rows;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.TASK_IMPORT_FILE_INVALID);
        }
    }

    private static String text(DataFormatter fmt, Row row, int col) {
        Cell c = row.getCell(col);
        if (c == null) return null;
        String v = fmt.formatCellValue(c);
        return v == null || v.isBlank() ? null : v.strip();
    }

    private static LocalDate date(DataFormatter fmt, Row row, int col) {
        Cell c = row.getCell(col);
        if (c == null) return null;
        try {
            if (c.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(c)) {
                return c.getLocalDateTimeCellValue().toLocalDate();
            }
        } catch (Exception ignored) {
            // rơi xuống đọc dạng chữ
        }
        String s = text(fmt, row, col);
        if (s == null) return null;
        for (DateTimeFormatter f : List.of(VN, DateTimeFormatter.ISO_LOCAL_DATE, DateTimeFormatter.ofPattern("d/M/yyyy"))) {
            try {
                return LocalDate.parse(s, f);
            } catch (Exception ignored) {
                // thử mẫu khác
            }
        }
        return null;
    }

    /** Nhận tên kiểu enum (HIGH) hoặc nhãn theo ngôn ngữ ("Cao"). */
    private static KpiTaskPriority priority(String s) {
        if (s == null) return null;
        for (KpiTaskPriority p : KpiTaskPriority.values()) {
            if (p.name().equalsIgnoreCase(s) || t("priority." + p.name()).equalsIgnoreCase(s)) return p;
        }
        return null;
    }

    private static KpiTaskStatus status(String s) {
        if (s == null) return null;
        for (KpiTaskStatus st : KpiTaskStatus.values()) {
            if (st.name().equalsIgnoreCase(s) || t("status." + st.name()).equalsIgnoreCase(s)) return st;
        }
        return null;
    }

    private static List<String> split(String s) {
        if (s == null || s.isBlank()) return List.of();
        return Arrays.stream(s.split("[,;]")).map(String::strip).filter(x -> !x.isEmpty()).distinct().toList();
    }

    private static CellStyle headerStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont();
        f.setBold(true);
        s.setFont(f);
        s.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return s;
    }
}
