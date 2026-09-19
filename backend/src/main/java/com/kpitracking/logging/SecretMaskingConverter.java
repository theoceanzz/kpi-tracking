package com.kpitracking.logging;

import ch.qos.logback.classic.pattern.MessageConverter;
import ch.qos.logback.classic.spi.ILoggingEvent;

/** {@code %maskedMsg} trong pattern text: message đã che secret. Đăng ký ở logback-spring.xml. */
public class SecretMaskingConverter extends MessageConverter {

    @Override
    public String convert(ILoggingEvent event) {
        return SecretMasker.mask(super.convert(event));
    }
}
