package com.kpitracking.service.notification;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Chốt chặn cho việc tách chuỗi cha ông từ {@code org_units.path}.
 *
 * <p>Toàn bộ quy tắc "báo đúng một cấp" dựa lên danh sách này: sai thứ tự thì thư đi thẳng
 * lên tổng giám đốc thay vì tổ trưởng, thiếu một cấp thì có đơn vị không bao giờ nhận được
 * thông báo nào. Cả hai lỗi đều không làm gì đổ vỡ nên sẽ không ai phát hiện khi chạy thật.
 */
class NotificationRoutingPathTest {

    @Test
    @DisplayName("Chuỗi cha ông đi từ chính đơn vị lên tới gốc, sâu nhất đứng trước")
    void ancestorPathsGoFromSelfUpToRoot() {
        List<String> chain = NotificationRoutingService.ancestorPaths("/a/b/c/");

        assertEquals(List.of("/a/b/c/", "/a/b/", "/a/"), chain);
    }

    @Test
    @DisplayName("Đơn vị gốc chỉ có chính nó, không có cấp nào ở trên")
    void rootUnitHasOnlyItself() {
        assertEquals(List.of("/a/"), NotificationRoutingService.ancestorPaths("/a/"));
    }

    @Test
    @DisplayName("Đường dẫn UUID thật vẫn tách đúng số cấp")
    void realUuidPathSplitsIntoOneEntryPerLevel() {
        String path = "/11111111-1111-1111-1111-111111111111"
                + "/22222222-2222-2222-2222-222222222222"
                + "/33333333-3333-3333-3333-333333333333/";

        List<String> chain = NotificationRoutingService.ancestorPaths(path);

        assertEquals(3, chain.size());
        assertEquals(path, chain.get(0));
        // Cấp trên luôn là tiền tố THỰC SỰ ngắn hơn — nearestAbove() so sánh độ dài để biết
        // đâu là cấp trên, nên tính chất này phải luôn đúng.
        for (int i = 1; i < chain.size(); i++) {
            assertTrue(chain.get(i - 1).startsWith(chain.get(i)));
            assertTrue(chain.get(i).length() < chain.get(i - 1).length());
        }
    }

    @Test
    @DisplayName("Đường dẫn rỗng hoặc null không làm vỡ luồng gửi thông báo")
    void blankPathYieldsEmptyChain() {
        assertTrue(NotificationRoutingService.ancestorPaths(null).isEmpty());
        assertTrue(NotificationRoutingService.ancestorPaths("").isEmpty());
        assertTrue(NotificationRoutingService.ancestorPaths("   ").isEmpty());
    }

    @Test
    @DisplayName("Đường dẫn thiếu dấu / ở cuối vẫn tách đúng")
    void pathWithoutTrailingSlashStillSplits() {
        assertEquals(List.of("/a/b/", "/a/"), NotificationRoutingService.ancestorPaths("/a/b"));
    }
}
