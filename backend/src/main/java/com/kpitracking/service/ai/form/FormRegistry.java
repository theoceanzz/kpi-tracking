package com.kpitracking.service.ai.form;

import com.kpitracking.service.ai.form.FormSpec.Descriptor;
import com.kpitracking.service.ai.form.FormSpec.Field;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Nơi khai báo DUY NHẤT: form nào trợ lý điền được, gồm ô nào, và tool nào phụ trách.
 *
 * <p>Cùng vai trò với {@link com.kpitracking.tool.ToolRegistry} ở tầng tool — thêm form mới là thêm
 * một {@link Descriptor} ở đây cộng một lớp tool, không phải sửa file dùng chung.
 *
 * <p><b>Chỉ khai báo ô AN TOÀN.</b> Form đăng nhập, đổi mật khẩu, phân quyền cố ý không có mặt: trợ
 * lý không được đề xuất giá trị cho những thứ đó dù người dùng có yêu cầu.
 */
@Component
public class FormRegistry {

    public static final String KPI_FORM = "kpi_form";
    public static final String SUBMISSION_FORM = "submission_form";
    public static final String EVALUATION_FORM = "evaluation_form";
    public static final String KPI_ADJUSTMENT_FORM = "kpi_adjustment_form";
    public static final String ORG_UNIT_FORM = "org_unit_form";
    public static final String ORG_UNIT_DRAWER_FORM = "org_unit_drawer_form";

    /**
     * Ô của form tạo/sửa chỉ tiêu KPI. Phản chiếu {@code frontend/src/features/kpi/schemas/kpiSchema.ts}
     * — hai nơi lệch nhau thì trợ lý đề xuất được thứ form từ chối, nên
     * {@code FormRegistryTest} đối chiếu danh sách này với schema Zod.
     *
     * <p>Cố ý BỎ các ô quan hệ nội bộ ({@code parentId}, {@code parentRelationType},
     * {@code keyResultId}, {@code perspectiveId}): chúng chỉ có nghĩa trong luồng ủy quyền / phân rã
     * / gắn OKR mà người dùng thao tác bằng chuột, đề xuất bằng lời gần như luôn sai.
     */
    private static final Descriptor KPI = new Descriptor(
            KPI_FORM,
            "Tạo/sửa chỉ tiêu KPI",
            "suggest_kpi_form",
            List.of(
                    Field.enumOf("kpiType", "Loại chỉ tiêu", new LinkedHashMap<>(Map.of(
                            "QUANTITATIVE", "Định lượng",
                            "QUALITATIVE", "Định tính"))),
                    Field.text("name", "Tên chỉ tiêu"),
                    Field.text("description", "Mô tả"),
                    Field.text("unit", "Đơn vị tính"),
                    Field.number("weight", "Trọng số (%)", 0d, 100d),
                    Field.number("targetValue", "Giá trị mục tiêu", 0d, null),
                    Field.number("minimumValue", "Mục tiêu tối thiểu", 0d, null),
                    // Nhãn phải khớp FREQUENCY_MAP trong frontend/src/lib/utils.ts — đó chính là
                    // chữ người dùng nhìn thấy, nên cũng là chữ họ nói lại với trợ lý.
                    Field.enumOf("frequency", "Tần suất", frequencyLabels()),
                    Field.bool("isReverseKpi", "Chỉ tiêu nghịch"),
                    Field.bool("isBonusKpi", "Chỉ tiêu thưởng"),
                    Field.date("deadline", "Hạn chót"),
                    Field.entity("kpiPeriodId", "Đợt KPI"),
                    Field.entityList("orgUnitIds", "Đơn vị áp dụng"),
                    Field.entityList("assignedToIds", "Người được giao")));

    /**
     * Form nộp báo cáo KPI. Phản chiếu {@code frontend/src/features/submissions/schemas/submissionSchema.ts}.
     *
     * <p>Trợ lý chỉ hiện với vai trò rank ≤ 1 (xem {@code ManagerContextResolver}), nên form này
     * phục vụ quản lý tự nộp KPI của chính họ, không phải toàn bộ nhân viên.
     */
    private static final Descriptor SUBMISSION = new Descriptor(
            SUBMISSION_FORM,
            "Nộp báo cáo KPI",
            "suggest_submission_form",
            List.of(
                    Field.entity("kpiCriteriaId", "Chỉ tiêu"),
                    Field.number("actualValue", "Giá trị thực tế", 0d, null),
                    Field.entity("qualitativeLevelId", "Mức định tính"),
                    Field.text("note", "Ghi chú"),
                    Field.date("periodStart", "Từ ngày"),
                    Field.date("periodEnd", "Đến ngày")));

    /**
     * Form đánh giá nhân viên. Phản chiếu
     * {@code frontend/src/features/evaluations/schemas/evaluationSchema.ts}.
     */
    private static final Descriptor EVALUATION = new Descriptor(
            EVALUATION_FORM,
            "Đánh giá nhân viên",
            "suggest_evaluation_form",
            List.of(
                    Field.entity("userId", "Nhân viên"),
                    Field.entity("kpiPeriodId", "Đợt KPI"),
                    Field.number("score", "Điểm", 0d, null),
                    Field.text("comment", "Nhận xét")));

