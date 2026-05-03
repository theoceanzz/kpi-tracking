package com.kpitracking.tool;

import com.kpitracking.service.OrganizationService;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@RequiredArgsConstructor
public class OrganizationTool {

    private final OrganizationService organizationService;

    /**
     * Lists all org units — use this FIRST when the user asks about any specific org unit
     * so you can discover the correct UUID before calling other tools.
     */
    @Tool(
            name = "list_all_org_units",
            description = """
                    List all organization units with their names, UUIDs, and statuses.
                    USE THIS TOOL FIRST when the user mentions an org unit by name and you need its UUID.
                    Returns a formatted list. If no org units exist, returns a message saying so.
                    This tool takes NO parameters.
                    """
    )
    public String listAllOrgUnits() {
        try {
            return organizationService.listAllOrgUnitNamesAndIds();
        } catch (Exception e) {
            return "ERROR: Failed to list org units — " + e.getMessage();
        }
    }

    /**
     * Searches for an org unit UUID by name — use when you already know the user's
     * intended org unit name and need the UUID for downstream tools.
     */
    @Tool(
            name = "find_org_unit_id_by_name",
            description = """
                    Find the UUID of an organization unit by searching its name (case-insensitive, partial match).
                    Returns the UUID string if found, or a not-found message.
                    Use this when the user refers to an org unit by name and you need its UUID
                    for count_members_by_org or get_org_unit_info.
                    """
    )
    public String findOrgUnitIdByName(
            @ToolParam(description = "The name (or partial name) of the organization unit to search for, e.g. 'Phòng Kỹ thuật'")
            String name
    ) {
        try {
            String id = organizationService.findOrgUnitIdByName(name);
            if (id == null) {
                return "NOT_FOUND: No org unit matches the name '" + name + "'. "
                        + "Use list_all_org_units to see all available org units.";
            }
            return "FOUND: orgUnitId=" + id + " (matched name: '" + name + "')";
        } catch (Exception e) {
            return "ERROR: " + e.getMessage();
        }
    }

    /**
     * Counts members in an org unit — requires a valid UUID.
     * If you don't have the UUID, call find_org_unit_id_by_name or list_all_org_units first.
     */
    @Tool(
            name = "count_members_by_org",
            description = """
                    Count the number of members in an organization unit.
                    Requires the org unit's UUID (not a name).
                    If you only have the org unit's name, call find_org_unit_id_by_name first to get the UUID.
                    Returns the member count as a structured message.
                    """
    )
    public String countMembersByOrg(
            @ToolParam(description = "The UUID of the organization unit, e.g. '550e8400-e29b-41d4-a716-446655440000'. Must be a valid UUID, not a name.")
            String orgUnitId
    ) {
        try {
            UUID id = UUID.fromString(orgUnitId);
            long count = organizationService.countMembers(id);
            return "RESULT: Organization unit " + orgUnitId + " has " + count + " member(s).";
        } catch (IllegalArgumentException e) {
            return "ERROR: '" + orgUnitId + "' is not a valid UUID. "
                    + "Use find_org_unit_id_by_name to look up the UUID by name first.";
        } catch (Exception e) {
            return "ERROR: " + e.getMessage();
        }
    }

    /**
     * Gets detailed info about an org unit — requires a valid UUID.
     */
    @Tool(
            name = "get_org_unit_info",
            description = """
                    Get detailed information about an organization unit (name, email, phone, address, status, parent unit).
                    Requires the org unit's UUID (not a name).
                    If you only have the org unit's name, call find_org_unit_id_by_name first to get the UUID.
                    """
    )
    public String getOrgUnitInfo(
            @ToolParam(description = "The UUID of the organization unit, e.g. '550e8400-e29b-41d4-a716-446655440000'. Must be a valid UUID, not a name.")
            String orgUnitId
    ) {
        try {
            UUID id = UUID.fromString(orgUnitId);
            return organizationService.getOrgUnitDetailInfo(id);
        } catch (IllegalArgumentException e) {
            return "ERROR: '" + orgUnitId + "' is not a valid UUID. "
                    + "Use find_org_unit_id_by_name to look up the UUID by name first.";
        } catch (Exception e) {
            return "ERROR: " + e.getMessage();
        }
    }

    /**
     * Composite tool: count members by org unit name directly — avoids 2-step chaining.
     */
    @Tool(
            name = "count_members_by_org_name",
            description = """
                    Count the number of members in an organization unit by its name (case-insensitive, partial match).
                    This is a shortcut that combines name lookup + member counting in one call.
                    Use this when the user asks something like "How many people are in Phòng Kỹ thuật?"
                    """
    )
    public String countMembersByOrgName(
            @ToolParam(description = "The name (or partial name) of the organization unit, e.g. 'Phòng Kỹ thuật'")
            String orgName
    ) {
        try {
            String idStr = organizationService.findOrgUnitIdByName(orgName);
            if (idStr == null) {
                return "NOT_FOUND: No org unit matches the name '" + orgName + "'. "
                        + "Use list_all_org_units to see all available org units.";
            }
            UUID id = UUID.fromString(idStr);
            long count = organizationService.countMembers(id);
            return "RESULT: Organization unit '" + orgName + "' (ID: " + idStr + ") has " + count + " member(s).";
        } catch (Exception e) {
            return "ERROR: " + e.getMessage();
        }
    }
}
