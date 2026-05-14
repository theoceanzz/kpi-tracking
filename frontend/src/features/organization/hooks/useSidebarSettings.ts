import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sidebarSettingApi } from '../api/sidebar-setting.api'

export function useSidebarSettings(organizationId: string) {
  return useQuery({
    queryKey: ['sidebar-settings', organizationId],
    queryFn: () => sidebarSettingApi.getCustomLabels(organizationId),
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 30, // 30 minutes
  })
}

export function useUpdateSidebarSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ organizationId, settings }: { organizationId: string, settings: Record<string, string> }) => 
      sidebarSettingApi.updateCustomLabels(organizationId, settings),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sidebar-settings', variables.organizationId] })
    }
  })
}
