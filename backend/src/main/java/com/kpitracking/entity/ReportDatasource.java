package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;
import org.hibernate.annotations.NotFound;
import org.hibernate.annotations.NotFoundAction;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "report_datasources")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ReportDatasource {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "report_id", nullable = false)
    private Report report;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "datasource_id", nullable = false)
    @NotFound(action = NotFoundAction.IGNORE)
    private Datasource datasource;

    @Column(name = "alias", length = 100)
    private String alias;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
