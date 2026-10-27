package com.kpitracking.service.reward;

import com.kpitracking.dto.response.reward.RewardCelebrationResponse;
import com.kpitracking.enums.reward.RewardCelebrationSource;
import com.kpitracking.security.JwtTokenProvider;
import com.kpitracking.service.CollabITSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.after;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * API ăn mừng ({@link RewardCelebrationService}: {@code GET/POST /rewards/me/celebrations[/ack]}) trên PostgreSQL
 * THẬT (DB dev đã chạy Flyway tới V44). Dữ liệu thưởng chèn thẳng bằng SQL rồi xoá ở {@code @AfterEach}, kể cả
 * dòng sổ cái — số dư ví không bị đụng, nên đối soát ví vẫn khớp sau khi dọn.
 *
 * <p>Chạy tay: {@code ./mvnw test -Dtest=RewardCelebrationIT}.
 */
@AutoConfigureMockMvc
class RewardCelebrationIT extends CollabITSupport {

    @Autowired RewardCelebrationService service;
    @Autowired MockMvc mvc;
    @Autowired JwtTokenProvider jwt;
    @Autowired RewardRedemptionTx redemptionTx;
    /** Bắt tín hiệu WebSocket thay vì đẩy thật. */
    @MockBean SimpMessagingTemplate messagingTemplate;

    private Boolean rewardWasEnabled;
    private final List<UUID> grants = new ArrayList<>();
    private final List<UUID> transactions = new ArrayList<>();
    private final List<UUID> wallets = new ArrayList<>();
    private final List<UUID> gifts = new ArrayList<>();
    private final List<UUID> programs = new ArrayList<>();

    @BeforeEach
    void enableReward() {
        rewardWasEnabled = jdbc.queryForObject("SELECT enable_reward FROM organizations WHERE id = ?", Boolean.class, orgId);
        jdbc.update("UPDATE organizations SET enable_reward = TRUE WHERE id = ?", orgId);
    }

    @AfterEach
    void cleanup() {
        for (UUID g : grants) jdbc.update("DELETE FROM reward_grants WHERE id = ?", g);
        for (UUID p : programs) jdbc.update("DELETE FROM reward_programs WHERE id = ?", p);
        for (UUID g : gifts) {
            jdbc.update("DELETE FROM notifications WHERE reference_id IN (SELECT id FROM reward_redemptions WHERE gift_item_id = ?)", g);
            jdbc.update("DELETE FROM reward_redemptions WHERE gift_item_id = ?", g);
            jdbc.update("DELETE FROM reward_gift_items WHERE id = ?", g);
        }
        for (UUID t : transactions) jdbc.update("DELETE FROM reward_transactions WHERE id = ?", t);
        for (UUID w : wallets) jdbc.update("DELETE FROM reward_wallets WHERE id = ?", w);
        jdbc.update("UPDATE organizations SET enable_reward = ? WHERE id = ?", rewardWasEnabled, orgId);
    }

    // ── Thưởng tay ─────────────────────────────────────────────────────────

    @Test
    void approvedGrant_isListed_thenAckRemovesIt_andSecondAckIsNoOp() {
        UUID grant = grant(head, "APPROVED", Instant.now(), true, employee);

        loginAs(employee);
        List<RewardCelebrationResponse> list = mine();
        assertThat(list).singleElement().satisfies(c -> {
            assertThat(c.getSource()).isEqualTo(RewardCelebrationSource.GRANT);
            assertThat(c.getRefId()).isEqualTo(grant);
            assertThat(c.getPoints()).isEqualTo(40);
            assertThat(c.getReason()).isEqualTo("IT ăn mừng");
            assertThat(c.isCertificate()).isTrue();
            // Giấy khen kèm đề nghị — chỉ dòng của chính người xem.
            assertThat(c.getGrant()).isNotNull();
            assertThat(c.getGrant().getRecipients()).extracting("userId").containsExactly(employee);
        });

        assertThat(service.acknowledge(List.of(grant))).isEqualTo(1);
        assertThat(mine()).isEmpty();
        // Ack trùng (tab khác, máy khác, bấm lại): không đổi gì, không lỗi.
        assertThat(service.acknowledge(List.of(grant))).isZero();
    }

    @Test
    void revokedBeforeSeen_isNeverCelebrated() {
        UUID grant = grant(head, "APPROVED", Instant.now(), false, employee);
        jdbc.update("UPDATE reward_grants SET status = 'REVOKED' WHERE id = ?", grant);

        loginAs(employee);
        assertThat(mine()).isEmpty();
    }

    @Test
    void pendingOrRejectedGrant_isNotListed() {
        grant(head, "PENDING_APPROVAL", null, false, employee);
        grant(head, "REJECTED", null, false, employee);

        loginAs(employee);
        assertThat(mine()).isEmpty();
    }

