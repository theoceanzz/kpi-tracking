package com.kpitracking.dto.response.reward;

import com.kpitracking.enums.CertificateOrientation;
import com.kpitracking.enums.CertificateTemplateStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class CertificateTemplateResponse {

    private UUID id;
    private String name;
    private String preset;
    private CertificateOrientation orientation;

    private String eyebrow;
    private String title;
    private String subtitle;
    private String body;
    private String footnote;

    private String signerName;
    private String signerTitle;
    private String signatureUrl;

    private String logoUrl;
    private String backgroundUrl;

    /** Null = giữ nguyên màu gốc của preset. */
    private String accentColor;
    private String inkColor;
    private String surfaceColor;

    private Boolean showLogo;
    private Boolean showPoints;
    private Boolean showReason;

    private Boolean isDefault;
    private CertificateTemplateStatus status;
    private Integer displayOrder;

    private String createdByName;
    private Instant createdAt;
    private Instant updatedAt;
}
