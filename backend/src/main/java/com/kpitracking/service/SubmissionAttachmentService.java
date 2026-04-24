package com.kpitracking.service;

import com.kpitracking.dto.response.submission.AttachmentResponse;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.entity.SubmissionAttachment;
import com.kpitracking.entity.User;
import com.kpitracking.enums.StorageProvider;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.SubmissionMapper;
import com.kpitracking.repository.KpiSubmissionRepository;
import com.kpitracking.repository.SubmissionAttachmentRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class SubmissionAttachmentService {

    private final SubmissionAttachmentRepository attachmentRepository;
    private final KpiSubmissionRepository submissionRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final CloudinaryStorageService cloudinaryStorageService;
    private final SubmissionMapper submissionMapper;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }
    
    private boolean hasRole(UUID userId, String roleName) {
        return userRoleOrgUnitRepository.findByUserId(userId).stream()
                .anyMatch(uro -> uro.getRole().getName().equalsIgnoreCase(roleName));
    }

    @Transactional
    public List<AttachmentResponse> uploadAttachments(UUID submissionId, MultipartFile[] files) throws IOException {
        User currentUser = getCurrentUser();

        KpiSubmission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Submission", "id", submissionId));

        if (!submission.getSubmittedBy().getId().equals(currentUser.getId())) {
            throw new com.kpitracking.exception.ForbiddenException("Only the original submitter can upload attachments");
        }
        if (submission.getStatus() != com.kpitracking.enums.SubmissionStatus.PENDING) {
            throw new com.kpitracking.exception.BusinessException("Can only upload attachments to PENDING submissions");
        }

        List<AttachmentResponse> responses = new ArrayList<>();

        for (MultipartFile file : files) {
            String folder = "submissions/" + submissionId;
            java.util.Map<String, String> uploadInfo = cloudinaryStorageService.uploadFile(file, folder);

            SubmissionAttachment attachment = SubmissionAttachment.builder()
                    .submission(submission)
                    .fileName(file.getOriginalFilename())
                    .fileUrl(uploadInfo.get("url"))
                    .fileSize(file.getSize())
                    .contentType(file.getContentType())
                    .storageProvider(StorageProvider.CLOUDINARY)
                    .storageKey(uploadInfo.get("public_id"))
                    .uploadedBy(currentUser)
                    .build();

            attachment = attachmentRepository.save(attachment);
            responses.add(submissionMapper.toAttachmentResponse(attachment));
        }

        return responses;
    }

    @Transactional(readOnly = true)
    public List<AttachmentResponse> getAttachments(UUID submissionId) {
        User currentUser = getCurrentUser();

        KpiSubmission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Submission", "id", submissionId));

        boolean isSubmitter = submission.getSubmittedBy().getId().equals(currentUser.getId());
        boolean isDirector = hasRole(currentUser.getId(), "DIRECTOR");
        boolean isHead = hasRole(currentUser.getId(), "HEAD");
        
        if (!isSubmitter && !isDirector && !isHead) {
             throw new com.kpitracking.exception.ForbiddenException("You can only view attachments for your own or authorized submissions");
        }

        List<SubmissionAttachment> attachments = attachmentRepository.findBySubmissionId(submissionId);
        return submissionMapper.toAttachmentResponseList(attachments);
    }

    @Transactional
    public void deleteAttachment(UUID attachmentId) {
        User currentUser = getCurrentUser();
        SubmissionAttachment attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Attachment", "id", attachmentId));

        if (!attachment.getUploadedBy().getId().equals(currentUser.getId())) {
             throw new com.kpitracking.exception.ForbiddenException("Only the user who uploaded the attachment can delete it");
        }

        if (attachment.getSubmission().getStatus() != com.kpitracking.enums.SubmissionStatus.PENDING) {
             throw new com.kpitracking.exception.BusinessException("Cannot delete attachments from non-pending submissions");
        }

        if (attachment.getStorageKey() != null) {
            cloudinaryStorageService.deleteFile(attachment.getStorageKey());
        }

        attachmentRepository.delete(attachment);
    }
}
