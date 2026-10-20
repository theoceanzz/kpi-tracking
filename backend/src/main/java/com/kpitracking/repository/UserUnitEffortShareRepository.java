package com.kpitracking.repository;

import com.kpitracking.entity.UserUnitEffortShare;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface UserUnitEffortShareRepository extends JpaRepository<UserUnitEffortShare, UserUnitEffortShare.Key> {

    List<UserUnitEffortShare> findByUserId(UUID userId);

    @Modifying
    @Query("DELETE FROM UserUnitEffortShare s WHERE s.userId = :userId")
    void deleteAllByUserId(@Param("userId") UUID userId);
}
