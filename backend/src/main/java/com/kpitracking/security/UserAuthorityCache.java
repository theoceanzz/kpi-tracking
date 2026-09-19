package com.kpitracking.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.RolePermissionRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Cache in-process (Caffeine) cho danh sách authority của một user — dữ liệu mà
 * {@link CustomUserDetailsService} phải dựng lại trên MỌI request đã đăng nhập bằng
 * 1 + R truy vấn (user_role_org_units + role_permissions cho từng role).
 *
 * <p>Quyền gần như tĩnh (đổi khi gán vai trò / sửa bộ quyền), nên cache với TTL ngắn
 * ({@code app.cache.authorities.ttl-seconds}, mặc định 30 s) và invalidate ngay khi có ghi:
 * <ul>
 *   <li>{@link AuthorityCacheInvalidator} — JPA entity listener trên {@code UserRoleOrgUnit},
 *       {@code RolePermission}, {@code Role}: xoá đúng user hoặc xoá toàn bộ;</li>
 *   <li>các đường ghi dùng {@code @Modifying @Query} (listener không bắt được) gọi
 *       {@link #invalidateAll()} tường minh.</li>
 * </ul>
 * Trên instance KHÁC (khi scale ngang) quyền bị gỡ còn hiệu lực tối đa TTL — chấp nhận được
 * vì access token stateless vốn đã sống 30 phút sau khi gỡ (SECURITY_AUDIT.md X10). Đặt
 * {@code ttl-seconds: 0} để tắt hoàn toàn. Xem docs/DATABASE_SCALING.md C2.
 */
@Slf4j
@Component
public class UserAuthorityCache {

    /** Kết quả cache: authority (ROLE_* + mã quyền) và tổ chức đầu tiên (chỉ để log/MDC). */
    public record Entry(List<String> authorities, UUID organizationId) {}

    /** Cho entity listener (Hibernate tự tạo listener, không qua Spring DI) tìm được bean. */
    private static final AtomicReference<UserAuthorityCache> INSTANCE = new AtomicReference<>();

    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final Cache<UUID, Entry> cache;
    private final boolean enabled;

    public UserAuthorityCache(UserRoleOrgUnitRepository userRoleOrgUnitRepository,
                              RolePermissionRepository rolePermissionRepository,
                              @Value("${app.cache.authorities.ttl-seconds:30}") long ttlSeconds,
                              @Value("${app.cache.authorities.max-entries:50000}") long maxEntries) {
        this.userRoleOrgUnitRepository = userRoleOrgUnitRepository;
        this.rolePermissionRepository = rolePermissionRepository;
        this.enabled = ttlSeconds > 0;
        this.cache = Caffeine.newBuilder()
                .expireAfterWrite(Duration.ofSeconds(Math.max(ttlSeconds, 1)))
                .maximumSize(maxEntries)
                .build();
        INSTANCE.set(this);
        log.info("UserAuthorityCache {} (ttl={}s, maxEntries={})", enabled ? "bật" : "TẮT", ttlSeconds, maxEntries);
    }

    static UserAuthorityCache instance() {
        return INSTANCE.get();
    }

    /** Lấy từ cache; miss thì truy vấn DB (1 + R câu) và ghi vào cache. */
    @Transactional(readOnly = true)
    public Entry get(UUID userId) {
        if (!enabled) return load(userId);
        return cache.get(userId, this::load);
    }

    public void invalidate(UUID userId) {
        if (userId != null) cache.invalidate(userId);
    }

    public void invalidateAll() {
        cache.invalidateAll();
    }

    private Entry load(UUID userId) {
        List<UserRoleOrgUnit> userRoles = userRoleOrgUnitRepository.findByUserId(userId);

        // LinkedHashSet: bỏ trùng nhưng giữ thứ tự (role theo rank, rồi tới mã quyền).
        Set<String> authorities = new LinkedHashSet<>();
        Set<UUID> roleIds = new LinkedHashSet<>();
        for (UserRoleOrgUnit uro : userRoles) {
            authorities.add("ROLE_" + uro.getRole().getName());
            roleIds.add(uro.getRole().getId());
        }
        if (!roleIds.isEmpty()) {
            // Một câu IN cho mọi role thay vì một câu cho từng role.
            rolePermissionRepository.findByRoleIdIn(roleIds)
                    .forEach(rp -> authorities.add(rp.getPermission().getCode()));
        }

        UUID organizationId = userRoles.stream()
                .map(uro -> PermissionChecker.organizationIdOf(uro.getOrgUnit()))
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);

        return new Entry(List.copyOf(authorities), organizationId);
    }
}
