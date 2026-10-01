package com.kpitracking.ai.document.parse;

import com.kpitracking.ai.document.model.FileRef;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;

/**
 * Chọn {@link DocumentParser} cho một tệp (Registry). Mọi parser là bean; thêm định dạng mới = thêm một bean,
 * không sửa ở đây. PDF được xét TRƯỚC (nhận theo nội dung "%PDF" dù đuôi sai), còn lại theo thứ tự bean.
 */
@Component
public class ParserRegistry {

    private final List<DocumentParser> parsers;

    public ParserRegistry(List<DocumentParser> parsers) {
        // PDF trước: một tệp .docx thật ra là PDF (tải về đổi tên) vẫn đọc đúng.
        this.parsers = parsers.stream()
                .sorted((a, b) -> Boolean.compare(!(a instanceof PdfParser), !(b instanceof PdfParser)))
                .toList();
    }

    public Optional<DocumentParser> forFile(FileRef file) {
        return parsers.stream().filter(p -> p.accepts(file)).findFirst();
    }

    /** Mọi đuôi tệp đọc được — để kiểm tệp tải lên và hiện cho người dùng. */
    public Set<String> formats() {
        Set<String> out = new TreeSet<>();
        parsers.forEach(p -> out.addAll(p.formats()));
        return out;
    }
}
