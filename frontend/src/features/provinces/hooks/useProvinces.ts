import { useQuery } from '@tanstack/react-query'
import { provinceApi } from '../api/provinceApi'

export function useProvinces() {
  return useQuery({ queryKey: ['provinces'], queryFn: provinceApi.getAll })
}

export function useDistricts(provinceId: string | null) {
  return useQuery({
    queryKey: ['provinces', provinceId, 'districts'],
    queryFn: () => provinceApi.getDistricts(provinceId!),
    enabled: !!provinceId,
  })
}
