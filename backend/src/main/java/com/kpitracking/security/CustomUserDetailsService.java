package com.kpitracking.security;

import com.kpitracking.entity.User;
import com.kpitracking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;
    private final UserAuthorityCache userAuthorityCache;

    public CustomUserDetailsService(UserRepository userRepository, UserAuthorityCache userAuthorityCache) {
        this.userRepository = userRepository;
        this.userAuthorityCache = userAuthorityCache;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        // Luôn đọc users (1 câu): mật khẩu / trạng thái khoá phải có hiệu lực ngay, không cache.
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with email: " + email));

        // Vai trò + mã quyền: lấy từ UserAuthorityCache (Caffeine, TTL ngắn, invalidate khi gán
        // role / sửa bộ quyền). Trước đây mỗi request tốn 1 + R truy vấn cho phần này.
        UserAuthorityCache.Entry entry = userAuthorityCache.get(user.getId());

        List<GrantedAuthority> authorities = new java.util.ArrayList<>(entry.authorities().size() + 1);
        for (String code : entry.authorities()) {
            authorities.add(new SimpleGrantedAuthority(code));
        }

        // If no authorities assigned, give a default role
        if (authorities.isEmpty()) {
            authorities.add(new SimpleGrantedAuthority("ROLE_USER"));
        }

        return new AppUserPrincipal(
                user.getEmail(),
                user.getPassword(),
                user.getStatus() == com.kpitracking.enums.UserStatus.ACTIVE,
                authorities,
                user.getId(),
                // Tổ chức của vai trò đầu tiên — chỉ để ghi MDC/log, không dùng cho phân quyền.
                entry.organizationId()
        );
    }
}
