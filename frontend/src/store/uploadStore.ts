import { create } from 'zustand'
import axiosInstance from '@/lib/axios'

interface UploadTask {
  id: string
  fileName: string
  progress: number
  status: 'uploading' | 'completed' | 'error'
  /** Lý do thất bại, lấy nguyên văn từ máy chủ. */
  message?: string
}

interface UploadStore {
  tasks: UploadTask[]
  addUpload: (submissionId: string, files: File[]) => Promise<void>
  removeTask: (id: string) => void
}

export const useUploadStore = create<UploadStore>((set, get) => ({
  tasks: [],
  addUpload: async (submissionId, files) => {
    const taskId = `${submissionId}-${Date.now()}`
    const taskName = files.length > 1 ? `${files.length} tệp minh chứng` : (files[0]?.name || 'Tệp đính kèm')
    
    const newTask: UploadTask = {
      id: taskId,
      fileName: taskName,
      progress: 0,
      status: 'uploading'
    }

    set(state => ({ tasks: [...state.tasks, newTask] }))

    try {
      const formData = new FormData()
      files.forEach(f => formData.append('files', f))

      await axiosInstance.post(`/submissions/${submissionId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1))
          set(state => ({
            tasks: state.tasks.map(t => t.id === taskId ? { ...t, progress } : t)
          }))
        }
      })

      set(state => ({
        tasks: state.tasks.map(t => t.id === taskId ? { ...t, status: 'completed', progress: 100 } : t)
      }))

      // Auto-remove completed task after 10s
      setTimeout(() => {
        get().removeTask(taskId)
      }, 10000)

    } catch (error) {
      // Máy chủ nói RÕ vì sao: quá nặng, sai định dạng, hay quá số tệp. Bản trước nuốt sạch, người
      // dùng chỉ thấy "Lỗi tải lên" nên không biết phải sửa gì để thử lại.
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Tải lên thất bại'
      set(state => ({
        tasks: state.tasks.map(t => t.id === taskId ? { ...t, status: 'error', message } : t)
      }))
    }
  },
  removeTask: (id) => set(state => ({ tasks: state.tasks.filter(t => t.id !== id) }))
}))
