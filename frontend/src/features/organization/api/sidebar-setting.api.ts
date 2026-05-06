import axiosInstance from '@/lib/axios'

export const sidebarSettingApi = {
  getCustomLabels: async (organizationId: string): Promise<Record<string, string>> => {
    const response = await axiosInstance.get(`/sidebar-settings/${organizationId}`)
    return response.data
  },
  
  updateCustomLabels: async (organizationId: string, settings: Record<string, string>): Promise<void> => {
    await axiosInstance.post(`/sidebar-settings/${organizationId}`, settings)
  }
}
