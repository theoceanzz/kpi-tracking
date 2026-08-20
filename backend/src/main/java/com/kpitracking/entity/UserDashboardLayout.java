package com.kpitracking.entity;

import com.kpitracking.enums.DashboardScope;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_dashboard_layouts")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UserDashboardLayout {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "scope", nullable = false, length = 20)
    private DashboardScope scope;

    /**
     * Mảng JSON [{i, x, y, w, h, visible}]. Lưu nguyên văn — server không diễn giải nội dung
     * để danh mục widget ở frontend đổi được mà không cần migration.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "layout", nullable = false, columnDefinition = "jsonb")
    @Builder.Default
    private String layout = "[]";

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;
}
