package com.kpitracking.enums;

/** Lượt chấm mà một tệp minh chứng gắn vào. Khoá đích của từng loại xem V10__evidence_attachments.sql. */
public enum EvidenceTargetType {
    /** Chấm đợt (Evaluation) — khoá "<kpiPeriodId>:<userId>". */
    PERIOD_EVALUATION,
    /** Chốt kỳ (CycleUserEvaluation) — khoá "<kpiCycleId>:<userId>". */
    CYCLE_EVALUATION,
    /** Phiếu hạnh kiểm — khoá "<scope>:<scopeId>:<userId>". */
    CONDUCT_EVALUATION
}
