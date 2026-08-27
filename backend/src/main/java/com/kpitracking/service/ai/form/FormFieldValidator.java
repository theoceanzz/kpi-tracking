package com.kpitracking.service.ai.form;

import com.kpitracking.service.ai.form.FormSpec.Field;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Locale;

/**
 * Kiểm giá trị model đề xuất cho MỘT ô, theo bản mô tả của {@link FormRegistry}.
 *
 * <p>Ném {@link IllegalArgumentException} với thông báo viết cho MODEL đọc chứ không phải cho lập
 * trình viên: tool bắt ngoại lệ này rồi trả về nguyên văn, model đọc và tự sửa ngay trong cùng lượt.
 * Đây là cách các tool sẵn có đang làm ({@code ToolSupport.toolError}) và là thứ khiến vòng lặp tự
 * sửa được lỗi thay vì trả bừa.
 *
 * <p>Ô tham chiếu thực thể ({@code ENTITY}/{@code ENTITY_LIST}) KHÔNG kiểm ở đây vì cần tra cơ sở
 * dữ liệu và kiểm quyền — việc đó nằm ở tool, nơi có sẵn {@code ToolSupport}.
 */
@Component
public class FormFieldValidator {

    /**
     * @param value   giá trị đã chuẩn hoá để client điền thẳng vào form
     * @param display bản hiển thị cho người dùng đọc trong bản xem trước
     */
    public record Checked(Object value, String display) {}

    private static final DateTimeFormatter VN = DateTimeFormatter.ofPattern("dd/MM/uuuu");

    public Checked check(Field f, Object raw) {
        if (raw == null) {
            throw new IllegalArgumentException("Ô '" + f.name() + "' không có giá trị. Bỏ hẳn ô này ra khỏi đề xuất thay vì để trống.");
        }
        return switch (f.kind()) {
            case TEXT -> text(f, raw);
            case NUMBER -> number(f, raw);
            case BOOLEAN -> bool(f, raw);
            case ENUM -> enumValue(f, raw);
            case DATE -> date(f, raw);
            case ENTITY, ENTITY_LIST -> throw new IllegalStateException(
                    "Ô tham chiếu thực thể phải được tool tự tra, không đi qua đây: " + f.name());
        };
    }

    private Checked text(Field f, Object raw) {
        String s = String.valueOf(raw).trim();
        if (s.isEmpty()) {
            throw new IllegalArgumentException("Ô '" + f.name() + "' rỗng. Bỏ ô này ra khỏi đề xuất.");
        }
        // Chặn model nhồi cả đoạn văn vào ô một dòng.
        if (s.length() > 2000) {
            throw new IllegalArgumentException("Ô '" + f.name() + "' dài quá 2000 ký tự. Hãy viết ngắn lại.");
        }
        // Với ô chữ, min là SỐ KÝ TỰ tối thiểu — chặn ở đây thay vì để form từ chối sau khi
        // người dùng đã bấm Điền.
        if (f.min() != null && s.length() < f.min()) {
            throw new IllegalArgumentException("Ô '" + f.name() + "' phải dài ít nhất "
                    + (int) (double) f.min() + " ký tự, nhận được " + s.length() + ". Hãy viết đầy đủ hơn.");
        }
        return new Checked(s, s);
    }

    private Checked number(Field f, Object raw) {
        double v;
        try {
            v = raw instanceof Number n ? n.doubleValue()
                    // Model hay trả "80%" hoặc "1.000" theo kiểu hiển thị Việt Nam.
                    : Double.parseDouble(String.valueOf(raw).trim().replace("%", "").replace(".", "").replace(",", "."));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(
                    "Ô '" + f.name() + "' phải là số, nhận được '" + raw + "'.");
        }
        if (f.min() != null && v < f.min()) {
            throw new IllegalArgumentException(
                    "Ô '" + f.name() + "' phải >= " + fmt(f.min()) + ", nhận được " + fmt(v) + ".");
        }
        if (f.max() != null && v > f.max()) {
            throw new IllegalArgumentException(
                    "Ô '" + f.name() + "' phải <= " + fmt(f.max()) + ", nhận được " + fmt(v) + ".");
        }
        // Giữ nguyên kiểu nguyên nếu vốn là số nguyên, để form không hiện "5.0".
        Object value = v == Math.rint(v) && !Double.isInfinite(v) ? (Object) (long) v : (Object) v;
        return new Checked(value, String.valueOf(value));
    }

    private Checked bool(Field f, Object raw) {
        String s = String.valueOf(raw).trim().toLowerCase(Locale.ROOT);
        if (raw instanceof Boolean b) return new Checked(b, b ? "Có" : "Không");
        if (s.equals("true") || s.equals("có") || s.equals("co")) return new Checked(true, "Có");
        if (s.equals("false") || s.equals("không") || s.equals("khong")) return new Checked(false, "Không");
        throw new IllegalArgumentException("Ô '" + f.name() + "' phải là true hoặc false, nhận được '" + raw + "'.");
    }

    private Checked enumValue(Field f, Object raw) {
        String s = String.valueOf(raw).trim();
        // Nhận cả hằng số lẫn nhãn tiếng Việt hiện trên giao diện: model hay trả đúng chữ mà người
        // dùng nói ("Hàng tháng") thay vì hằng số, và khi bị từ chối thì nó bỏ cuộc chứ không sửa.
        String matched = f.matchEnum(s);
        if (matched != null) return new Checked(matched, matched);
        throw new IllegalArgumentException("Ô '" + f.name() + "' chỉ nhận: "
                + String.join(", ", f.allowedValues()) + ". Nhận được '" + s + "'.");
    }

    private Checked date(Field f, Object raw) {
        String s = String.valueOf(raw).trim();
        LocalDate d = parse(s);
        if (d == null) {
            throw new IllegalArgumentException(
                    "Ô '" + f.name() + "' phải là ngày dạng dd/MM/yyyy hoặc yyyy-MM-dd, nhận được '" + s + "'.");
        }
        // Form dùng input type=date nên phải trả ISO; bản hiển thị thì theo cách đọc của người Việt.
        return new Checked(d.toString(), d.format(VN));
    }

    private LocalDate parse(String s) {
        try {
            return LocalDate.parse(s);
        } catch (DateTimeParseException ignored) {
            // thử tiếp dạng Việt Nam
        }
        try {
            return LocalDate.parse(s, VN);
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private String fmt(double d) {
        return d == Math.rint(d) ? String.valueOf((long) d) : String.valueOf(d);
    }
}
