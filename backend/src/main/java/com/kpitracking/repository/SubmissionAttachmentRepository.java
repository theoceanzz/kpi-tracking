package com.kpitracking.repository;

import com.kpitracking.entity.SubmissionAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SubmissionAttachmentRepository extends JpaRepository<SubmissionAttachment, UUID> {

    List<SubmissionAttachment> findBySubmissionId(UUID submissionId);

    void deleteBySubmissionId(UUID submissionId);
}
