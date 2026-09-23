import { useState, useEffect, useMemo, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { submissionSchema, type SubmissionFormData } from '../schemas/submissionSchema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import { useMyKpi } from '@/features/kpi/hooks/useMyKpi'
import FileDropzone from '@/components/common/FileDropzone'
import { useUploadStore } from '@/store/uploadStore'
import { useFormAssistStore } from '@/store/formAssistStore'
import { MicButton } from '@/components/common/MicButton'
import { ATTACHMENT_ACCEPT, ATTACHMENT_HINT, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_FILES, screenEvidence } from '@/lib/attachmentPolicy'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { useWorkflowNavigator, WORKFLOW_PARAMS } from '@/features/kpi/workflow/hooks/useWorkflowNavigator'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { formatNumber, cn } from '@/lib/utils'
import { Loader2, ArrowLeft, Send, Save, AlertCircle, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useScorecards } from '@/features/bsc/hooks/useBsc'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import EvaluationFormModal from '@/features/evaluations/components/EvaluationFormModal'
import { scorecardsForPeriod } from '@/features/bsc/utils/scorecardScope'
import { isSubmittableByUser } from '../utils/submittable'

export default function NewSubmissionPage() {
  const navigate = useNavigate()
  const { nextReachableStage } = useWorkflowNavigator()
  const nextAfterSubmission = nextReachableStage('SUBMISSION')
  const user = useAuthStore(s => s.user)
  const { data: org } = useOrganization(user?.memberships?.[0]?.organizationId)
  const qualitativeLevels = [...(org?.qualitativeLevels ?? [])].sort((a, b) => a.position - b.position)
  const { id } = useParams()
  const isEdit = !!id
  const [searchParams] = useSearchParams()
  const preselectedKpiId = searchParams.get('kpiId') ?? ''
  const qc = useQueryClient()
  const [files, setFiles] = useState<File[]>([])
  /** Bản sao `files` cho fileSink đọc — xem ghi chú ở chỗ đăng ký form. */
  const filesRef = useRef<File[]>([])
  useEffect(() => {
    filesRef.current = files
    // Đẩy ảnh chụp sang store để ô chat vẽ được thẻ tệp và tự cập nhật khi người dùng gỡ tệp NGAY
    // TRÊN form. Một chiều: form vẫn là nơi giữ sự thật. Xem formAssistStore.attachedFiles.
    useFormAssistStore.getState().setAttachedFiles(files)
  }, [files])
  /** Ô đang thật sự hiện trên màn hình, để trợ lý không điền được ô bị ẩn. Xem formAssistStore. */
  const fillableRef = useRef<string[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingData, setPendingData] = useState<SubmissionFormData | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  // Mở form tự đánh giá tại chỗ. Không điều hướng sang mục "Đánh giá của tôi": mục đó
  // gác bằng EVALUATION:VIEW_MY nên trưởng đơn vị đi sang là rơi về lưới thẻ của /me.
  const [selfEvalPeriodId, setSelfEvalPeriodId] = useState<string | null>(null)
  const { data: myKpiData, isLoading: loadingKpis } = useMyKpi({ page: 0, size: 100 })

  const { data: existingSubmission, isLoading: loadingExisting } = useQuery({
    queryKey: ['submissions', id],
    queryFn: () => submissionApi.getById(id!),
    enabled: isEdit,
  })

  const { register, handleSubmit, watch, setValue, reset, control, getValues, formState: { errors } } = useForm<SubmissionFormData>({
    resolver: zodResolver(submissionSchema),
    defaultValues: { kpiCriteriaId: preselectedKpiId },
  })

  // Giới thiệu form này với trợ lý AI. Đây là TRANG chứ không phải modal nên vòng đời gắn với
  // mount/unmount: rời trang là huỷ đăng ký, nếu không trợ lý tưởng form vẫn đang mở.
  useEffect(() => {
    const { register: registerForm, unregister } = useFormAssistStore.getState()
    registerForm({
      formId: 'submission_form',
      getValues: () => getValues() as unknown as Record<string, unknown>,
      // Đọc qua ref chứ không đóng gói thẳng: effect này cố ý chỉ chạy một lần, nên tham chiếu
      // thẳng tới selectedKpi sẽ đóng băng giá trị của lần render ĐẦU. Cho selectedKpi vào deps
      // thì mỗi lần đổi chỉ tiêu lại huỷ-rồi-đăng-ký-lại, để hở một nhịp active = null.
      fillableFields: () => fillableRef.current,
      setValue: (field, value) =>
        setValue(field as keyof SubmissionFormData, value as never,
          { shouldValidate: true, shouldDirty: true }),
      // Năng lực nhận tệp. Nhờ nó, tệp thả vào ô chat vào thẳng vùng minh chứng NGAY, không phải
      // chờ người dùng gõ thêm một câu nữa — và ô chat không cần biết gì về form báo cáo.
      fileSink: {
        label: 'Tài liệu chứng minh',
        accept: ATTACHMENT_ACCEPT,
        maxSize: MAX_ATTACHMENT_BYTES,
        maxFiles: MAX_ATTACHMENT_FILES,
        hint: ATTACHMENT_HINT,
        // Qua ref vì effect này cố ý chỉ chạy một lần; đọc thẳng `files` là đóng băng mảng rỗng
        // của lần render đầu, rồi tệp thứ hai ghi đè tệp thứ nhất.
        current: () => filesRef.current,
        add: incoming => {
          const result = screenEvidence(incoming, filesRef.current)
          if (result.accepted.length) setFiles(prev => [...prev, ...result.accepted])
          return result
        },
        remove: file => setFiles(prev => prev.filter(f => f !== file)),
      },
    })
    return () => unregister('submission_form')
  }, [getValues, setValue])

  const [isInitialSyncDone, setIsInitialSyncDone] = useState(false)

  // Load existing data if editing
  useEffect(() => {
    if (existingSubmission) {
      reset({
        kpiCriteriaId: existingSubmission.kpiCriteriaId,
        actualValue: existingSubmission.actualValue,
        qualitativeLevelId: existingSubmission.qualitativeLevelId ?? undefined,
        note: existingSubmission.note ?? '',
        // Không nạp lại periodStart/periodEnd: form không có ô nào cho chúng, mà lượt sửa bỏ trống
        // thì KpiSubmissionService giữ nguyên giá trị cũ (chốt `!= null` ở updateSubmission).
      })
      setIsInitialSyncDone(true)
    }
  }, [existingSubmission, reset])

  // Handle Initial Sync once data is loaded (for new submissions)
  useEffect(() => {
    if (!myKpiData?.content || isInitialSyncDone || isEdit) return;

    const approvedKpis = myKpiData.content.filter(k => isSubmittableByUser(k, user?.id));
    let targetId: string = preselectedKpiId ?? '';
    
    if (!targetId) {
      const currentVal = watch('kpiCriteriaId');
      if (currentVal && approvedKpis.some(k => k.id === currentVal)) {
        targetId = currentVal;
      }
    }
    
    if (!targetId || !approvedKpis.some(k => k.id === targetId)) {
      if (approvedKpis.length > 0) {
        targetId = approvedKpis[0]?.id ?? '';
      }
    }

    if (targetId) {
      setValue('kpiCriteriaId', targetId);
    }
    
    setIsInitialSyncDone(true);
  }, [myKpiData, isInitialSyncDone, preselectedKpiId, setValue, watch, isEdit]);

  const selectedKpiId = watch('kpiCriteriaId')
  const selectedKpi = myKpiData?.content?.find(k => k.id === selectedKpiId)

  // Chép lại ĐÚNG các điều kiện đang dùng để vẽ ô bên dưới — không viết logic mới, vì hai bên
  // lệch nhau là quay về đúng lỗi này: trợ lý điền một ô không tồn tại trên màn hình.
  const isQualitative = selectedKpi?.kpiType === 'QUALITATIVE'
  useEffect(() => {
    fillableRef.current = [
      ...(isEdit ? [] : ['kpiCriteriaId']),                                  // khoá khi sửa
      ...(isQualitative
        ? (qualitativeLevels.length ? ['qualitativeLevelId'] : [])           // chưa cấu hình thang thì không vẽ
        : ['actualValue']),
      'note',
    ]
  }, [isEdit, isQualitative, qualitativeLevels.length])

  // Trọng số THẬT = form × %hạng_mục (từ bộ tiêu chí của đơn vị KPI).
  const enableBsc = org?.enableBsc
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: bscScorecards } = useScorecards(enableBsc ? organizationId : undefined)
  const { data: orgUnitTreeData } = useOrgUnitTree()
  const realWeight = useMemo(() => {
    const kpi: any = selectedKpi
    if (!enableBsc || !bscScorecards || !kpi || kpi.weight == null || !kpi.effectivePerspectiveId || !kpi.kpiPeriodId) return null
    const periodScs = scorecardsForPeriod(bscScorecards, kpi.kpiPeriodId)
    if (!periodScs.length) return null
    const parent = new Map<string, string | null>()
    const walk = (nodes: any[]) => (nodes || []).forEach((n: any) => { parent.set(n.id, n.parentId ?? null); if (n.children) walk(n.children) })
    walk(orgUnitTreeData || [])
    const unitId = kpi.orgUnitId || kpi.orgUnitIds?.[0]
    let sc: any = null
    if (unitId) {
      let cur: string | null = unitId, guard = 0
      while (cur && guard++ < 100) {
        const found = periodScs.find(s => (s.orgUnits || []).some((u: any) => u.id === cur))
        if (found) { sc = found; break }
        cur = parent.get(cur) ?? null
      }
    }
    if (!sc) sc = periodScs.find(s => !s.orgUnits || s.orgUnits.length === 0) || null
    if (!sc) return null
    const sp = sc.perspectives.find((p: any) => p.perspectiveId === kpi.effectivePerspectiveId)
    if (!sp || sp.weightPercentage == null) return null
    return kpi.weight * sp.weightPercentage / 100
  }, [enableBsc, bscScorecards, orgUnitTreeData, selectedKpi])

  const { addUpload } = useUploadStore()

  const mutation = useMutation({
    mutationFn: async ({ data, isDraft }: { data: SubmissionFormData, isDraft: boolean }) => {
      const payload = { ...data, isDraft }
      if (isEdit) {
        return await submissionApi.update(id!, payload as any)
      } else {
        return await submissionApi.create(payload as any)
      }
    },
    onSuccess: (sub, variables) => {
      qc.invalidateQueries({ queryKey: ['submissions'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })

      // Handle background upload if there are files
      if (files.length > 0) {
        addUpload(sub.id, files)
        toast.info('Đang bắt đầu tải lên tài liệu minh chứng...')
      }
      
      if (!variables.isDraft) {
        const periodId = selectedKpi?.kpiPeriod?.id
        const periodKpis = myKpiData?.content?.filter(k => k.kpiPeriodId === periodId) || []
        
        const isAllFinished = periodKpis.every(k => {
          if (k.frequency === 'UNLIMITED') {
            return !!k.kpiPeriod?.endDate && new Date() > new Date(k.kpiPeriod.endDate)
          }
          const currentCount = k.id === selectedKpi?.id ? k.submissionCount + 1 : k.submissionCount
          return currentCount >= k.expectedSubmissions
        })

        if (isAllFinished) {
          setShowSuccess(true)
        } else {
          toast.success('Đã gửi báo cáo để duyệt')
          // Về đúng nơi CÒN VIỆC để làm. Trước đây luôn về /submissions — danh sách những gì đã
          // nộp xong — nên người dùng phải tự tìm đường quay lại /my-kpi để nộp chỉ tiêu tiếp theo.
          navigate(`/my-kpi${periodId ? `?${WORKFLOW_PARAMS.period}=${periodId}` : ''}`)
        }
      } else {
        toast.success('Đã lưu bản nháp')
        navigate('/submissions')
      }
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Lưu bài nộp thất bại')),
  })

  if (loadingKpis || (isEdit && loadingExisting)) return <div className="mx-auto max-w-[1200px]"><LoadingSkeleton type="form" rows={6} /></div>

  // Check if editable
  if (isEdit && existingSubmission && existingSubmission.status !== 'DRAFT') {
    return (
      <div className="mx-auto max-w-[1200px] rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
        <EmptyState
          icon={AlertCircle}
          title="Không sửa được báo cáo này"
          description="Báo cáo đã gửi duyệt hoặc đã được chấm. Chỉ bản nháp mới sửa được."
          action={<Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft aria-hidden="true" /> Quay lại</Button>}
        />
      </div>
    )
  }
  const approvedKpis = myKpiData?.content?.filter(k => isSubmittableByUser(k, user?.id)) || []
  const inputCls = 'w-full rounded-control border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]'

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      {/* Header */}
      <div className="flex min-w-0 items-start gap-3">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)} aria-label="Quay lại" className="shrink-0"><ArrowLeft aria-hidden="true" /></Button>
        <div className="min-w-0">
          <h1 className="text-page-title">{isEdit ? 'Sửa báo cáo' : 'Nộp báo cáo'}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {isEdit ? 'Bản nháp chưa gửi — sửa xong có thể lưu tiếp hoặc gửi duyệt.' : 'Chọn chỉ tiêu, nhập kết quả và đính kèm minh chứng. Có thể lưu nháp để gửi sau.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        {/* Form */}
        <form className="space-y-4 lg:col-span-8" onSubmit={e => e.preventDefault()} noValidate>
          <section className="space-y-5 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            {/* Chỉ tiêu */}
            <div>
              <label className="text-label block" htmlFor="sub-kpi">Chỉ tiêu <span className="text-[var(--color-error)]" aria-hidden="true">*</span></label>
                <Controller
                  name="kpiCriteriaId"
                  control={control}
                  render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value} disabled={isEdit}>
                    <SelectTrigger id="sub-kpi" className="mt-1.5 w-full" aria-invalid={!!errors.kpiCriteriaId}><SelectValue placeholder="Chọn chỉ tiêu cần báo cáo" /></SelectTrigger>
                    <SelectContent>
                        {isEdit ? (
                        <SelectItem value={existingSubmission?.kpiCriteriaId || ''}>{existingSubmission?.kpiCriteriaName}</SelectItem>
                      ) : approvedKpis.map(k => (
                        <SelectItem key={k.id} value={k.id} extra={k.targetValue != null ? <span className="ml-2 text-caption">Mục tiêu {formatNumber(k.targetValue)} {k.unit ?? ''}</span> : undefined}>
                          {k.name}
                          </SelectItem>
                      ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              {errors.kpiCriteriaId && <p className="mt-1 text-caption text-[var(--color-error)]">{errors.kpiCriteriaId.message}</p>}
              {approvedKpis.length === 0 && !isEdit && (
                <p role="status" className="mt-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-3 py-2 text-sm text-[var(--color-foreground)]">
                  Bạn đã nộp đủ báo cáo dự kiến, hoặc chưa có chỉ tiêu nào được duyệt để báo cáo.
                </p>
              )}
            </div>

            {/* Kết quả */}
            {isQualitative ? (
              <fieldset>
                <legend className="text-label">Mức tự đánh giá</legend>
                <p className="mt-0.5 text-caption">Chọn mức bạn thấy phù hợp; quản lý sẽ xác nhận hoặc điều chỉnh khi chấm.</p>
                {qualitativeLevels.length === 0 ? (
                  <p className="mt-2 text-caption text-[var(--color-warning)]">Tổ chức chưa cấu hình thang điểm định tính (Thiết lập công cụ → Thang điểm).</p>
                ) : (
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {qualitativeLevels.map(level => {
                      const active = watch('qualitativeLevelId') === level.id
                      return (
                        <button
                          key={level.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setValue('qualitativeLevelId', level.id, { shouldValidate: true, shouldDirty: true })}
                          className={cn(
                            'flex h-9 items-center justify-between gap-3 rounded-control border px-3 text-left transition-colors',
                            active ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]' : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-muted)]'
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: level.color }} aria-hidden="true" />
                            <span className={cn('truncate text-sm', active ? 'font-medium text-[var(--color-foreground)]' : 'text-[var(--color-foreground)]')}>{level.name}</span>
                          </span>
                          <span className="shrink-0 text-caption tabular-nums">{formatNumber(level.value)} đ</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </fieldset>
            ) : (
              <div>
                <label className="text-label block" htmlFor="sub-actual">Kết quả thực tế <span className="text-[var(--color-error)]" aria-hidden="true">*</span></label>
                <div className="relative mt-1.5 w-full sm:w-72">
                <input
                    id="sub-actual"
                  {...register('actualValue', { valueAsNumber: true })}
                  type="number"
                  step="any"
                    inputMode="decimal"
                  onWheel={(e) => e.currentTarget.blur()}
                    aria-invalid={!!errors.actualValue}
                    className={cn(inputCls, 'h-11 text-lg font-medium tabular-nums', selectedKpi?.unit && 'pr-16 no-edit-hint')}
                    placeholder="0"
                />
                  {selectedKpi?.unit && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-caption">{selectedKpi.unit}</span>}
                  </div>
                {selectedKpi?.targetValue != null && (
                  <p className="mt-1 text-caption tabular-nums">Mục tiêu {formatNumber(selectedKpi.targetValue)}{selectedKpi.unit ? ` ${selectedKpi.unit}` : ''}{selectedKpi.minimumValue != null ? ` · tối thiểu ${formatNumber(selectedKpi.minimumValue)}` : ''}</p>
                )}
                {errors.actualValue && <p className="mt-1 text-caption text-[var(--color-error)]">{errors.actualValue.message}</p>}
            </div>
            )}

            {/* Giải trình */}
            <div>
                  <div className="flex items-center justify-between gap-2">
                <label className="text-label" htmlFor="sub-note">Giải trình</label>
                {/* Ghi qua setValue chứ KHÔNG sửa DOM: sửa DOM thì React Hook Form không thấy. */}
                <MicButton getBaseText={() => getValues('note') ?? ''} onText={text => setValue('note', text, { shouldValidate: true, shouldDirty: true })} />
                  </div>
              <textarea id="sub-note" {...register('note')} rows={5} className={cn(inputCls, 'mt-1.5 resize-y py-2')} placeholder="Cách bạn đạt kết quả này, khó khăn gặp phải, việc cần hỗ trợ…" />
              {errors.note && <p className="mt-1 text-caption text-[var(--color-error)]">{errors.note.message}</p>}
               </div>

            {/* Minh chứng */}
            <div>
              <p className="text-label">Minh chứng</p>
              <p className="mt-0.5 text-caption">Ảnh, PDF, Word, Excel — tăng độ tin cậy khi quản lý chấm.</p>
              <div className="mt-1.5">
                    <FileDropzone
                      onFilesSelected={(acc) => setFiles(prev => [...prev, ...acc])}
                      files={files}
                      onRemove={(idx) => setFiles(files.filter((_, j) => j !== idx))}
                      accept={ATTACHMENT_ACCEPT}
                      maxSize={MAX_ATTACHMENT_BYTES}
                      maxFiles={MAX_ATTACHMENT_FILES}
                      hint={ATTACHMENT_HINT}
                    />
                  </div>
               </div>

            {/* Nút: thứ tự cố định [Hủy] … [Lưu nháp] [Gửi duyệt] */}
            <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:items-center">
              <Button type="button" variant="ghost" onClick={() => navigate(-1)} disabled={mutation.isPending}>Hủy</Button>
              <div className="flex gap-2 sm:ml-auto">
                <Button type="button" variant="outline" disabled={mutation.isPending} onClick={handleSubmit(data => mutation.mutate({ data, isDraft: true }))}>
                  <Save aria-hidden="true" /> Lưu nháp
                </Button>
                <Button type="button" disabled={mutation.isPending} onClick={handleSubmit(data => { setPendingData(data); setShowConfirm(true) })}>
                  {mutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                  {isEdit && existingSubmission?.status === 'DRAFT' ? 'Gửi duyệt' : 'Gửi báo cáo'}
                </Button>
              </div>
            </div>
          </section>
        </form>

        {/* Tham chiếu chỉ tiêu */}
        <aside className="space-y-4 lg:col-span-4">
          {selectedKpi ? (
            <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <h2 className="text-eyebrow">Chỉ tiêu đang báo cáo</h2>
              <p className="mt-1 text-sm font-medium text-[var(--color-foreground)]">{selectedKpi.name}</p>
              {selectedKpi.description && <p className="mt-1 text-caption">{selectedKpi.description}</p>}
              <dl className="mt-3 divide-y divide-[var(--color-border)] text-sm">
                {!isQualitative && <Ref label="Mục tiêu" value={selectedKpi.targetValue != null ? `${formatNumber(selectedKpi.targetValue)}${selectedKpi.unit ? ' ' + selectedKpi.unit : ''}` : '—'} />}
                {!isQualitative && <Ref label="Tối thiểu" value={`${selectedKpi.minimumValue != null ? formatNumber(selectedKpi.minimumValue) : '0'}${selectedKpi.unit ? ' ' + selectedKpi.unit : ''}`} />}
                <Ref label={realWeight != null ? 'Trọng số thật' : 'Trọng số'} value={realWeight != null ? `${realWeight.toFixed(1)}% / ${selectedKpi.weight}%` : `${selectedKpi.weight}%`} hint={realWeight != null ? `${selectedKpi.weight}% × tỷ trọng hạng mục` : undefined} />
                <Ref label="Đợt đánh giá" value={selectedKpi.kpiPeriod?.name || 'Không giới hạn'} />
                <Ref label="Đã nộp" value={`${selectedKpi.submissionCount || 0} / ${selectedKpi.expectedSubmissions || 1} lần`} />
              </dl>
            </section>
          ) : (
            <section className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <p className="text-caption">Chọn chỉ tiêu để xem mục tiêu, trọng số và số lần đã nộp.</p>
            </section>
          )}

          <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <h2 className="text-eyebrow">Lưu ý</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-caption">
              <li>{isQualitative ? 'Chỉ tiêu định tính không nhập số — hãy giải trình và đính kèm minh chứng.' : 'Kết quả nhập bằng số để hệ thống tính điểm tự động.'}</li>
              <li>Bản nháp sửa được bất cứ lúc nào; sau khi gửi duyệt thì không.</li>
              <li>Tối đa {MAX_ATTACHMENT_FILES} tệp minh chứng mỗi báo cáo.</li>
            </ul>
          </section>
        </aside>
            </div>

      <Dialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        size="sm"
        dismissible={!mutation.isPending}
        title="Gửi báo cáo để duyệt?"
        description="Sau khi gửi, bạn không sửa được nữa cho tới khi quản lý trả lại."
        footer={
          <DialogFooter
            secondary={<Button variant="outline" onClick={() => setShowConfirm(false)} disabled={mutation.isPending}>Hủy</Button>}
            primary={
              <Button disabled={mutation.isPending} onClick={() => { if (pendingData) { mutation.mutate({ data: pendingData, isDraft: false }); setShowConfirm(false) } }}>
                <Send aria-hidden="true" /> Gửi duyệt
              </Button>
            }
          />
        }
              >
        <p className="text-sm text-[var(--color-muted-foreground)]">Quản lý trực tiếp sẽ nhận thông báo và chấm điểm báo cáo này.</p>
      </Dialog>
              
      <Dialog
        open={showSuccess}
        onClose={() => setShowSuccess(false)}
        size="sm"
        title="Đã nộp đủ báo cáo của đợt"
        description="Bạn đã hoàn thành toàn bộ chỉ tiêu trong đợt này."
        footer={
          <DialogFooter
            secondary={<Button variant="outline" onClick={() => navigate('/me?section=my-kpi')}>Về KPI của tôi</Button>}
            primary={<Button onClick={() => { setShowSuccess(false); setSelfEvalPeriodId(selectedKpi?.kpiPeriod?.id ?? null) }}><Star aria-hidden="true" /> Tự đánh giá ngay</Button>}
          />
        }
                >
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {nextAfterSubmission ? `Bước tiếp theo trong luồng: ${nextAfterSubmission.label}.` : 'Bước tiếp theo là tự đánh giá kết quả của đợt để quản lý có căn cứ chấm điểm.'}
        </p>
      </Dialog>

      <EvaluationFormModal open={!!selfEvalPeriodId} onClose={() => setSelfEvalPeriodId(null)} initialPeriodId={selfEvalPeriodId ?? undefined} />
    </div>
  )
}

function Ref({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2" title={hint}>
      <dt className="text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className="text-right tabular-nums text-[var(--color-foreground)]">{value}</dd>
    </div>
  )
}
