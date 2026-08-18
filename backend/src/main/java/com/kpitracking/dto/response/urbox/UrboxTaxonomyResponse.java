package com.kpitracking.dto.response.urbox;

import lombok.Builder;
import lombok.Data;

/** Danh mục hoặc thương hiệu UrBox — hai thứ có cùng hình dạng nên dùng chung một DTO. */
@Data
@Builder
public class UrboxTaxonomyResponse {

    private String id;

    private String name;

    private String imageUrl;

    /** Số quà thuộc thương hiệu. Null với danh mục — UrBox không trả về con số này. */
    private Integer giftCount;
}
