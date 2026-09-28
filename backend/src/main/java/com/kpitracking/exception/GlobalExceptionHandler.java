package com.kpitracking.exception;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.i18n.Messages;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Mọi phản hồi lỗi đều có {@code code} ({@link ErrorCode}) và {@code message} đã dịch theo
 * {@code Accept-Language}. Frontend hiển thị nguyên văn message, không tự dịch lỗi API
 * ({@code docs/I18N_DESIGN.md} §6).
 *
 * <p>Exception tạo bằng câu viết sẵn (cách cũ) vẫn trả câu đó nguyên văn, kèm mã theo loại exception.
 */
@RestControllerAdvice
@Slf4j
@lombok.RequiredArgsConstructor
public class GlobalExceptionHandler {

    private final com.kpitracking.security.audit.SecurityAuditService securityAudit;
    private final Messages messages;

    /** Ghi 403 vào nhật ký bảo mật kèm đường dẫn: nhiều 403 liên tiếp trên id lạ là dấu hiệu dò IDOR. */
    private void auditDenied(String reason) {
        try {
            var attrs = org.springframework.web.context.request.RequestContextHolder.getRequestAttributes();
            String path = attrs instanceof org.springframework.web.context.request.ServletRequestAttributes sra
                    ? sra.getRequest().getMethod() + " " + sra.getRequest().getRequestURI()
                    : null;
            securityAudit.record(com.kpitracking.security.audit.SecurityAuditEvent.ACCESS_DENIED,
                    com.kpitracking.security.audit.SecurityAuditService.BLOCKED, "HTTP", path, reason);
        } catch (Exception ignored) {
            // nhật ký không được làm hỏng phản hồi lỗi
        }
    }

    /** Lỗi có câu dịch trong messages*.properties. */
    private <T> ResponseEntity<ApiResponse<T>> translated(ErrorCode code, Object... args) {
        return ResponseEntity.status(code.status())
                .body(ApiResponse.error(code.name(), messages.error(code, args)));
    }

    /** Exception có mã thì dịch; tạo bằng constructor cũ (câu viết sẵn) thì trả nguyên văn với mã theo loại. */
    private <T> ResponseEntity<ApiResponse<T>> coded(CodedException ex, ErrorCode legacyCode, String legacyMessage) {
        return ex.getErrorCode() != null
                ? translated(ex.getErrorCode(), ex.getArgs())
                : verbatim(legacyCode, legacyMessage);
    }

