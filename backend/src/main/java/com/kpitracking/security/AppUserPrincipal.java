package com.kpitracking.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.User;

import java.util.Collection;
import java.util.UUID;

/**
 * Principal mang thêm {@code userId} và {@code organizationId} — dữ liệu đã được
 * {@link CustomUserDetailsService} nạp sẵn khi xác thực, nên lấy ra để ghi MDC không tốn thêm query.
 * Kế thừa {@link User} để mọi chỗ đang cast sang {@code UserDetails} không đổi.
 */
public class AppUserPrincipal extends User {

    private final UUID userId;
    private final UUID organizationId;

    public AppUserPrincipal(String username, String password, boolean enabled,
                            Collection<? extends GrantedAuthority> authorities,
                            UUID userId, UUID organizationId) {
        super(username, password, enabled, true, true, true, authorities);
        this.userId = userId;
        this.organizationId = organizationId;
    }

    public UUID getUserId() {
        return userId;
    }

    /** Tổ chức của vai trò đầu tiên; {@code null} với người chưa vào đơn vị nào / platform admin. */
    public UUID getOrganizationId() {
        return organizationId;
    }
}
