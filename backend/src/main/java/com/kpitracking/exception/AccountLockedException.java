package com.kpitracking.exception;

/** Tài khoản đang bị khoá tạm do đăng nhập sai nhiều lần — trả 429 để client hiển thị đúng thông điệp. */
public class AccountLockedException extends RuntimeException {

    public AccountLockedException(String message) {
        super(message);
    }
}