    /** Lỗi mang câu viết sẵn (cách cũ) — giữ nguyên câu, chỉ gắn mã. */
    private <T> ResponseEntity<ApiResponse<T>> verbatim(ErrorCode code, String message) {
        return ResponseEntity.status(code.status())
                .body(ApiResponse.error(code.name(), message));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleResourceNotFound(ResourceNotFoundException ex) {
        log.warn("Resource not found: {}", ex.getMessage());
        return coded(ex, ErrorCode.NOT_FOUND, ex.getMessage());
    }

    /** Thiếu hoặc sai kiểu tham số query — trả 400 thay vì để rơi xuống 500. */
    @ExceptionHandler({
            org.springframework.web.bind.MissingServletRequestParameterException.class,
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class
    })
    public ResponseEntity<ApiResponse<Void>> handleBadRequestParam(Exception ex) {
        log.warn("Tham số không hợp lệ: {}", ex.getMessage());
        return translated(ErrorCode.BAD_REQUEST_PARAM);
    }

    /** Người dùng hết hạn mức token AI của tháng — khác với việc nhà cung cấp AI hết credit. */
    @ExceptionHandler(AiTokenQuotaExceededException.class)
    public ResponseEntity<ApiResponse<Void>> handleAiTokenQuota(AiTokenQuotaExceededException ex) {
        log.warn("Hết hạn mức token AI: {}", ex.getMessage());
        return verbatim(ErrorCode.AI_TOKEN_QUOTA_EXCEEDED, ex.getMessage());
    }

    @ExceptionHandler(StaleStateException.class)
    public ResponseEntity<ApiResponse<Void>> handleStaleState(StaleStateException ex) {
        log.warn("Stale state: {}", ex.getMessage());
        return coded(ex, ErrorCode.STALE_STATE, ex.getMessage());
    }

    /** Hai người cùng ghi một bản ghi có @Version (vd. chuỗi duyệt KPI): người sau nhận 409 để tải lại. */
    @ExceptionHandler(org.springframework.orm.ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ApiResponse<Void>> handleOptimisticLock(org.springframework.orm.ObjectOptimisticLockingFailureException ex) {
        log.warn("Optimistic lock conflict: {}", ex.getMessage());
        return translated(ErrorCode.CONCURRENT_UPDATE);
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException ex) {
        log.warn("Business exception: {}", ex.getMessage());
        return coded(ex, ErrorCode.BUSINESS_RULE, ex.getMessage());
    }

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ApiResponse<Void>> handleForbidden(ForbiddenException ex) {
        log.warn("Forbidden: {}", ex.getMessage());
        auditDenied(ex.getMessage());
        return coded(ex, ErrorCode.FORBIDDEN, ex.getMessage());
    }

    @ExceptionHandler(DuplicateResourceException.class)
    public ResponseEntity<ApiResponse<Void>> handleDuplicateResource(DuplicateResourceException ex) {
        log.warn("Duplicate resource: {}", ex.getMessage());
        return coded(ex, ErrorCode.DUPLICATE_RESOURCE, ex.getMessage());
    }

    /**
     * {@code data} là map tên field → câu lỗi, để frontend tô đỏ đúng ô. Lỗi cấp đối tượng (ràng buộc
     * đặt trên cả class) không có field thì dùng tên đối tượng làm khoá.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new LinkedHashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String key = error instanceof FieldError fieldError ? fieldError.getField() : error.getObjectName();
            errors.putIfAbsent(key, error.getDefaultMessage());
        });
        log.warn("Validation failed: {}", errors);
        ApiResponse<Map<String, String>> response = ApiResponse.<Map<String, String>>builder()
                .success(false)
                .code(ErrorCode.VALIDATION_FAILED.name())
                .message(messages.error(ErrorCode.VALIDATION_FAILED))
                .data(errors)
                .timestamp(java.time.Instant.now())
                .build();
        return ResponseEntity.status(ErrorCode.VALIDATION_FAILED.status()).body(response);
    }

    /**
     * Chỉ trả thông điệp của từng ràng buộc, không kèm property path
     * ({@code createUser.request.email: ...}) — path lộ tên method/tham số nội bộ.
     */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConstraintViolation(ConstraintViolationException ex) {
        log.warn("Constraint violation: {}", ex.getMessage());
        String message = ex.getConstraintViolations().stream()
                .map(jakarta.validation.ConstraintViolation::getMessage)
                .distinct()
                .collect(java.util.stream.Collectors.joining("; "));
        return message.isBlank()
                ? translated(ErrorCode.VALIDATION_FAILED)
                : verbatim(ErrorCode.VALIDATION_FAILED, message);
    }

    @ExceptionHandler(AccountLockedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccountLocked(AccountLockedException ex) {
        log.warn("SECURITY login_locked_attempt: {}", ex.getMessage());
        return verbatim(ErrorCode.ACCOUNT_LOCKED, ex.getMessage());
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiResponse<Void>> handleBadCredentials(BadCredentialsException ex) {
        log.warn("Bad credentials: {}", ex.getMessage());
        return translated(ErrorCode.BAD_CREDENTIALS);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiResponse<Void>> handleAuthentication(AuthenticationException ex) {
        log.warn("Authentication failed: {}", ex.getMessage());
        return translated(ErrorCode.AUTHENTICATION_FAILED);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException ex) {
        log.warn("Access denied: {}", ex.getMessage());
        auditDenied("Thiếu quyền (@PreAuthorize): " + ex.getMessage());
        return translated(ErrorCode.ACCESS_DENIED);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse<Void>> handleMaxUploadSize(MaxUploadSizeExceededException ex) {
        log.warn("File size exceeded: {}", ex.getMessage());
        return translated(ErrorCode.FILE_TOO_LARGE);
    }

    /**
     * Không hứa "thử lại sau ít phút": hết hạn mức tháng thì chờ bao lâu cũng không tự hết, phải có người
     * nạp thêm. Câu dịch hướng người dùng tới quản trị viên.
     */
    @ExceptionHandler(AiQuotaExceededException.class)
    public ResponseEntity<ApiResponse<Void>> handleAiQuota(AiQuotaExceededException ex) {
        log.warn("AI quota exceeded: {}", ex.getCause() != null ? ex.getCause().getMessage() : ex.getMessage());
        return translated(ErrorCode.AI_QUOTA_EXHAUSTED);
    }

    @ExceptionHandler(AiRateLimitException.class)
    public ResponseEntity<ApiResponse<Void>> handleAiRateLimit(AiRateLimitException ex) {
        log.warn("AI rate limit hit: {}", ex.getMessage());
        return verbatim(ErrorCode.AI_RATE_LIMITED, ex.getMessage());
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDataIntegrityViolation(org.springframework.dao.DataIntegrityViolationException ex) {
        log.warn("Data integrity violation: {}", ex.getMessage());
        return translated(classifyIntegrityViolation(ex.getMessage()));
    }

    /** Đoán ràng buộc bị vi phạm từ tên constraint trong thông báo của PostgreSQL. */
    private static ErrorCode classifyIntegrityViolation(String detail) {
        if (detail == null
                || !(detail.contains("duplicate key") || detail.contains("violates unique constraint"))) {
            return ErrorCode.DATA_CONFLICT;
        }
        if (detail.contains("users_email_key")) return ErrorCode.USER_EMAIL_EXISTS;
        if (detail.contains("employee_code")) return ErrorCode.EMPLOYEE_CODE_EXISTS;
        if (detail.contains("organizations_name_key") || detail.contains("organizations_name")) {
            return ErrorCode.ORGANIZATION_NAME_EXISTS;
        }
        if (detail.contains("organizations_code_key") || detail.contains("organizations_code")) {
            return ErrorCode.ORGANIZATION_CODE_EXISTS;
        }
        if (detail.contains("idx_org_units_code_unique") || detail.contains("org_units_code_key")) {
            return ErrorCode.ORG_UNIT_CODE_EXISTS;
        }
        if (detail.contains("org_units") && detail.contains("email")) return ErrorCode.ORG_UNIT_EMAIL_EXISTS;
        if (detail.contains("email")) return ErrorCode.EMAIL_EXISTS;
        return ErrorCode.DUPLICATE_DATA;
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneral(Exception ex) {
        log.error("Unexpected error: ", ex);
        return translated(ErrorCode.INTERNAL_ERROR);
    }
}
