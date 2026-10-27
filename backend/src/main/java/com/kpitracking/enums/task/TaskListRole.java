package com.kpitracking.enums.task;

/** Vai trò trong một danh sách công việc. Thứ tự = mức quyền (cao nhất thắng khi một người có nhiều đường vào). */
public enum TaskListRole {
    VIEWER, EDITOR, OWNER;

    public boolean atLeast(TaskListRole other) {
        return ordinal() >= other.ordinal();
    }

    public static TaskListRole max(TaskListRole a, TaskListRole b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.ordinal() >= b.ordinal() ? a : b;
    }
}
