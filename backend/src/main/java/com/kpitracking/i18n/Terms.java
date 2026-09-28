package com.kpitracking.i18n;

import org.springframework.context.MessageSourceResolvable;
import org.springframework.context.support.DefaultMessageSourceResolvable;

/**
 * Tên tài nguyên / tên trường ({@code resource.*}, {@code field.*} trong messages*.properties) truyền làm
 * tham số cho câu lỗi, vd. {@code new ResourceNotFoundException(Terms.of("resource.user"), "id", id)}.
 * MessageSource tự dịch tham số loại này theo cùng ngôn ngữ với câu chứa nó.
 */
public final class Terms {

    private Terms() {}

    public static MessageSourceResolvable of(String key) {
        // key thiếu thì hiện chính key, không ném NoSuchMessageException giữa lúc dựng câu lỗi
        return new DefaultMessageSourceResolvable(new String[] {key}, null, key);
    }
}
