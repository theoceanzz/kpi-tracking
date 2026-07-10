package com.kpitracking.enums;

/**
 * Distinguishes how a KPI criteria is measured and scored.
 * QUANTITATIVE - measured by a numeric target/actual value, auto-scored.
 * QUALITATIVE  - no numeric target; the manager scores it by picking a level
 *                from the organization's qualitative scale.
 */
public enum KpiType {
    QUANTITATIVE,
    QUALITATIVE
}
