package com.kpitracking.ai.document.parse;

import com.kpitracking.ai.document.model.FileRef;
import com.kpitracking.ai.document.model.ParsedDocument;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Set;

/** Chữ trơn ({@code txt, md, csv}), đọc UTF-8. */
@Component
public class TextParser implements DocumentParser {

    @Override
    public Set<String> formats() {
        return Set.of("txt", "md", "csv");
    }

    @Override
    public boolean accepts(FileRef file) {
        return formats().contains(file.extension());
    }

    @Override
    public ParsedDocument parse(FileRef file) throws Exception {
        String text = new String(file.bytes(), StandardCharsets.UTF_8).replace("﻿", "");
        if (text.isBlank()) throw new Unparseable("tệp trống");
        return ParsedDocument.fromText(file.name(), file.extension(), text, ParsedDocument.TextSource.TEXT, false, null);
    }
}
