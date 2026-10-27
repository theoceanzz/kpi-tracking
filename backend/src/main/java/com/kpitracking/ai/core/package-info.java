/**
 * Hạ tầng AI dùng chung cho MỌI module: cấu hình mô hình, bộ nhớ hội thoại, luồng một lượt K.AI (route → plan →
 * answer), dựng agent trò chuyện, nhà cung cấp tool, xác nhận trước khi ghi, câu hỏi lại, biểu đồ, khung điền form,
 * ToolRegistry/ToolSupport và các tool chung. Module nghiệp vụ không đặt code vào đây; AI của module X nằm ở ai.x.
 */
package com.kpitracking.ai.core;
