package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Đăng ký tư vấn / dùng thử gửi từ form cuối trang giới thiệu. Không thuộc organization nào
 * (người gửi chưa là khách hàng), không xoá mềm — sale xử lý bằng {@link #status}.
 */
@Entity
@Table(name = "landing_leads")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class LandingLead {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "full_name", nullable = false, length = 120)
    private String fullName;

    @Column(name = "phone", nullable = false, length = 20)
    private String phone;

    @Column(name = "email", length = 160)
    private String email;

    @Column(name = "company", length = 200)
    private String company;

    /** Khoảng quy mô nhân sự: {@code <50}, {@code 50-200}, {@code 200-500}, {@code >500}. */
    @Column(name = "headcount", length = 20)
    private String headcount;

    @Column(name = "note", length = 1000)
    private String note;

    @Column(name = "source", length = 60)
    private String source;

    @Column(name = "client_ip", length = 64)
    private String clientIp;

    @Builder.Default
    @Column(name = "status", nullable = false, length = 20)
    private String status = "NEW";

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
