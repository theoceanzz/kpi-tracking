import { useMutation, useQueryClient } from '@tanstack/react-query'
import { organizationApi } from '../api/organizationApi'
import { invalidateOrgDerived } from '@/lib/queryClient'

/**
 * Tải logo / ảnh bìa công ty. Dùng chung một mutation cho cả hai vì backend cũng chung
 * một endpoint, chỉ khác `kind` — tách đôi chỉ để lặp lại y hệt phần invalidate.
 */
export function useUploadOrgBranding(id: string | undefined) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ kind, file }: { kind: 'logo' | 'cover'; file: File }) =>
      organizationApi.uploadBranding(id!, kind, file),
    onSuccess: () => invalidateOrgDerived(qc),
  })
}
