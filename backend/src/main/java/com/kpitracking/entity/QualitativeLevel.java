package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "qualitative_levels")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QualitativeLevel {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Column(nullable = false)
    private String name;

    /** The reference score value for this level (e.g. 0, 2, 3, 3.5, 4.5). */
    @Column(name = "level_value", nullable = false)
    private Double value;

    /** The column position in the reference sheet (1..N). "position" is a reserved word in SQL. */
    @Column(name = "position_index", nullable = false)
    private Integer position;

    private String color;
}
