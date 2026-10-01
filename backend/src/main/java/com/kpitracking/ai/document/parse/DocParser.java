package com.kpitracking.ai.document.parse;

import com.kpitracking.ai.document.model.FileRef;
import com.kpitracking.ai.document.model.ParsedDocument;
import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.extractor.WordExtractor;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.util.Set;

/** Word 97–2003 ({@code .doc}) bằng HWPF — chỉ chữ, mỗi đoạn một dòng (định dạng cũ không giữ được tiêu đề). */
@Component
public class DocParser implements DocumentParser {

    @Override
    public Set<String> formats() {
        return Set.of("doc");
    }

    @Override
    public boolean accepts(FileRef file) {
        String ext = file.extension();
        return ext.equals("doc") && !DocumentParser.isZip(file.bytes())
                || ext.equals("docx") && DocumentParser.isOle2(file.bytes());
    }

    @Override
    public ParsedDocument parse(FileRef file) throws Exception {
        try (HWPFDocument doc = new HWPFDocument(new ByteArrayInputStream(file.bytes()));
             WordExtractor ex = new WordExtractor(doc)) {
            StringBuilder sb = new StringBuilder();
            for (String p : ex.getParagraphText()) {
                String t = p == null ? "" : p.strip();
                if (!t.isEmpty()) sb.append(t).append('\n');
            }
            if (sb.isEmpty()) throw new Unparseable("tài liệu Word không có chữ (có thể chỉ chứa ảnh)");
            return ParsedDocument.fromText(file.name(), "doc", sb.toString(), ParsedDocument.TextSource.TEXT, false, null);
        }
    }
}