    /**
     * Form xin điều chỉnh chỉ tiêu. Phản chiếu {@code adjustmentSchema} trong
     * {@code frontend/src/features/kpi/components/KpiAdjustmentModal.tsx}.
     *
     * <p>Không có ô tham chiếu thực thể nào: KPI đến từ prop của modal chứ không phải trường form.
     */
    private static final Descriptor KPI_ADJUSTMENT = new Descriptor(
            KPI_ADJUSTMENT_FORM,
            "Xin điều chỉnh chỉ tiêu",
            "suggest_kpi_adjustment_form",
            List.of(
                    Field.number("requestedTargetValue", "Mục tiêu đề nghị", 0d, null),
                    Field.number("requestedMinimumValue", "Mục tiêu tối thiểu đề nghị", 0d, null),
                    Field.bool("deactivationRequest", "Xin ngừng theo dõi"),
                    // schema đòi tối thiểu 10 ký tự — khai ở đây để chặn trước, thay vì để form báo đỏ.
                    Field.text("reason", "Lý do", 10)));

    /**
     * Form tạo/sửa đơn vị. Phản chiếu {@code frontend/src/features/orgunits/schemas/orgUnitSchema.ts}.
     *
     * <p>Cố ý BỎ {@code provinceId}/{@code districtId} (huyện chỉ tra được khi biết tỉnh, mà tỉnh
     * lại không có hàm tìm theo tên — chi phí cao, giá trị thấp) và {@code roleIds} (gán vai trò là
     * bề mặt liên quan phân quyền).
     */
    private static final Descriptor ORG_UNIT = new Descriptor(
            ORG_UNIT_FORM,
            "Tạo/sửa đơn vị",
            "suggest_org_unit_form",
            List.of(
                    Field.text("name", "Tên đơn vị"),
                    Field.text("code", "Mã đơn vị"),
                    Field.text("email", "Email"),
                    Field.text("phone", "Điện thoại"),
                    Field.text("address", "Địa chỉ"),
                    Field.entity("orgHierarchyId", "Cấp bậc"),
                    Field.entity("parentId", "Đơn vị cha")));

    /**
     * Form sửa đơn vị dạng drawer. KHÁC {@link #ORG_UNIT} dù nhìn giống: cấp bậc ở đây là chữ tự do
     * ({@code unitTypeName}) chứ không phải id, có thêm {@code status}, và không có đơn vị cha.
     * Gộp hai form lại là mở đường cho đề xuất sai kiểu.
     */
    private static final Descriptor ORG_UNIT_DRAWER = new Descriptor(
            ORG_UNIT_DRAWER_FORM,
            "Sửa đơn vị",
            "suggest_org_unit_drawer_form",
            List.of(
                    Field.text("name", "Tên đơn vị"),
                    Field.text("code", "Mã đơn vị"),
                    Field.text("unitTypeName", "Loại tổ chức"),
                    Field.text("email", "Email"),
                    Field.text("phone", "Điện thoại"),
                    Field.text("address", "Địa chỉ"),
                    Field.enumOf("status", "Trạng thái", statusLabels())));

    private static Map<String, String> statusLabels() {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("ACTIVE", "Hoạt động");
        m.put("TRIAL", "Dùng thử");
        m.put("INACTIVE", "Tạm dừng");
        m.put("SUSPENDED", "Đình chỉ");
        return m;
    }

    private static Map<String, String> frequencyLabels() {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("DAILY", "Hàng ngày");
        m.put("WEEKLY", "Hàng tuần");
        m.put("MONTHLY", "Hàng tháng");
        m.put("QUARTERLY", "Hàng quý");
        m.put("SEMI_ANNUALLY", "6 tháng");
        m.put("YEARLY", "Hàng năm");
        m.put("UNLIMITED", "Không giới hạn");
        return m;
    }

    private final Map<String, Descriptor> byFormId = new LinkedHashMap<>();

    public FormRegistry() {
        byFormId.put(KPI.formId(), KPI);
        byFormId.put(SUBMISSION.formId(), SUBMISSION);
        byFormId.put(EVALUATION.formId(), EVALUATION);
        byFormId.put(KPI_ADJUSTMENT.formId(), KPI_ADJUSTMENT);
        byFormId.put(ORG_UNIT.formId(), ORG_UNIT);
        byFormId.put(ORG_UNIT_DRAWER.formId(), ORG_UNIT_DRAWER);
    }

    /** Bản mô tả của form đang mở; {@code null} nếu client nêu một formId không có thật. */
    public Descriptor find(String formId) {
        return formId == null ? null : byFormId.get(formId.trim());
    }

    /** Tên tool phụ trách form; {@code null} nếu không có form nào khớp. */
    public String toolNameFor(String formId) {
        Descriptor d = find(formId);
        return d == null ? null : d.toolName();
    }

    public List<Descriptor> all() {
        return List.copyOf(byFormId.values());
    }
}
