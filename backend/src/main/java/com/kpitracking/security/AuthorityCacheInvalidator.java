package com.kpitracking.security;

import com.kpitracking.entity.Role;
import com.kpitracking.entity.RolePermission;
import com.kpitracking.entity.UserRoleOrgUnit;
import jakarta.persistence.PostPersist;
import jakarta.persistence.PostRemove;
import jakarta.persistence.PostUpdate;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * JPA entity listener: mọi thay đổi trên bảng gán vai trò / bộ quyền / vai trò đều làm cache
 * quyền ({@link UserAuthorityCache}) của user liên quan hết hạn ngay trên instance này.
 *
 * <p>Gắn bằng {@code @EntityListeners(AuthorityCacheInvalidator.class)} trên
 * {@code UserRoleOrgUnit}, {@code RolePermission}, {@code Role}. Hibernate tự khởi tạo listener
 * nên không inject được bean — lấy qua {@link UserAuthorityCache#instance()}.
 *
 * <p>KHÔNG bắt được các câu {@code @Modifying @Query} (UPDATE/DELETE bulk): chỗ nào dùng chúng
 * trên ba bảng này phải gọi {@code invalidateAll()} tường minh (xem
 * {@code PermissionService.removePermissionFromRole}). Các derived delete
 * ({@code deleteByUserId}, {@code deleteByRoleId}...) nạp entity rồi xoá từng dòng nên vẫn qua
 * listener.
 */
public class AuthorityCacheInvalidator {

    @PostPersist
    @PostUpdate
    @PostRemove
    public void onChange(Object entity) {
        UserAuthorityCache cache = UserAuthorityCache.instance();
        if (cache == null) return; // context chưa lên (ví dụ lúc chạy migration/seed)

        Runnable evict;
        if (entity instanceof UserRoleOrgUnit uro) {
            // Chỉ một user bị ảnh hưởng.
            java.util.UUID userId = uro.getUser() != null ? uro.getUser().getId() : null;
            evict = () -> cache.invalidate(userId);
        } else if (entity instanceof RolePermission || entity instanceof Role) {
            // Đổi bộ quyền / đổi tên vai trò ảnh hưởng mọi user mang vai trò đó — không có
            // index ngược trong cache, xoá toàn bộ (hiếm, rẻ: cache dựng lại theo từng request).
            evict = cache::invalidateAll;
        } else {
            return;
        }

        // Listener chạy lúc flush, TRƯỚC commit. Xoá ngay thì một request khác chen vào giữa
        // flush và commit vẫn đọc được dữ liệu cũ (read committed) và nạp lại cache bằng dữ liệu
        // cũ. Vì thế xoá cả hai lần: ngay bây giờ và sau khi commit.
        evict.run();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    evict.run();
                }
            });
        }
    }
}
