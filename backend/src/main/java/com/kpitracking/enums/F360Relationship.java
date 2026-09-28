package com.kpitracking.enums;

/** Quan hệ giữa người chấm và người được đánh giá. */
public enum F360Relationship {
    SELF("Tự đánh giá"),
    MANAGER("Cấp trên"),
    PEER("Đồng nghiệp"),
    DIRECT_REPORT("Cấp dưới"),
    OTHER("Phối hợp");

    private final String label;

    F360Relationship(String label) {
        this.label = label;
    }

    /** Nhãn theo ngôn ngữ của request hiện tại ({@code f360.relationship.<MÃ>}); {@link #label} là bản tiếng Việt. */
    public String label() {
        return com.kpitracking.i18n.ErrorMessages.text("f360.relationship." + name(), label);
    }

    /** Ưu tiên khi một người trùng nhiều quan hệ với cùng một người được đánh giá (§5.3). */
    public int priority() {
        return switch (this) {
            case SELF -> 0;
            case MANAGER -> 1;
            case DIRECT_REPORT -> 2;
            case PEER -> 3;
            case OTHER -> 4;
        };
    }
}
