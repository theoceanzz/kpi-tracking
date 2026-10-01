package com.kpitracking.ai.document.ingest;

import com.kpitracking.ai.document.model.Block;
import com.kpitracking.ai.document.model.DocumentSection;
import com.kpitracking.ai.document.profile.DocumentKind;
import com.kpitracking.ai.document.profile.DocumentProfile;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;

/**
 * Chỉ bộ hướng dẫn KeyGo: gắn {@code route}/{@code roles} khi tiêu đề mục hoặc chú thích ảnh khớp danh mục
 * màn hình — câu trả lời trợ giúp đưa được đường dẫn "mở ở đâu".
 */
@Component
@Order(20)
@RequiredArgsConstructor
public class GuideRouteEnricher implements SectionEnricher {

    private final GuideScreenIndex guideScreens;

    @Override
    public boolean appliesTo(DocumentProfile profile) {
        return profile.kind() == DocumentKind.GUIDE;
    }

    @Override
    public void enrich(Context ctx, DocumentSection section, Map<String, Object> metadata) {
        guideScreens.match(section.title())
                .or(() -> section.images().stream()
                        .map(Block.Picture::caption)
                        .filter(c -> c != null && !c.isBlank())
                        .map(guideScreens::match)
                        .filter(Optional::isPresent).map(Optional::get).findFirst())
                .ifPresent(screen -> {
                    metadata.put("route", screen.route());
                    if (screen.role() != null) metadata.put("roles", screen.role());
                });
    }
}
