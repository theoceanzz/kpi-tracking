package com.kpitracking.dto.response.wallet;

import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CashWalletResponse {

    private UUID id;
    private UUID userId;
    private String fullName;
    private String email;
    private String employeeCode;
    private String avatarUrl;

    /** Số dư tính bằng đồng. */
    private Long balance;
    private Long lifetimeTopup;
    private Long lifetimeConverted;

    /** Tỉ giá hiện hành của tổ chức: số đồng đổi được 1 điểm. */
    private Long pointExchangeRate;

    /** Số điểm đổi được với số dư hiện tại, tức floor(balance / rate). */
    private Integer convertiblePoints;
}
