import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userRoleApi, AssignRoleRequest, BulkAssignRoleRequest } from '../api/user-role.api'
import { roleApi } from '../api/role.api'
import { userApi } from '@/features/users/api/userApi'

export function useOrgUnitMembers(orgUnitId?: string) {
  return useQuery({
    queryKey: ['org-unit-members', orgUnitId],
    queryFn: () => userRoleApi.getByOrgUnit(orgUnitId!),
    enabled: !!orgUnitId
  })
}

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => roleApi.listRoles()
  })
}

/**
 * @param includeInactive Chỉ Quản lý thành viên bật để còn thấy tài khoản đã tạm dừng mà bật lại;
 * ô chọn người (uỷ quyền, thêm thành viên...) dùng mặc định — BE ẩn INACTIVE/SUSPENDED.
 */
export function useOrganizationUsers(orgUnitId?: string, includeInactive = false) {
  return useQuery({
    queryKey: ['organization-users', orgUnitId, includeInactive],
    // BE nhận orgUnitIds (List) — xem chú thích ở userApi.getAll.
    queryFn: () => userApi.getAll({ page: 0, size: 1000, orgUnitIds: orgUnitId ? [orgUnitId] : undefined, includeInactive: includeInactive || undefined })
  })
}

export function useAssignRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: AssignRoleRequest) => userRoleApi.assignRole(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-unit-members', variables.orgUnitId] })
      queryClient.invalidateQueries({ queryKey: ['organization-users'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    }
  })
}

export function useBulkAssignRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: BulkAssignRoleRequest) => userRoleApi.bulkAssignRole(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-unit-members', variables.orgUnitId] })
      queryClient.invalidateQueries({ queryKey: ['organization-users'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    }
  })
}

export function useRevokeRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, roleId, orgUnitId }: { userId: string, roleId: string, orgUnitId: string }) => 
      userRoleApi.revokeRole(userId, roleId, orgUnitId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-unit-members', variables.orgUnitId] })
      queryClient.invalidateQueries({ queryKey: ['organization-users'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    }
  })
}

export function useRemoveAllFromUnit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (orgUnitId: string) => userRoleApi.removeAllFromUnit(orgUnitId),
    onSuccess: (_, orgUnitId) => {
      queryClient.invalidateQueries({ queryKey: ['org-unit-members', orgUnitId] })
      queryClient.invalidateQueries({ queryKey: ['organization-users'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    }
  })
}

export function useRemoveBulkFromUnit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userIds, orgUnitId }: { userIds: string[], orgUnitId: string }) => 
      userRoleApi.removeBulkFromUnit(userIds, orgUnitId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-unit-members', variables.orgUnitId] })
      queryClient.invalidateQueries({ queryKey: ['organization-users'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    }
  })
}
