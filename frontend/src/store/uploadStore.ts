import { create } from 'zustand'
import axiosInstance from '@/lib/axios'
import { toast } from 'sonner'

interface UploadTask {
  id: string
  fileName: string
  progress: number
  status: 'uploading' | 'completed' | 'error'
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
    const taskName = files.length > 1 ? `${files.length} tệp minh chứng` : files[0].name
    
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
      set(state => ({
        tasks: state.tasks.map(t => t.id === taskId ? { ...t, status: 'error' } : t)
      }))
    }
  },
  removeTask: (id) => set(state => ({ tasks: state.tasks.filter(t => t.id !== id) }))
}))
