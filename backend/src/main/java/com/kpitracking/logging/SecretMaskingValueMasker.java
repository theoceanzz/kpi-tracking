package com.kpitracking.logging;

import com.fasterxml.jackson.core.JsonStreamContext;
import net.logstash.logback.mask.ValueMasker;

/**
 * ValueMasker cho LogstashEncoder (JSON prod): che secret trong MỌI giá trị chuỗi của dòng log
 * (message, MDC, stack trace, field bổ sung) — không chỉ message như converter text.
 */
public class SecretMaskingValueMasker implements ValueMasker {

    @Override
    public Object mask(JsonStreamContext context, Object value) {
        if (value instanceof String s) {
            String masked = SecretMasker.mask(s);
            return masked.equals(s) ? value : masked;
        }
        return value;
    }
}
