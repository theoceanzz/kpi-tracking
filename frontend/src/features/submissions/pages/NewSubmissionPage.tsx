import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { submissionSchema, type SubmissionFormData } from '../schemas/submissionSchema'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import { useMyKpi } from '@/features/kpi/hooks/useMyKpi'
import PageHeader from '@/components/common/PageHeader'
import FileDropzone from '@/components/common/FileDropzone'
import { toast } from 'sonner'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

export default function NewSubmissionPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedKpiId = searchParams.get('kpiId') ?? ''
  const qc = useQueryClient()
  const [files, setFiles] = useState<File[]>([])
  const { data: myKpiData } = useMyKpi(0, 100)

  const { register, handleSubmit, formState: { errors } } = useForm<SubmissionFormData>({
    resolver: zodResolver(submissionSchema),
    defaultValues: { kpiCriteriaId: preselectedKpiId },
  })

  const createMutation = useMutation({
    mutationFn: async (data: SubmissionFormData) => {
      const sub = await submissionApi.create(data)
      if (files.length > 0) {
        await submissionApi.uploadAttachments(sub.id, files)
      }
      return sub
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['submissions'] })
      toast.success('Nộp bài thành công')
      navigate('/submissions')
    },
    onError: () => toast.error('Nộp bài thất bại'),
  })

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"

  return (
    <div>
      <PageHeader title="Nộp bài mới" description="Báo cáo kết quả thực hiện chỉ tiêu KPI" />

      <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-6 max-w-lg space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Chỉ tiêu KPI <span className="text-red-500">*</span></label>
          <select {...register('kpiCriteriaId')} className={inputCls}>
            <option value="">-- Chọn chỉ tiêu --</option>
            {myKpiData?.content?.map((k) => (
              <option key={k.id} value={k.id}>{k.name}{k.targetValue != null ? ` (mục tiêu: ${k.targetValue} ${k.unit ?? ''})` : ''}</option>
            ))}
          </select>
          {errors.kpiCriteriaId && <p className="text-red-500 text-xs mt-1">{errors.kpiCriteriaId.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Giá trị thực tế <span className="text-red-500">*</span></label>
          <input {...register('actualValue', { valueAsNumber: true })} type="number" step="any" className={inputCls} placeholder="VD: 95" />
          {errors.actualValue && <p className="text-red-500 text-xs mt-1">{errors.actualValue.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Từ ngày</label>
            <input {...register('periodStart')} type="date" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Đến ngày</label>
            <input {...register('periodEnd')} type="date" className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Ghi chú</label>
          <textarea {...register('note')} rows={3} className={inputCls + ' resize-none'} placeholder="Mô tả kết quả đạt được..." />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Tệp đính kèm</label>
          <FileDropzone
            onFilesSelected={(acceptedFiles) => setFiles((prev) => [...prev, ...acceptedFiles])}
            files={files}
            onRemove={(index) => setFiles(files.filter((_, j) => j !== index))}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate(-1)} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[var(--color-accent)] transition-colors">Hủy</button>
          <button type="submit" disabled={createMutation.isPending} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2">
            {createMutation.isPending && <Loader2 size={16} className="animate-spin" />}
            Nộp bài
          </button>
        </div>
      </form>
    </div>
  )
}
