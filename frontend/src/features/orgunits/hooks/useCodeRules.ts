import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { codeRuleApi, type CodeType, type UpdateCodeRuleRequest } from '../api/codeRuleApi'

/** Quy tắc sinh mã của tổ chức (Mục tiêu, KR, hạng mục BSC). */
export function useCodeRules(organizationId?: string) {
  const { user } = useAuthStore()
  const orgId = organizationId ?? user?.memberships?.[0]?.organizationId

  return useQuery({
    queryKey: ['org-code-rules', orgId],
    queryFn: () => codeRuleApi.list(orgId!),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Quy tắc của MỘT loại mã, kèm hai kết luận mà form nào cũng cần:
 *
 * - `locked`: ô mã chỉ đọc, người dùng không được đặt mã riêng.
 * - `optional`: bỏ trống được vì backend sẽ cấp mã.
 *
 * Trong lúc chưa tải xong, cả hai là `false` — tức là hành xử y như trước khi có tính năng
 * này (bắt nhập tay). Sai theo hướng an toàn: người dùng gõ mã rồi mà tổ chức đang bật tự
 * sinh thì backend vẫn bỏ qua mã đó, còn ngược lại thì lỗi hiện ra rõ ràng.
 */
export function useCodeRule(codeType: CodeType, organizationId?: string) {
  const { data, isLoading } = useCodeRules(organizationId)
  const rule = data?.find(r => r.codeType === codeType)

  return {
    rule,
    isLoading,
    locked: !!rule?.autoGenerate && !rule?.allowManualOverride,
    optional: !!rule?.autoGenerate,
    preview: rule?.preview ?? null,
  }
}

export function useUpdateCodeRules(organizationId?: string) {
  const { user } = useAuthStore()
  const orgId = organizationId ?? user?.memberships?.[0]?.organizationId
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (rules: UpdateCodeRuleRequest[]) => codeRuleApi.update(orgId!, rules),
    onSuccess: data => {
      queryClient.setQueryData(['org-code-rules', orgId], data)
      toast.success('Đã lưu quy tắc sinh mã')
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(message || 'Lưu quy tắc sinh mã thất bại')
    },
  })
}
