package com.kpitracking.repository;

import com.kpitracking.entity.EmailTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EmailTemplateRepository extends JpaRepository<EmailTemplate, UUID> {

    List<EmailTemplate> findByOrganizationId(UUID organizationId);

    List<EmailTemplate> findByOrganizationIdAndLanguage(UUID organizationId, String language);

    Optional<EmailTemplate> findByOrganizationIdAndTemplateCodeAndLanguage(UUID organizationId, String templateCode, String language);

    void deleteByOrganizationIdAndTemplateCodeAndLanguage(UUID organizationId, String templateCode, String language);
}
