import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { larkSettingApi, type UpdateLarkSettingsRequest } from '../api/lark-setting.api'

export function useLarkSettings(organizationId?: string) {
  return useQuery({
    queryKey: ['lark-settings', organizationId],
    queryFn: () => larkSettingApi.get(organizationId!),
    enabled: !!organizationId,
  })
}

export function useUpdateLarkSettings(organizationId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateLarkSettingsRequest) => larkSettingApi.update(organizationId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lark-settings', organizationId] })
      toast.success('Đã lưu cấu hình Lark')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Không lưu được cấu hình Lark')
    },
  })
}

export function useTestLarkConnection(organizationId?: string) {
  return useMutation({
    mutationFn: () => larkSettingApi.test(organizationId!),
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Không kiểm tra được kết nối')
    },
  })
}

export function useConfirmLarkConnection(organizationId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (pendingToken: string) =>
      larkSettingApi.confirmConnect(organizationId!, pendingToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lark-settings', organizationId] })
      toast.success('Đã liên kết với Lark')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Không liên kết được với Lark')
    },
  })
}

export function useDisconnectLark(organizationId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => larkSettingApi.disconnect(organizationId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lark-settings', organizationId] })
      toast.success('Đã huỷ liên kết Lark')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Không huỷ được liên kết')
    },
  })
}
