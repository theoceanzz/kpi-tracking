package com.kpitracking.repository;

import com.kpitracking.entity.TaskSavedView;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface TaskSavedViewRepository extends JpaRepository<TaskSavedView, UUID> {

    /** Chế độ xem của tôi + chế độ xem được chia sẻ trong các danh sách tôi là thành viên. */
    @Query("SELECT v FROM TaskSavedView v WHERE v.ownerId = :me OR (v.shared = true AND v.listId IN :listIds) " +
           "ORDER BY v.sortOrder, v.createdAt")
    List<TaskSavedView> visibleTo(@Param("me") UUID me, @Param("listIds") Collection<UUID> listIds);

    long countByOwnerId(UUID ownerId);
}
