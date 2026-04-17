package com.kpitracking.entity;

import com.kpitracking.enums.ScopeCode;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "scopes")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Scope {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "code", nullable = false, unique = true)
    private ScopeCode code;
}
