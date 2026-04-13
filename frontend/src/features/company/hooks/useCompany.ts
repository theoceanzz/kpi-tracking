import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companyApi } from '../api/companyApi'
import { toast } from 'sonner'
import type { UpdateCompanyRequest } from '@/types/company'

export function useCompany() {
  return useQuery({ queryKey: ['company'], queryFn: companyApi.getMy })
}

export function useUpdateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateCompanyRequest) => companyApi.update(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company'] })
      toast.success('Cập nhật thông tin công ty thành công')
    },
    onError: () => toast.error('Cập nhật thất bại'),
  })
}
