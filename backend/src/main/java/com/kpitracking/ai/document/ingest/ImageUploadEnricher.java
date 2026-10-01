package com.kpitracking.ai.document.ingest;

import com.kpitracking.ai.document.model.Block;
import com.kpitracking.ai.document.model.DocumentSection;
import com.kpitracking.ai.document.store.RagImageStore;
import com.kpitracking.entity.RagAsset;
import com.kpitracking.repository.RagAssetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

/**
 * Tải ảnh của mục lên kho ảnh (mỗi ảnh ĐÚNG MỘT LẦN theo băm nội dung — nạp lại cùng tài liệu không tải lại),
 * ghi {@code images} + {@code captions} vào metadata để câu trả lời hiện được ảnh chụp màn hình.
 */
@Component
@Order(10)
@RequiredArgsConstructor
public class ImageUploadEnricher implements SectionEnricher {

    private final RagAssetRepository assets;
    private final RagImageStore imageStore;

    @Override
    public void enrich(Context ctx, DocumentSection section, Map<String, Object> metadata) throws Exception {
        if (section.images().isEmpty()) return;
        List<String> urls = new ArrayList<>();
        List<String> captions = new ArrayList<>();
        for (Block.Picture img : section.images()) {
            urls.add(uploadOnce(img));
            captions.add(img.caption() == null ? "" : img.caption());
        }
        metadata.put("images", String.join(RagMetadata.SEP, urls));
        metadata.put("captions", String.join(RagMetadata.SEP, captions));
        ctx.addImages(urls.size());
    }

    private String uploadOnce(Block.Picture img) throws Exception {
        String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(img.bytes()));
        RagAsset existing = assets.findById(hash).orElse(null);
        if (existing != null) return existing.getUrl();
        String url = imageStore.store(img.bytes(), img.fileName(), hash);
        assets.save(RagAsset.builder().contentSha256(hash).url(url).publicId(hash).build());
        return url;
    }
}
