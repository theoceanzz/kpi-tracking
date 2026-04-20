import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userRoleApi, AssignRoleRequest } from '../api/user-role.api'
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

export function useOrganizationUsers() {
  return useQuery({
    queryKey: ['organization-users'],
    queryFn: () => userApi.getAll({ page: 0, size: 1000 }) // Fetching a large batch for selection
  })
}

export function useAssignRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: AssignRoleRequest) => userRoleApi.assignRole(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-unit-members', variables.orgUnitId] })
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
    }
  })
}
