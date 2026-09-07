package com.kpitracking.service.reward;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.dto.request.reward.RewardCheckinConfigRequest;
import com.kpitracking.dto.request.reward.RewardCheckinConfigRequest.StreakBonus;
import com.kpitracking.dto.response.reward.RewardCheckinConfigResponse;
import com.kpitracking.dto.response.reward.RewardCheckinStatusResponse;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.RewardCheckin;
import com.kpitracking.entity.RewardCheckinConfig;
import com.kpitracking.entity.RewardTransaction;
import com.kpitracking.entity.User;
import com.kpitracking.enums.RewardSourceType;
import com.kpitracking.enums.RewardTransactionType;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.RewardCheckinConfigRepository;
import com.kpitracking.repository.RewardCheckinRepository;
import com.kpitracking.service.RewardWalletService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Điểm danh hàng ngày: nhân viên tự bấm một lần mỗi ngày để nhận điểm, sếp cấu hình
 * mức điểm và các mốc thưởng chuỗi ở tab "Điểm danh" trong Quản lý thưởng điểm.
 *
 * <h2>Luật tính chuỗi</h2>
 * Chuỗi tăng khi lần điểm danh gần nhất rơi đúng vào NGÀY LÀM VIỆC LIỀN TRƯỚC, ngược
 * lại chuỗi bắt đầu lại từ 1. "Ngày làm việc liền trước" phụ thuộc {@code skipWeekends}:
 * bật thì thứ hai nối tiếp thứ sáu, nghỉ cuối tuần không làm đứt chuỗi. Đây là lý do
 * luật phải nằm ở server chứ không chép sang giao diện — hai bên lệch nhau thì nhân
 * viên thấy một con số trước khi bấm và một con số khác sau khi bấm.
 *
 * <p>Khi có {@code streakCycleDays}, chuỗi vẫn đếm thẳng ({@code streakLength}) nhưng
 * mốc thưởng khớp theo vị trí trong chu kỳ ({@code streakDay = ((length-1) % cycle) + 1}),
 * nhờ vậy các mốc lặp lại đều đặn thay vì chỉ trúng đúng một lần trong đời.
 *
 * <h2>Chống điểm danh trùng</h2>
 * Ba lớp, từ ngoài vào: kiểm tra dòng nhật ký của hôm nay → khoá chống ghi trùng
 * {@code checkin:{userId}:{date}} ở sổ cái → unique index {@code (org, user, ngày)}.
 * Lớp một xử lý mọi trường hợp thực tế; hai lớp sau chỉ bắt hai request chạy song song
 * khít nhau, và khi chúng kích hoạt thì transaction bị huỷ trọn vẹn — không có trường
 * hợp nào phát điểm hai lần mà chỉ ghi một dòng nhật ký.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RewardCheckinService {

    /** Ngày "hôm nay" phải theo giờ Việt Nam, không theo UTC của server. */
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    /** Số ngày vẽ trên dải chấm ở màn hình nhân viên. */
    private static final int RECENT_DAYS = 14;

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final RewardCheckinConfigRepository configRepository;
    private final RewardCheckinRepository checkinRepository;
    private final OrganizationRepository organizationRepository;
    private final RewardWalletService walletService;
    private final RewardContext context;

    public static LocalDate today() {
        return LocalDate.now(ZONE);
    }

    // ── Cấu hình (REWARD:CONFIG) ────────────────────────────────────────────

    /**
     * Cấu hình hiện hành của tổ chức. Tổ chức chưa từng lưu thì trả về bản MẶC ĐỊNH
     * (tắt, 10 điểm/ngày) với {@code id = null} — form vẫn dựng được, và không tạo
     * bản ghi rác cho tổ chức không dùng tính năng này.
     */
    @Transactional(readOnly = true)
    public RewardCheckinConfigResponse getConfig() {
        UUID orgId = context.getCurrentOrgId();
        return toConfigResponse(loadConfig(orgId), orgId);
    }

    @Transactional
    public RewardCheckinConfigResponse saveConfig(RewardCheckinConfigRequest request) {
        UUID orgId = context.getCurrentOrgId();
        List<StreakBonus> bonuses = validateBonuses(request);

        RewardCheckinConfig config = configRepository.findByOrganizationId(orgId)
                .orElseGet(() -> {
                    Organization org = organizationRepository.findById(orgId)
                            .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));
                    return RewardCheckinConfig.builder().organization(org).build();
                });

        config.setEnabled(Boolean.TRUE.equals(request.getEnabled()));
        config.setPointsPerDay(request.getPointsPerDay());
        config.setStreakCycleDays(request.getStreakCycleDays());
        config.setSkipWeekends(Boolean.TRUE.equals(request.getSkipWeekends()));
        config.setStreakBonuses(writeBonuses(bonuses));

        configRepository.save(config);
        return toConfigResponse(config, orgId);
    }

    /**
     * Chuẩn hoá và chặn những cấu hình sẽ âm thầm không bao giờ phát thưởng.
     *
     * <p>Hai lỗi đáng chặn: hai mốc cùng một ngày (không rõ mốc nào thắng), và mốc nằm
     * ngoài chu kỳ (chuỗi quay vòng nên không bao giờ chạm tới — sếp đặt xong tưởng đã
     * có thưởng ngày 30 trong khi chu kỳ chỉ 7 ngày).
     */
    private List<StreakBonus> validateBonuses(RewardCheckinConfigRequest request) {
        List<StreakBonus> bonuses = new ArrayList<>(
                request.getStreakBonuses() == null ? List.of() : request.getStreakBonuses());

        Set<Integer> seen = new HashSet<>();
        for (StreakBonus b : bonuses) {
            if (!seen.add(b.getDay())) {
                throw new BusinessException("Có hai mốc thưởng cùng đặt ở ngày " + b.getDay()
                        + ". Mỗi ngày chỉ được một mốc.");
            }
            Integer cycle = request.getStreakCycleDays();
            if (cycle != null && b.getDay() > cycle) {
                throw new BusinessException("Mốc thưởng ngày " + b.getDay()
                        + " nằm ngoài chu kỳ " + cycle + " ngày nên sẽ không bao giờ được trao. "
                        + "Hãy hạ ngày của mốc xuống tối đa " + cycle + ", hoặc nới chu kỳ.");
            }
        }

        bonuses.sort(Comparator.comparing(StreakBonus::getDay));
        return bonuses;
    }

    // ── Màn hình nhân viên ──────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public RewardCheckinStatusResponse getMyStatus() {
        User me = context.getCurrentUser();
        UUID orgId = context.getOrgIdOf(me.getId());

        // Tổ chức tắt cả module điểm thưởng thì điểm danh coi như tắt, bất kể cấu hình
        // riêng còn bật. Không chặn ở đây thì giao diện vẫn mời người ta bấm, bấm xong
        // mới nhận lỗi "Tổ chức chưa bật tính năng điểm thưởng" từ checkin().
        boolean rewardOn = organizationRepository.findById(orgId)
                .map(o -> Boolean.TRUE.equals(o.getEnableReward()))
                .orElse(false);

        return buildStatus(orgId, me.getId(), loadConfig(orgId), rewardOn,
                context.isTopLeadership(me.getId()));
    }

    /**
     * Điểm danh cho ngày hôm nay và cộng điểm vào ví. Trả về trạng thái SAU khi điểm
     * danh để giao diện vẽ lại ngay mà không phải gọi thêm một lượt nữa.
     */
    @Transactional
    public RewardCheckinStatusResponse checkin() {
        User me = context.getCurrentUser();
        UUID orgId = context.getOrgIdOf(me.getId());

        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));
        if (!Boolean.TRUE.equals(org.getEnableReward())) {
            throw new BusinessException("Tổ chức chưa bật tính năng điểm thưởng.");
        }

        RewardCheckinConfig config = loadConfig(orgId);
        if (!Boolean.TRUE.equals(config.getEnabled())) {
            throw new BusinessException("Tổ chức chưa bật điểm danh hàng ngày.");
        }

        // Chặn ở đây chứ không chỉ ẩn nút: giao diện ẩn rồi thì gọi thẳng API vẫn cộng
        // được điểm, mà điểm danh có thể quy ra quà nên đây là chỗ tiêu tiền thật.
        if (context.isTopLeadership(me.getId())) {
            throw new BusinessException("Lãnh đạo công ty không cần điểm danh.");
        }

        LocalDate date = today();
        if (isRestDay(date, config)) {
            throw new BusinessException("Hôm nay là ngày nghỉ nên không điểm danh được. "
                    + "Chuỗi của bạn vẫn được giữ nguyên tới ngày làm việc tiếp theo.");
        }

        // Lớp 1: đã có dòng của hôm nay. Xử lý gần như toàn bộ trường hợp thực tế
        // (bấm hai lần, mở hai tab) và cho được thông báo tử tế thay vì lỗi 409.
        if (checkinRepository.findByOrganizationIdAndUserIdAndCheckinDate(orgId, me.getId(), date).isPresent()) {
            throw new BusinessException("Bạn đã điểm danh hôm nay rồi. Hẹn gặp lại vào ngày mai!");
        }

        Streak streak = computeStreak(orgId, me.getId(), date, config);
        int base = config.getPointsPerDay();
        int bonus = bonusFor(streak.day(), parseBonuses(config));
        int total = base + bonus;

        // Lớp 2: khoá chống ghi trùng ở sổ cái. Suy ra hoàn toàn từ (người, ngày) nên
        // lần client retry sinh đúng khoá cũ và không phát điểm thêm lần nữa.
        RewardTransaction tx = walletService.applyTransaction(RewardWalletService.LedgerEntry.builder()
                .organizationId(orgId)
                .userId(me.getId())
                .amount(total)
                .type(RewardTransactionType.EARN)
                .sourceType(RewardSourceType.CHECKIN)
                .idempotencyKey(RewardWalletService.key("checkin", me.getId(), date))
                .note(bonus > 0
                        ? "Điểm danh ngày " + fmt(date) + " — chuỗi " + streak.length()
                          + " ngày, thưởng mốc +" + bonus
                        : "Điểm danh ngày " + fmt(date))
                .actor(me)
                .build());

        // Lớp 3: unique index (org, user, ngày). Chỉ bắt hai request song song khít nhau;
        // khi nó kích hoạt thì transaction bị huỷ trọn vẹn nên bút toán trên cũng mất theo.
        checkinRepository.save(RewardCheckin.builder()
                .organization(org)
                .user(me)
                .checkinDate(date)
                .streakLength(streak.length())
                .streakDay(streak.day())
                .basePoints(base)
                .bonusPoints(bonus)
                .totalPoints(total)
                .transactionId(tx.getId())
                .build());

        log.debug("Điểm danh userId={} ngày={} chuỗi={} điểm={}", me.getId(), date, streak.length(), total);
        // rewardModuleOn = true, exempt = false: cả hai đã được kiểm ở đầu method này.
        return buildStatus(orgId, me.getId(), config, true, false);
    }

    // ── Tính chuỗi ──────────────────────────────────────────────────────────

    /** @param length số ngày liên tiếp đếm thẳng; @param day vị trí trong chu kỳ */
    private record Streak(int length, int day) {}

    /**
     * Chuỗi mà lần điểm danh vào {@code date} sẽ đạt được.
     *
     * <p>Chỉ đọc DUY NHẤT dòng liền trước chứ không quét cả lịch sử: mỗi dòng đã lưu sẵn
     * {@code streakLength} của chính nó, nên chuỗi là phép cộng dồn một bước. Quét lại
     * toàn bộ sẽ tính ra số khác khi cấu hình {@code skipWeekends} từng thay đổi.
     */
    private Streak computeStreak(UUID orgId, UUID userId, LocalDate date, RewardCheckinConfig config) {
        Optional<RewardCheckin> last = checkinRepository
                .findFirstByOrganizationIdAndUserIdAndCheckinDateLessThanOrderByCheckinDateDesc(
                        orgId, userId, date);
        boolean continues = last.isPresent()
                && last.get().getCheckinDate().equals(previousWorkingDay(date, config));
        int length = continues ? last.get().getStreakLength() + 1 : 1;
        return new Streak(length, cyclePosition(length, config.getStreakCycleDays()));
    }

    private static int cyclePosition(int length, Integer cycleDays) {
        if (cycleDays == null || cycleDays < 2) return length;
        return ((length - 1) % cycleDays) + 1;
    }

    /**
     * Mốc thưởng trúng vào {@code streakDay}. Bỏ qua mốc thiếu trường thay vì ném lỗi:
     * dữ liệu hỏng ở cột JSON không được làm nhân viên không điểm danh được.
     */
    private static int bonusFor(int streakDay, List<StreakBonus> bonuses) {
        return bonuses.stream()
                .filter(b -> b.getDay() != null && b.getPoints() != null && b.getDay() == streakDay)
                .mapToInt(StreakBonus::getPoints)
                .sum();
    }

    private static boolean isRestDay(LocalDate date, RewardCheckinConfig config) {
        if (!Boolean.TRUE.equals(config.getSkipWeekends())) return false;
        DayOfWeek d = date.getDayOfWeek();
        return d == DayOfWeek.SATURDAY || d == DayOfWeek.SUNDAY;
    }

    /** Ngày làm việc liền trước. Bỏ qua cuối tuần khi cấu hình bật, nên thứ hai nối tiếp thứ sáu. */
    private static LocalDate previousWorkingDay(LocalDate date, RewardCheckinConfig config) {
        LocalDate prev = date.minusDays(1);
        if (!Boolean.TRUE.equals(config.getSkipWeekends())) return prev;
        while (prev.getDayOfWeek() == DayOfWeek.SATURDAY || prev.getDayOfWeek() == DayOfWeek.SUNDAY) {
            prev = prev.minusDays(1);
        }
        return prev;
    }

    // ── Dựng response ───────────────────────────────────────────────────────

    /**
     * @param rewardModuleOn cờ {@code enable_reward} của tổ chức. Tắt thì điểm danh coi
     *                       như tắt bất kể cấu hình riêng — truyền vào thay vì sửa
     *                       {@code config}, vì đó là entity đang được Hibernate quản lý.
     * @param exempt         người này được miễn điểm danh (lãnh đạo công ty). Trả về
     *                       {@code enabled = false} y như khi tổ chức tắt tính năng, để
     *                       giao diện ẩn hẳn thẻ và banner mà không cần biết luật miễn.
     */
    private RewardCheckinStatusResponse buildStatus(UUID orgId, UUID userId, RewardCheckinConfig config,
                                                    boolean rewardModuleOn, boolean exempt) {
        LocalDate date = today();
        List<StreakBonus> bonuses = parseBonuses(config);

        LocalDate from = date.minusDays(RECENT_DAYS - 1L);
        Map<LocalDate, RewardCheckin> recent = checkinRepository.findInRange(orgId, userId, from, date)
                .stream().collect(Collectors.toMap(RewardCheckin::getCheckinDate, Function.identity()));

        RewardCheckin todayRow = recent.get(date);
        boolean checkedIn = todayRow != null;
        boolean restDay = isRestDay(date, config);
        boolean enabled = rewardModuleOn && Boolean.TRUE.equals(config.getEnabled()) && !exempt;

        // Đã điểm danh thì lấy thẳng con số ĐÃ CHỤP của hôm nay — tính lại sẽ ra số khác
        // với số ghi trong lịch sử khi cấu hình vừa bị đổi. Chưa điểm danh thì đây là
        // chuỗi mà lần bấm SẮP TỚI đạt được.
        Streak streak = checkedIn
                ? new Streak(todayRow.getStreakLength(), todayRow.getStreakDay())
                : computeStreak(orgId, userId, date, config);

        // Chuỗi đã thực sự đạt. Chưa bấm hôm nay thì trừ đi 1 vì computeStreak đã cộng
        // sẵn ngày hôm nay vào — hiện thẳng con số đó là hứa trước phần thưởng người ta
        // chưa bấm để lấy, và cuối tuần sẽ thấy chuỗi tự nhảy lên dù không làm gì.
        int achieved = checkedIn ? streak.length() : streak.length() - 1;

        boolean canCheckin = enabled && !checkedIn && !restDay;
        Integer nextBonus = canCheckin ? bonusFor(streak.day(), bonuses) : null;

        return RewardCheckinStatusResponse.builder()
                .enabled(enabled)
                .exempt(exempt)
                .today(date)
                .checkedInToday(checkedIn)
                .todayPoints(checkedIn ? todayRow.getTotalPoints() : null)
                .canCheckin(canCheckin)
                .blockedReason(blockedReason(enabled, exempt, checkedIn, restDay))
                .streakLength(achieved)
                .nextStreakLength(canCheckin ? streak.length() : null)
                .streakDay(streak.day())
                .streakCycleDays(config.getStreakCycleDays())
                .nextPoints(canCheckin ? config.getPointsPerDay() + nextBonus : null)
                .nextBonusPoints(nextBonus)
                .pointsPerDay(config.getPointsPerDay())
                .streakBonuses(bonuses)
                .pointsThisMonth(checkinRepository.sumPointsForUserInRange(
                        orgId, userId, date.withDayOfMonth(1), date))
                .recentDays(buildRecentDays(from, date, config, recent))
                .build();
    }

    private static String blockedReason(boolean enabled, boolean exempt, boolean checkedIn, boolean restDay) {
        // Xét trước "tổ chức chưa bật": người được miễn cũng có enabled = false, nói họ
        // rằng tổ chức chưa bật là sai — tính năng vẫn đang chạy cho mọi người khác.
        if (exempt) return "Lãnh đạo công ty không cần điểm danh.";
        if (!enabled) return "Tổ chức chưa bật điểm danh hàng ngày.";
        if (checkedIn) return "Bạn đã điểm danh hôm nay.";
        if (restDay) return "Hôm nay là ngày nghỉ — chuỗi của bạn vẫn được giữ nguyên.";
        return null;
    }

    private static List<RewardCheckinStatusResponse.Day> buildRecentDays(
            LocalDate from, LocalDate to, RewardCheckinConfig config, Map<LocalDate, RewardCheckin> rows) {

        List<RewardCheckinStatusResponse.Day> days = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            RewardCheckin row = rows.get(d);
            days.add(RewardCheckinStatusResponse.Day.builder()
                    .date(d)
                    .checkedIn(row != null)
                    // Ngày nghỉ vẽ mờ chứ không vẽ như ngày bị bỏ lỡ — nhân viên không
                    // làm sai gì cả, và chuỗi cũng không đứt vì nó.
                    .restDay(isRestDay(d, config))
                    .points(row != null ? row.getTotalPoints() : null)
                    .build());
        }
        return days;
    }

    private RewardCheckinConfigResponse toConfigResponse(RewardCheckinConfig config, UUID orgId) {
        List<StreakBonus> bonuses = parseBonuses(config);
        LocalDate date = today();

        // Trần một chu kỳ: điểm cơ bản × số ngày + toàn bộ mốc. Không đặt chu kỳ thì con
        // số này vô nghĩa (chuỗi không giới hạn) nên để null thay vì hiện số gây hiểu nhầm.
        Integer cycle = config.getStreakCycleDays();
        Integer maxPerCycle = cycle == null ? null
                : cycle * config.getPointsPerDay()
                  + bonuses.stream().filter(b -> b.getPoints() != null)
                           .mapToInt(StreakBonus::getPoints).sum();

        return RewardCheckinConfigResponse.builder()
                .id(config.getId())
                .enabled(Boolean.TRUE.equals(config.getEnabled()))
                .pointsPerDay(config.getPointsPerDay())
                .streakCycleDays(cycle)
                .skipWeekends(Boolean.TRUE.equals(config.getSkipWeekends()))
                .streakBonuses(bonuses)
                .maxPointsPerCycle(maxPerCycle)
                .checkedInToday(checkinRepository.countByOrganizationIdAndCheckinDate(orgId, date))
                .pointsThisMonth(checkinRepository.sumPointsInRange(orgId, date.withDayOfMonth(1), date))
                .build();
    }

    // ── Tiện ích ────────────────────────────────────────────────────────────

    /** Cấu hình của tổ chức, hoặc bản mặc định (TẮT) khi chưa từng lưu. */
    private RewardCheckinConfig loadConfig(UUID orgId) {
        return configRepository.findByOrganizationId(orgId).orElseGet(RewardCheckinService::defaultConfig);
    }

    /**
     * Bản mặc định KHÔNG được ghi xuống DB — chỉ để dựng form và trả trạng thái "đang tắt"
     * cho tổ chức chưa dùng tính năng. Dựng bằng builder chứ không {@code new}: các giá trị
     * mặc định của entity đi qua {@code @Builder.Default}, nên đây là đường duy nhất chắc
     * chắn lấy đúng chúng mà không phụ thuộc phiên bản Lombok.
     */
    private static RewardCheckinConfig defaultConfig() {
        return RewardCheckinConfig.builder().build();
    }

    /**
     * Hỏng JSON thì coi như KHÔNG có mốc thưởng nào, không ném lỗi: điểm cơ bản vẫn phát
     * được và nhân viên vẫn điểm danh được. Ném lỗi ở đây sẽ làm chết cả màn hình vì một
     * cột cấu hình mà người dùng không tự sửa được.
     */
    private static List<StreakBonus> parseBonuses(RewardCheckinConfig config) {
        String json = config.getStreakBonuses();
        if (json == null || json.isBlank()) return List.of();
        try {
            return MAPPER.readValue(json, new TypeReference<List<StreakBonus>>() {});
        } catch (Exception ex) {
            log.warn("Cấu hình mốc thưởng điểm danh hỏng JSON, bỏ qua mốc. configId={}", config.getId(), ex);
            return List.of();
        }
    }

    private static String writeBonuses(List<StreakBonus> bonuses) {
        try {
            return MAPPER.writeValueAsString(bonuses);
        } catch (Exception ex) {
            throw new BusinessException("Không đọc được danh sách mốc thưởng chuỗi.");
        }
    }

    private static String fmt(LocalDate d) {
        return d.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"));
    }
}
