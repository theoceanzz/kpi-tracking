package com.kpitracking.repository;

import com.kpitracking.entity.LandingLead;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.UUID;

public interface LandingLeadRepository extends JpaRepository<LandingLead, UUID> {

    /** Cùng số điện thoại gửi lại trong khoảng thời gian ngắn → coi là trùng, không tạo bản ghi mới. */
    boolean existsByPhoneAndCreatedAtAfter(String phone, Instant after);
}