    @Test
    void grantorWhoIsAlsoRecipient_isCelebratedLikeAnyRecipient() {
        UUID grant = grant(head, "APPROVED", Instant.now(), false, head, employee);

        loginAs(head);
        assertThat(mine()).extracting(RewardCelebrationResponse::getRefId).containsExactly(grant);
        loginAs(employee);
        assertThat(mine()).extracting(RewardCelebrationResponse::getRefId).containsExactly(grant);
    }

    @Test
    void ackOnlyTouchesOwnRows() {
        UUID grant = grant(head, "APPROVED", Instant.now(), false, employee);

        loginAs(colleague);
        assertThat(service.acknowledge(List.of(grant))).isZero();

        loginAs(employee);
        assertThat(mine()).hasSize(1);
    }

    @Test
    void olderThanWindow_isNotListed() {
        grant(head, "APPROVED", Instant.now().minus(RewardCelebrationService.WINDOW).minus(Duration.ofDays(1)), false, employee);

        loginAs(employee);
        assertThat(mine()).isEmpty();
    }

    @Test
    void rewardDisabled_returnsEmpty() {
        grant(head, "APPROVED", Instant.now(), false, employee);
        jdbc.update("UPDATE organizations SET enable_reward = FALSE WHERE id = ?", orgId);

        loginAs(employee);
        assertThat(mine()).isEmpty();
    }

    // ── Chương trình tự động ───────────────────────────────────────────────

    @Test
    void issuedRun_isListed_revertedRun_isNot() {
        UUID issued = run("ISSUED", employee);
        run("REVERTED", employee);

        loginAs(employee);
        assertThat(mine()).singleElement().satisfies(c -> {
            assertThat(c.getSource()).isEqualTo(RewardCelebrationSource.PROGRAM_RUN);
            assertThat(c.getRefId()).isEqualTo(issued);
            assertThat(c.getProgramName()).isEqualTo("IT chương trình");
            assertThat(c.getRank()).isEqualTo(1);
        });
        assertThat(service.acknowledge(List.of(issued))).isEqualTo(1);
        assertThat(mine()).isEmpty();
    }

    // ── Đổi quà ────────────────────────────────────────────────────────────

    @Test
    void redemptionSettledByOthers_isListed_selfSettledOrPending_isNot() {
        UUID gift = gift();
        UUID deliveredByTeam = redemption(gift, "DELIVERED", null);
        redemption(gift, "DELIVERED", Instant.now()); // giao ngay trong request của chính người đổi
        redemption(gift, "PENDING", null);
        redemption(gift, "REJECTED", null);

        loginAs(employee);
        assertThat(mine()).singleElement().satisfies(c -> {
            assertThat(c.getSource()).isEqualTo(RewardCelebrationSource.REDEMPTION);
            assertThat(c.getRefId()).isEqualTo(deliveredByTeam);
            assertThat(c.getGiftName()).isEqualTo("IT quà");
        });
    }

    @Test
    void approvedThenDelivered_isCelebratedOnce() {
        UUID r = redemption(gift(), "APPROVED", null);

        loginAs(employee);
        assertThat(service.acknowledge(List.of(r))).isEqualTo(1);
        jdbc.update("UPDATE reward_redemptions SET status = 'DELIVERED', delivered_at = NOW() WHERE id = ?", r);
        assertThat(mine()).isEmpty();
    }

    @Test
    void voucherIssuedWhileOwnerWatching_isMarkedCelebrated_andSendsNoSignal() {
        UUID r = redemption(gift(), "PENDING", null);

        redemptionTx.settleSuccess(r, "ext-1", Map.of(), true);

        assertThat(jdbc.queryForObject("SELECT celebrated_at FROM reward_redemptions WHERE id = ?", Timestamp.class, r))
                .isNotNull();
        verify(messagingTemplate, after(1500).never())
                .convertAndSendToUser(eq(emailOf(employee)), eq("/queue/celebrations"), any());
    }

    @Test
    void voucherIssuedLaterByGiftTeam_staysUncelebrated_andSignalsOwner() {
        UUID r = redemption(gift(), "PENDING", null);

        redemptionTx.settleSuccess(r, "ext-2", Map.of(), false);

        assertThat(jdbc.queryForObject("SELECT celebrated_at FROM reward_redemptions WHERE id = ?", Timestamp.class, r))
                .isNull();
        verify(messagingTemplate, timeout(5000))
                .convertAndSendToUser(eq(emailOf(employee)), eq("/queue/celebrations"), any());
        loginAs(employee);
        assertThat(mine()).extracting(RewardCelebrationResponse::getRefId).containsExactly(r);
    }

    // ── HTTP: đường dẫn, quyền, kiểm tra đầu vào ───────────────────────────

