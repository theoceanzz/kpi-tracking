package com.kpitracking.event;

import java.util.UUID;

/** Một tài liệu cần (nạp lại) vào kho tri thức. Phát trong giao dịch ghi; xử lý SAU commit. */
public record DocumentIndexRequestedEvent(UUID documentId) {}
