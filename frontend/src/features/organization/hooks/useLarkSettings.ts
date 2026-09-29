import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { larkSettingApi, type UpdateLarkSettingsRequest } from '../api/lark-setting.api'
import { useTranslation } from 'react-i18next'

export function useLarkSettings(organizationId?: string) {
  return useQuery({
    queryKey: ['lark-settings', organizationId],
    queryFn: () => larkSettingApi.get(organizationId!),
    enabled: !!organizationId,
  })
}

export function useUpdateLarkSettings(organizationId?: string) {
  const { t } = useTranslation('organization')
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateLarkSettingsRequest) => larkSettingApi.update(organizationId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lark-settings', organizationId] })
      toast.success(t('useLarkSettings.larkConfigurationSaved'))
    },
    onError: (err: any) => {
      toast.error(getApiErrorMessage(err, t('useLarkSettings.couldNotSaveTheLarkConfiguration')))
    },
  })
}

export function useTestLarkConnection(organizationId?: string) {
  const { t } = useTranslation('organization')
  return useMutation({
    mutationFn: () => larkSettingApi.test(organizationId!),
    onError: (err: any) => {
      toast.error(getApiErrorMessage(err, t('useLarkSettings.couldNotCheckTheConnection')))
    },
  })
}

export function useConfirmLarkConnection(organizationId?: string) {
  const { t } = useTranslation('organization')
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (pendingToken: string) =>
      larkSettingApi.confirmConnect(organizationId!, pendingToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lark-settings', organizationId] })
      toast.success(t('useLarkSettings.linkedToLark'))
    },
    onError: (err: any) => {
      toast.error(getApiErrorMessage(err, t('useLarkSettings.couldNotLinkToLark')))
    },
  })
}

export function useDisconnectLark(organizationId?: string) {
  const { t } = useTranslation('organization')
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => larkSettingApi.disconnect(organizationId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lark-settings', organizationId] })
      toast.success(t('useLarkSettings.larkLinkRemoved'))
    },
    onError: (err: any) => {
      toast.error(getApiErrorMessage(err, t('useLarkSettings.couldNotRemoveTheLink')))
    },
  })
}