    @Test
    void http_listThenAck_isIdempotent() throws Exception {
        UUID grant = grant(head, "APPROVED", Instant.now(), false, employee);
        String bearer = "Bearer " + jwt.generateAccessToken(emailOf(employee), List.of());

        mvc.perform(get("/api/v1/rewards/me/celebrations").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].source").value("GRANT"))
                .andExpect(jsonPath("$.data[0].refId").value(grant.toString()))
                .andExpect(jsonPath("$.data[0].points").value(40));

        String body = "{\"refIds\":[\"" + grant + "\"]}";
        mvc.perform(post("/api/v1/rewards/me/celebrations/ack").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(1));
        mvc.perform(post("/api/v1/rewards/me/celebrations/ack").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(0));
        mvc.perform(get("/api/v1/rewards/me/celebrations").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isEmpty());
    }

    @Test
    void http_ackWithoutIds_isRejected() throws Exception {
        String bearer = "Bearer " + jwt.generateAccessToken(emailOf(employee), List.of());
        mvc.perform(post("/api/v1/rewards/me/celebrations/ack").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"refIds\":[]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void http_anonymous_isRejected() throws Exception {
        int code = mvc.perform(get("/api/v1/rewards/me/celebrations")).andReturn().getResponse().getStatus();
        assertThat(code).isIn(401, 403);
    }

    private String emailOf(UUID userId) {
        return userRepository.findById(userId).orElseThrow().getEmail();
    }

    // ── Dữ liệu ────────────────────────────────────────────────────────────

    private List<RewardCelebrationResponse> mine() {
        return service.listMine();
    }

    /** Đề nghị thưởng 40 điểm/người; trạng thái APPROVED thì mỗi người nhận có một dòng sổ cái. */
    private UUID grant(UUID grantor, String status, Instant approvedAt, boolean certificate, UUID... recipients) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO reward_grants (id, organization_id, org_unit_id, grantor_user_id, total_points, reason, status,
                                           approval_mode, approved_at, certificate_enabled)
                VALUES (?, ?, ?, ?, ?, 'IT ăn mừng', ?, 'AUTO', ?, ?)""",
                id, orgId, unitId, grantor, 40 * recipients.length, status,
                approvedAt == null ? null : Timestamp.from(approvedAt), certificate);
        grants.add(id);
        for (UUID user : recipients) {
            UUID tx = "APPROVED".equals(status) ? ledger(user, "grant:" + id) : null;
            jdbc.update("INSERT INTO reward_grant_items (grant_id, user_id, points, transaction_id) VALUES (?, ?, 40, ?)",
                    id, user, tx);
        }
        return id;
    }

    private UUID run(String status, UUID user) {
        UUID program = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO reward_programs (id, organization_id, name, scope, kpi_period_id, tiers)
                VALUES (?, ?, 'IT chương trình', 'PERIOD', ?, '[]'::jsonb)""", program, orgId, periodId);
        programs.add(program);
        UUID run = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO reward_program_runs (id, program_id, organization_id, kpi_period_id, status, executed_at)
                VALUES (?, ?, ?, ?, ?, NOW())""", run, program, orgId, periodId, status);
        jdbc.update("""
                INSERT INTO reward_program_run_items (run_id, user_id, rank, order_index, points, transaction_id)
                VALUES (?, ?, 1, 1, 25, ?)""", run, user, ledger(user, "run:" + run));
        return run;
    }

    private UUID gift() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO reward_gift_items (id, organization_id, name, point_cost) VALUES (?, ?, 'IT quà', 10)",
                id, orgId);
        gifts.add(id);
        return id;
    }

    private UUID redemption(UUID gift, String status, Instant celebratedAt) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO reward_redemptions (id, organization_id, user_id, gift_item_id, gift_name_snapshot, points_spent,
                                                status, handled_at, celebrated_at)
                VALUES (?, ?, ?, ?, 'IT quà', 10, ?, NOW(), ?)""",
                id, orgId, employee, gift, status, celebratedAt == null ? null : Timestamp.from(celebratedAt));
        return id;
    }

    /**
     * Một dòng sổ cái để {@code transaction_id} trỏ vào (khoá ngoại). Số dư ví KHÔNG đổi: dòng bị xoá khi dọn,
     * ví mượn tạm (nếu người đó chưa có) cũng bị xoá.
     */
    private UUID ledger(UUID user, String key) {
        UUID wallet = jdbc.queryForList("SELECT id FROM reward_wallets WHERE organization_id = ? AND user_id = ? LIMIT 1",
                UUID.class, orgId, user).stream().findFirst().orElseGet(() -> {
                    UUID w = UUID.randomUUID();
                    jdbc.update("INSERT INTO reward_wallets (id, organization_id, user_id) VALUES (?, ?, ?)", w, orgId, user);
                    wallets.add(w);
                    return w;
                });
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO reward_transactions (id, wallet_id, organization_id, user_id, amount, type, source_type,
                                                 idempotency_key, balance_after)
                VALUES (?, ?, ?, ?, 1, 'EARN', 'SYSTEM', ?, 0)""", id, wallet, orgId, user, "it-celebration:" + key + ":" + user);
        transactions.add(id);
        return id;
    }
}
