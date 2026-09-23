package com.kpitracking.tool;

import com.kpitracking.dto.response.delegation.DelegationResponse;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.service.OrgUnitDelegationService;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.DelegationRequest;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.invocation.InvocationParameters;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Uỷ quyền đơn vị: ai đang được giao quản lý thêm đơn vị nào, tới bao giờ.
 *
 * <p>Dịch vụ liệt kê cả TỔ CHỨC; tool thu về cây của người hỏi (đơn vị được uỷ quyền phải nằm trong
 * cây), vì đây là thông tin "ai quản lý ai" — không phải thứ trưởng phòng này được xem của phòng kia.
 */
@Component
@RequiredArgsConstructor
public class DelegationTool {

    private final OrgUnitDelegationService delegationService;
    private final OrgUnitRepository orgUnitRepository;
    private final ToolSupport support;

    @Tool(name = "get_delegations", value = "UỶ QUYỀN đơn vị: ai đang được giao quản lý thêm đơn vị nào, vai trò gì, "
            + "hiệu lực tới bao giờ, đã hết hạn chưa. Dùng cho 'ai đang được uỷ quyền phòng X', 'tôi/anh A đang phụ trách thêm đơn vị nào'. "
            + "Mặc định là cả cây đơn vị của bạn; truyền unitName để chỉ xem một đơn vị; userName để xem một người. "
            + "Chỉ đọc — tạo/thu hồi uỷ quyền làm trên màn hình Thiết lập công ty.")
    public String getDelegations(DelegationRequest request, InvocationParameters context) {
        try {
            ToolSupport.UnitRef u = support.resolveUnit(request.unitId(), request.unitName(), context);
            if (u.clarification() != null) return support.respond(context, "get_delegations", u.clarification());
            UUID orgId = support.getOrgId(context);
            Set<UUID> subtree = orgUnitRepository.findAllInSubtrees(List.of(u.id()), orgId)
                    .stream().map(OrgUnit::getId).collect(Collectors.toSet());

            List<DelegationResponse> all = delegationService.list(orgId).stream()
                    .filter(d -> d.getOrgUnitId() != null && subtree.contains(d.getOrgUnitId()))
                    .toList();
            if (ToolSupport.notBlank(request.userName()) || ToolSupport.notBlank(request.userId())) {
                ToolSupport.UserRef person = support.resolveUser(request.userId(), request.userName(), context);
                if (person.clarification() != null) return support.respond(context, "get_delegations", person.clarification());
                all = all.stream().filter(d -> person.id().equals(d.getDelegateUserId())).toList();
            }
            if (!Boolean.TRUE.equals(request.includeExpired())) {
                all = all.stream().filter(d -> !Boolean.TRUE.equals(d.getExpired())).toList();
            }

            Map<String, Object> out = new LinkedHashMap<>();
            out.put("count", all.size());
            out.put("delegations", all.stream().map(d -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("delegateName", d.getDelegateUserName());
                row.put("delegateEmail", d.getDelegateUserEmail());
                row.put("roleName", d.getDelegateRoleName());
                row.put("orgUnitName", d.getOrgUnitName());
                row.put("expiresAt", d.getExpiresAt() != null ? d.getExpiresAt().toString() : null);
                row.put("active", d.getActive());
                row.put("scheduled", d.getScheduled());
                row.put("expired", d.getExpired());
                row.put("createdBy", d.getCreatedByName());
                return row;
            }).toList());
            if (all.isEmpty()) out.put("message", "Không có uỷ quyền nào đang hiệu lực trong phạm vi này.");
            return support.respond(context, "get_delegations", out);
        } catch (Exception e) {
            return support.toolError("get_delegations", e);
        }
    }
}
