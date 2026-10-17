package com.kpitracking.mapper;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.dto.response.task.TaskListResponses;

import com.kpitracking.service.task.TaskFieldCodec;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;
import java.util.Map;

import com.kpitracking.entity.task.TaskList;
import com.kpitracking.entity.task.TaskListAutomation;
import com.kpitracking.entity.task.TaskListField;
import com.kpitracking.entity.task.TaskListSection;
import com.kpitracking.entity.task.TaskSavedView;
import com.kpitracking.entity.task.TaskTag;
/** Ánh xạ thuần của danh sách công việc. Vai trò người xem, thành viên, số đếm do {@code TaskListService} ghép. */
@Mapper(componentModel = "spring")
public interface TaskListMapper {

    ObjectMapper JSON = new ObjectMapper();

    @Mapping(target = "archived", expression = "java(list.getArchivedAt() != null)")
    @Mapping(target = "role", ignore = true)
    @Mapping(target = "members", ignore = true)
    @Mapping(target = "sections", ignore = true)
    @Mapping(target = "fields", ignore = true)
    @Mapping(target = "openCount", ignore = true)
    @Mapping(target = "totalCount", ignore = true)
    @Mapping(target = "dashboard", expression = "java(object(list.getDashboard()))")
    TaskListResponses.TaskListDetail toDetail(TaskList list);

    TaskListResponses.Section toSection(TaskListSection section);

    @Mapping(target = "options", expression = "java(options(field.getOptions()))")
    TaskListResponses.Field toField(TaskListField field);

    TaskListResponses.Tag toTag(TaskTag tag);

    @Mapping(target = "trigger", expression = "java(map(automation.getTrigger()))")
    @Mapping(target = "action", expression = "java(map(automation.getAction()))")
    TaskListResponses.Automation toAutomation(TaskListAutomation automation);

    @Mapping(target = "config", expression = "java(object(view.getConfig()))")
    @Mapping(target = "mine", ignore = true)
    TaskListResponses.SavedView toSavedView(TaskSavedView view);

    default List<TaskListResponses.Option> options(String json) {
        return TaskFieldCodec.options(json).stream()
                .map(o -> TaskListResponses.Option.builder().id(o.id()).label(o.label()).color(o.color()).build())
                .toList();
    }

    default Map<String, Object> map(String json) {
        try {
            return json == null ? Map.of() : JSON.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    default Object object(String json) {
        try {
            return json == null ? null : JSON.readValue(json, Object.class);
        } catch (Exception e) {
            return null;
        }
    }
}
