import { useMemo, useEffect, useRef } from 'react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { kpiSchema, type KpiFormData } from '../schemas/kpiSchema'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi, type AiKpiSuggestion } from '../api/kpiApi'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/store/authStore'
import { useFormAssistStore } from '@/store/formAssistStore'
import { usePermission } from '@/hooks/usePermission'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { FREQUENCY_MAP, cn, formatDateTime } from '@/lib/utils'
import UserAvatar from '@/components/common/UserAvatar'
import { Loader2, Check, Sparkles, Target, Users, LayoutGrid, SlidersHorizontal, BarChart3, RotateCcw, RefreshCw, SplitSquareHorizontal } from 'lucide-react'
import type { KpiCriteria } from '@/types/kpi'
import { useState } from 'react'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useObjectives } from '@/features/okr/hooks/useOkr'
import { useBscPerspectives, useScorecards, useFixedPerspectives } from '@/features/bsc/hooks/useBsc'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { DateTimePicker } from '@/components/common/DateTimePicker'
import { scorecardsForPeriod } from '@/features/bsc/utils/scorecardScope'
import { perspectiveHint } from '@/features/bsc/utils/perspectiveHint'
import { ChoiceChip } from '@/components/ui/choice-chip'

interface KpiFormModalProps {
  open: boolean
  onClose: () => void
  editKpi?: KpiCriteria | null
  parentKpi?: KpiCriteria | null
  parentRelationType?: 'DELEGATION' | 'DECOMPOSITION'
  /**
   * Chuyển sang màn chia hạng mục BSC thành KPI theo đợt. Bỏ trống (hoặc org chưa bật BSC) thì
   * nút không hiện — form này vẫn tạo được KPI thường như cũ.
   */
  onSplitFromBsc?: () => void
  /**
   * `modal` (mặc định) giữ nguyên lớp phủ + tiêu đề + nút Hủy như hai trang đang dùng.
   * `inline` bỏ khung đó để nhúng thẳng vào một bước của trình thiết lập, nơi khung wizard đã lo
   * phần tiêu đề và điều hướng.
   *
   * Cố ý chỉ gỡ KHUNG chứ không tách file: 624 dòng trường nhập và 535 dòng logic chuẩn hoá
   * payload, cảnh báo BSC/OKR, gợi ý AI đều dùng chung cho cả hai biến thể — chép ra bản thứ hai
   * là chấp nhận chúng sẽ lệch nhau.
   */
  variant?: 'modal' | 'inline'
  /** Gọi kèm chỉ tiêu vừa tạo. Trước đây thực thể này bị `onSuccess: ()` vứt đi. */
  onCreated?: (kpi: KpiCriteria) => void
  /** Tạo xong thì dọn form và Ở LẠI để thêm cái tiếp theo, thay vì đóng. */
  keepOpenAfterCreate?: boolean
  /** Nhãn nút xác nhận. Trong wizard là "Thêm chỉ tiêu". */
  submitLabel?: string
  /**
   * Báo ra ngoài đợt và đơn vị đang chọn, ngay khi người dùng vừa chọn.
   *
   * Trình thiết lập cần biết điều này TRƯỚC khi lưu chỉ tiêu đầu tiên: thẻ tổng trọng số bên phải
   * phải nói được "đơn vị này, đợt này còn thiếu bao nhiêu %". Trước khi có nó, thẻ chỉ hiện 0%
   * kèm "còn thiếu 100%" mà không nói của ai — đọc lên không hiểu đang nói về cái gì.
   */
  onContextChange?: (ctx: { kpiPeriodId?: string; orgUnitIds: string[]; assigneeNames: string[] }) => void
  /**
   * Khoá đợt: form dùng luôn giá trị này và hiện một thẻ chỉ-đọc thay cho ô chọn.
   *
   * Trong trình thiết lập, đợt đã được chọn ở bước ngay trước. Bày thêm một ô chọn nữa vừa thừa
   * vừa mời gọi mâu thuẫn với thẻ "Đang lập cho" bên phải.
   */
  lockedPeriodId?: string
  /** Đơn vị tích sẵn khi mở form — thường là đơn vị người dùng đang trực thuộc. */
  defaultOrgUnitIds?: string[]
  /** Thu ô chọn đơn vị thành một dòng gọn, bung ra khi bấm "Đổi". */
  compactOrgUnits?: boolean
  /** Bấm một đơn vị là THAY lựa chọn cũ, không cộng dồn — hành vi nút radio. */
  singleOrgUnit?: boolean
  /**
   * Chỉ liệt kê những đơn vị người dùng đang trực thuộc, thay vì cả cây họ được phép xem.
   *
   * Dùng cùng `lockAssignees` ở luồng tự giao: chỉ tiêu ghi tên chính họ nên đơn vị thực hiện chỉ
   * có thể là đơn vị họ thuộc về. Một người có thể ở nhiều đơn vị nên vẫn phải cho chọn.
   */
  onlyMyOrgUnits?: boolean
  /**
   * Khoá người thực hiện: bỏ hẳn ô chọn, chỉ hiện một thẻ gọn xác nhận người nhận.
   *
   * Dùng ở luồng "giao chỉ tiêu cho bản thân" — bày ra một danh sách nhân sự để chọn trong khi câu
   * trả lời luôn là chính họ vừa tốn chỗ vừa mời gọi chọn nhầm. Đi kèm `defaultAssigneeIds`.
   */
  lockAssignees?: boolean
  /**
   * Người thực hiện tích sẵn, và GIỮ LẠI sau mỗi lần tạo ở chế độ thêm liên tục.
   *
   * Mặc định form cố ý xoá người thực hiện sau mỗi lần lưu, vì đó là trường thay đổi nhiều nhất
   * giữa các chỉ tiêu và giữ lại sẽ âm thầm giao nhầm người. Nhưng ở luồng "giao chỉ tiêu cho bản
   * thân" thì ngược hẳn: người nhận luôn là chính họ, bắt tích lại cho từng chỉ tiêu mới là sai.
   */
  defaultAssigneeIds?: string[]
}

const frequencyOptions = (['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'YEARLY', 'UNLIMITED'] as const).map(value => ({
  value,
  label: FREQUENCY_MAP[value]
}))

// Empty numeric inputs must become `undefined`, not NaN — otherwise hidden fields
// (e.g. target/minimum on the qualitative tab) keep a NaN value and fail zod validation.
const numOrUndef = (v: unknown) =>
  v === '' || v === null || v === undefined ? undefined : Number(v)

function toDatetimeLocal(value?: string | null): string | undefined {
  if (!value) return undefined
  const d = new Date(value)
  if (isNaN(d.getTime())) return undefined
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}


export default function KpiFormModal({
  open, onClose, editKpi, parentKpi, parentRelationType, onSplitFromBsc,
  variant = 'modal', onCreated, keepOpenAfterCreate = false, submitLabel, onContextChange,
  lockedPeriodId, defaultOrgUnitIds, compactOrgUnits = false, singleOrgUnit = false, defaultAssigneeIds, lockAssignees = false, onlyMyOrgUnits = false,
}: KpiFormModalProps) {
  const isInline = variant === 'inline'
  const isEdit = !!editKpi
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const { hasPermission } = usePermission()
  const canManageOrg = hasPermission('ORG:VIEW')
  const canReview = hasPermission('SUBMISSION:REVIEW')
  const canAssignRoles = hasPermission('ROLE:ASSIGN')

  const { data: orgUnitTreeData } = useOrgUnitTree()
  const isStaff = user?.memberships?.[0]?.roleRank === 2
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(organizationId)
  const { data: periodsData } = useKpiPeriods({ organizationId })
  
  const enableOkr = org?.enableOkr
  const { data: objectives } = useObjectives(enableOkr ? organizationId : undefined)

  const enableBsc = org?.enableBsc
  const { data: perspectives } = useBscPerspectives(enableBsc ? organizationId : undefined)
  const { data: fixedPerspectives } = useFixedPerspectives()
  const { data: bscScorecards } = useScorecards(enableBsc ? organizationId : undefined)

  const groupedPerspectives = useMemo(() => {
    const order = (fixedPerspectives || []).map(fp => fp.code)
    const nameByCode = new Map((fixedPerspectives || []).map(fp => [fp.code, fp.name]))
    const groups = (perspectives || []).reduce((acc, p) => {
      const key = p.fixedPerspective || 'INTERNAL_PROCESS'
      if (!acc[key]) acc[key] = []
      acc[key].push(p)
      return acc
    }, {} as Record<string, typeof perspectives>)
    const keys = order.length ? order.filter(k => groups[k]) : Object.keys(groups)
    return keys.map(k => ({ code: k, name: nameByCode.get(k as any) || k, items: groups[k]! }))
  }, [perspectives, fixedPerspectives])

  // Flatten tree for dropdown
  const flattenTree = (nodes: any[], level = 0): any[] => {
    let result: any[] = []
    nodes.forEach(node => {
      result.push({ ...node, levelLabel: '—'.repeat(level) + (level > 0 ? ' ' : '') + node.name })
      if (node.children?.length) {
        result = result.concat(flattenTree(node.children, level + 1))
      }
    })
    return result
  }

  /** Đơn vị người dùng TRỰC THUỘC — lấy từ phiên đăng nhập, không phụ thuộc cây tổ chức. */
  const myOrgUnitIds = useMemo(
    () => new Set((user?.memberships ?? []).map(m => m.orgUnitId).filter(Boolean)),
    [user?.memberships],
  )

  const flatOrgUnits = useMemo(() => {
    if (!orgUnitTreeData) return []
    // Giữ CẢ nút gốc. Trước đây lọc `parentId !== null` với lý do "gốc thường là tổ chức", nhưng
    // backend không luôn trả cây toàn tổ chức: `OrgUnitService.getOrgUnitTree` cắt theo quyền —
    // ai chỉ có ORG:VIEW_TREE thì nhận về đơn vị CỦA CHÍNH HỌ làm gốc kèm cấp dưới. Lọc gốc đi
    // nghĩa là trưởng đơn vị không bao giờ giao được KPI cho đơn vị mình, và nếu đơn vị đó lỡ
    // được chọn sẵn thì nó thành một lựa chọn vô hình không gỡ ra được.
    //
    // `flattenTree` đánh cấp bằng số gạch đầu dòng nên gốc tự phân biệt: nó không có gạch nào.
    const all = flattenTree(orgUnitTreeData)
    if (!onlyMyOrgUnits) return all

    // Luồng tự giao: chỉ tiêu là của CHÍNH người dùng, nên đơn vị thực hiện phải là đơn vị họ
    // đang trực thuộc. Cả cây (gồm cấp dưới họ quản lý) là danh sách của việc giao cho người khác.
    //
    // Bỏ gạch đầu dòng đánh cấp: danh sách này phẳng và ngắn, dấu gạch chỉ còn là nhiễu.
    const mine = all.filter(u => myOrgUnitIds.has(u.id)).map(u => ({ ...u, levelLabel: u.name }))

    // Không khớp được cái nào thì trả cả cây, đừng đưa ra danh sách rỗng: đơn vị rỗng là không tạo
    // được chỉ tiêu nào, tệ hơn hẳn so với một danh sách rộng hơn cần thiết.
    return mine.length > 0 ? mine : all
  }, [orgUnitTreeData, onlyMyOrgUnits, myOrgUnitIds])

  /** Phần `defaultOrgUnitIds` thật sự chọn được — xem ghi chú ở chỗ dùng trong effect khởi tạo. */
  const selectableDefaultUnitIds = useMemo(
    () => (defaultOrgUnitIds ?? []).filter(id => flatOrgUnits.some(u => u.id === id)),
    [defaultOrgUnitIds, flatOrgUnits],
  )

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue, control, getValues } = useForm<KpiFormData>({
    resolver: zodResolver(kpiSchema),
    defaultValues: {
      kpiType: 'QUANTITATIVE',
      name: '',
      description: '',
      weight: undefined,
      targetValue: undefined,
      minimumValue: undefined,
      isReverseKpi: false,
      isBonusKpi: false,
      deadline: undefined,
      unit: '',
      frequency: 'MONTHLY',
      assignedToIds: [],
      kpiPeriodId: lockedPeriodId ?? '',
      keyResultId: null,
      parentId: null,
      parentRelationType: null,
      perspectiveId: null,
      orgUnitIds: selectableDefaultUnitIds,
      orgUnitId: '',
    },
  })

  const formKpiPeriodId = watch('kpiPeriodId')
  const periodHasScorecard = scorecardsForPeriod(bscScorecards, formKpiPeriodId).length > 0
  const formOrgUnitIds = watch('orgUnitIds') || []
  const [selectedRole, setSelectedRole] = useState<string>('ALL')
  /** Chỉ dùng ở chế độ thu gọn: danh sách đơn vị đang bung ra hay không. */
  const [orgUnitsExpanded, setOrgUnitsExpanded] = useState(false)

  /** Ô đang thật sự sửa được, cho trợ lý AI. Cập nhật bằng effect riêng — các điều kiện dưới
   *  đây khai báo SAU chỗ đăng ký nên không đưa thẳng vào deps được (lỗi vùng chết). */
  const fillableRef = useRef<string[]>([])

  // Giới thiệu form này với trợ lý AI trong lúc nó đang mở, để người dùng nhờ điền hộ được.
  // Truyền HÀM đọc/ghi chứ không truyền dữ liệu: giá trị chỉ cần đúng tại thời điểm gửi câu hỏi,
  // đẩy vào store theo từng ký tự sẽ làm mọi thành phần nghe store vẽ lại liên tục.
  useEffect(() => {
    if (!open) return
    const { register: registerForm, unregister } = useFormAssistStore.getState()
    registerForm({
      formId: 'kpi_form',
      getValues: () => getValues() as unknown as Record<string, unknown>,
      fillableFields: () => fillableRef.current,
      setValue: (field, value) =>
        setValue(field as keyof KpiFormData, value as never, { shouldValidate: true, shouldDirty: true }),
    })
    return () => unregister('kpi_form')
  }, [open, getValues, setValue])

  const kpiType = watch('kpiType')
  const isQualitative = kpiType === 'QUALITATIVE'
  const enableQualitative = org?.enableQualitative
  // Show the type switcher only for standalone new KPIs when the org enabled qualitative.
  // Child KPIs (parentKpi) and edits keep their fixed type.
  const showTypeTabs = enableQualitative && !parentKpi && !isEdit

  // Synchronize form values only when modal opens
  useEffect(() => {
    if (!open) {
      setUserSearch('')
      setSelectedRole('ALL')
      setAiSuggestions([])
      setAppliedIdx(null)
      setBeforeApply(null)
      return
    }

    if (editKpi) {
      reset({
        kpiType: editKpi.kpiType ?? 'QUANTITATIVE',
        name: editKpi.name,
        description: editKpi.description ?? '',
        weight: editKpi.weight ?? undefined,
        targetValue: editKpi.targetValue ?? undefined,
        unit: editKpi.unit ?? '',
        frequency: editKpi.frequency,
        orgUnitId: editKpi.orgUnitId ?? '',
        orgUnitIds: editKpi.orgUnitIds ?? (editKpi.orgUnitId ? [editKpi.orgUnitId] : []),
        assignedToIds: editKpi.assigneeIds ?? [],
        minimumValue: editKpi.minimumValue ?? undefined,
        isReverseKpi: editKpi.isReverseKpi ?? false,
        isBonusKpi: editKpi.isBonusKpi ?? false,
        deadline: toDatetimeLocal(editKpi.deadline) ?? undefined,
        kpiPeriodId: editKpi.kpiPeriodId ?? '',
        keyResultId: editKpi.keyResultId ?? null,
        parentId: editKpi.parentId ?? null,
        perspectiveId: editKpi.perspectiveId ?? null,
      })
    } else {
      const defaultOrgUnitId = user?.memberships?.[0]?.orgUnitId || ''
      const effectiveRelationType = parentKpi ? (parentRelationType ?? 'DECOMPOSITION') : null
      const isDecomposition = effectiveRelationType === 'DECOMPOSITION'
      const remainingWeight = parentKpi ? Math.max(0, (parentKpi.weight ?? 0) - (parentKpi.childrenWeightTotal ?? 0)) : undefined
      reset({
        // Child KPIs inherit the parent's type; standalone new KPIs default to quantitative.
        kpiType: parentKpi?.kpiType ?? 'QUANTITATIVE',
        name: parentKpi ? `[${parentKpi.name}] ` : '',
        description: '',
        weight: isDecomposition ? remainingWeight : undefined,
        targetValue: undefined,
        minimumValue: undefined,
        isReverseKpi: false,
        isBonusKpi: false,
        deadline: undefined,
        unit: parentKpi?.unit ?? '',
        frequency: 'MONTHLY',
        // Prop đứng TRƯỚC mọi mặc định khác: effect này chạy ngay khi form mở và ghi đè lên
        // `defaultValues`, nên nếu không ưu tiên ở đây thì đợt/đơn vị mà trình thiết lập truyền
        // vào sẽ bị xoá — form hiện đúng tên đợt (đọc từ prop) nhưng zod vẫn báo thiếu vì
        // form state rỗng.
        kpiPeriodId: lockedPeriodId ?? parentKpi?.kpiPeriodId ?? '',
        keyResultId: null,
        parentId: parentKpi?.id ?? null,
        parentRelationType: effectiveRelationType,
        perspectiveId: parentKpi?.perspectiveId ?? null,
        // Chỉ nhận đơn vị THẬT SỰ có trong danh sách. Chọn sẵn một đơn vị không hiện ra được sẽ
        // tạo lựa chọn vô hình mà người dùng không gỡ nổi — đúng lớp lỗi vừa gặp khi nút gốc còn
        // bị lọc đi. Lọc rỗng thì lui về mặc định cũ.
        orgUnitIds: selectableDefaultUnitIds.length > 0
          ? selectableDefaultUnitIds
          : (canAssignRoles ? [] : (defaultOrgUnitId ? [defaultOrgUnitId] : [])),
        orgUnitId: parentKpi?.orgUnitId ?? defaultOrgUnitId,
        assignedToIds: isDecomposition
          ? (parentKpi?.assigneeIds ?? [])
          : (defaultAssigneeIds ?? (isStaff ? ([user?.id].filter(Boolean) as string[]) : []))
      })
    }
  }, [open, reset, editKpi, flatOrgUnits, canManageOrg, parentKpi, parentRelationType, isStaff, user, lockedPeriodId, selectableDefaultUnitIds, canAssignRoles, defaultAssigneeIds])

  const selectedAssignees = watch('assignedToIds') || []

  // Combine roles from selected org units
  const availableRolesForFilter = useMemo(() => {
    const rolesMap = new Map<string, { id: string; name: string }>()
    formOrgUnitIds.forEach(id => {
      const unit = flatOrgUnits.find(u => u.id === id)
      unit?.assignedRoles?.forEach((role: any) => {
        rolesMap.set(role.name, role) // Use name as key to deduplicate standard roles like "Nhân viên"
      })
    })
    return Array.from(rolesMap.values())
  }, [formOrgUnitIds, flatOrgUnits])

  // Member count sum
  const totalMemberCount = useMemo(() => {
    return formOrgUnitIds.reduce((sum, id) => {
      const unit = flatOrgUnits.find(u => u.id === id)
      return sum + (unit?.memberCount || 0)
    }, 0)
  }, [formOrgUnitIds, flatOrgUnits])

  const { data: usersData, isLoading: isLoadingUsers } = useUsers({ 
    page: 0, 
    size: 500, 
    orgUnitIds: formOrgUnitIds.length > 0 ? formOrgUnitIds : (isEdit ? [] : ['00000000-0000-0000-0000-000000000000']), 
    role: selectedRole === 'ALL' ? undefined : selectedRole
  })

  const availableUsers = useMemo(() => {
    return usersData?.content || []
  }, [usersData])

  /**
   * Tên người thực hiện đang chọn.
   *
   * Người dùng hiện tại được tra thẳng từ phiên đăng nhập, không qua `availableUsers`: danh sách đó
   * lọc theo đơn vị đang chọn, mà người tự giao chỉ tiêu cho mình có thể đang lập cho một đơn vị
   * họ không nằm trong đó — khi ấy tên chính họ sẽ không tra ra.
   */
  const assigneeNames = selectedAssignees
    .map(id => (id === user?.id ? (user?.fullName ?? 'Bạn') : (availableUsers.find(u => u.id === id)?.fullName ?? '')))
    .filter(Boolean)

  // Đẩy bối cảnh đang chọn ra ngoài. So sánh bằng chuỗi JSON: `watch()` trả về mảng MỚI mỗi lần
  // render, đưa thẳng vào deps thì effect chạy vô hạn.
  const contextKey = JSON.stringify({
    kpiPeriodId: formKpiPeriodId ?? '',
    orgUnitIds: formOrgUnitIds,
    assigneeNames,
  })
  useEffect(() => {
    const ctx = JSON.parse(contextKey) as { kpiPeriodId: string; orgUnitIds: string[]; assigneeNames: string[] }
    onContextChange?.({
      kpiPeriodId: ctx.kpiPeriodId || undefined,
      orgUnitIds: ctx.orgUnitIds,
      assigneeNames: ctx.assigneeNames,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey])


  const createMutation = useMutation({
    mutationFn: (data: KpiFormData) => kpiApi.create(data),
    // Nhận `created`: mutation vốn vẫn trả về chỉ tiêu vừa tạo, chỉ là chữ ký cũ khai `()` nên
    // vứt đi. Trình thiết lập cần nó để dựng danh sách "giỏ hàng" bên phải.
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      toast.success('Tạo chỉ tiêu thành công')
      // Giữ lại BỐI CẢNH, dọn phần còn lại. `reset()` trần đưa form về defaultValues rỗng, nên ở
      // chế độ thêm liên tục người dùng phải chọn lại đợt, đơn vị và tần suất cho TỪNG chỉ tiêu —
      // đúng thao tác mà trình thiết lập sinh ra để xoá bỏ.
      //
      // Không giữ người thực hiện: đó là trường thay đổi nhiều nhất giữa các chỉ tiêu, giữ lại sẽ
      // âm thầm giao nhầm người. Trừ khi chủ trang chỉ định sẵn — luồng "cho bản thân" thì người
      // nhận luôn là chính họ, xoá đi mới là bắt làm thừa.
      reset({
        ...getValues(),
        name: '',
        description: '',
        weight: undefined,
        targetValue: undefined,
        minimumValue: undefined,
        unit: '',
        deadline: undefined,
        isReverseKpi: false,
        isBonusKpi: false,
        assignedToIds: defaultAssigneeIds ?? [],
        keyResultId: null,
        perspectiveId: null,
      })
      setAiSuggestions([])
      onCreated?.(created)
      // Ở chế độ thêm liên tục thì giữ form mở để nhập tiếp cái sau — đóng lại rồi bắt mở lại
      // cho mỗi chỉ tiêu chính là thao tác mà trình thiết lập sinh ra để xoá bỏ.
      if (!keepOpenAfterCreate) onClose()
      setAppliedIdx(null)
      setBeforeApply(null)
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Tạo chỉ tiêu thất bại'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: KpiFormData) => kpiApi.update(editKpi!.id, data),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      toast.success('Cập nhật thành công')
      onClose() 
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Cập nhật chỉ tiêu thất bại'))
    },
  })

  const formFrequency = watch('frequency')
  const formDeadline = watch('deadline')

  const selectedPeriod = useMemo(() => {
    return periodsData?.content?.find((p: any) => p.id === formKpiPeriodId)
  }, [periodsData, formKpiPeriodId])

  const filteredFrequencyOptions = useMemo(() => {
    if (!selectedPeriod) return frequencyOptions
    
    const TYPE_LEVEL: Record<string, number> = {
      'UNLIMITED': 0, // không giới hạn = nhỏ nhất, luôn hợp lệ với mọi loại đợt
      'DAILY': 1,
      'WEEKLY': 2,
      'MONTHLY': 3,
      'QUARTERLY': 4,
      'SEMI_ANNUALLY': 5,
      'YEARLY': 6
    }
    const periodLevel = TYPE_LEVEL[selectedPeriod.periodType] || 0
    return frequencyOptions.filter(opt => (TYPE_LEVEL[opt.value as any] || 0) <= periodLevel)
  }, [selectedPeriod])

  useEffect(() => {
    if (selectedPeriod) {
      const TYPE_LEVEL: Record<string, number> = {
        'UNLIMITED': 0, // không giới hạn = nhỏ nhất, luôn hợp lệ với mọi loại đợt
        'DAILY': 1,
        'WEEKLY': 2,
        'MONTHLY': 3,
        'QUARTERLY': 4,
        'SEMI_ANNUALLY': 5,
        'YEARLY': 6
      }
      const periodLevel = TYPE_LEVEL[selectedPeriod.periodType] || 0
      if ((TYPE_LEVEL[formFrequency] || 0) > periodLevel) {
        setValue('frequency', selectedPeriod.periodType as any)
      }
    }
  }, [selectedPeriod, formFrequency, setValue])

  // Clear the custom deadline if the period is unselected, or if it falls outside the newly selected period's range
  useEffect(() => {
    if (!formDeadline) return

    if (!formKpiPeriodId) {
      setValue('deadline', undefined)
      toast.error('Đã xoá hạn chót riêng vì chưa chọn đợt KPI')
      return
    }

    if (selectedPeriod) {
      const t = new Date(formDeadline).getTime()
      const s = selectedPeriod.startDate ? new Date(selectedPeriod.startDate).getTime() : null
      const e = selectedPeriod.endDate ? new Date(selectedPeriod.endDate).getTime() : null
      if ((s && t < s) || (e && t > e)) {
        setValue('deadline', undefined)
        toast.error('Đã xoá hạn chót riêng vì không còn nằm trong đợt KPI mới chọn')
      }
    }
  }, [formKpiPeriodId, selectedPeriod, formDeadline, setValue])
  
  const filteredObjectives = useMemo(() => {
    if (!objectives) return []
    if (formOrgUnitIds.length === 0) return []
    return objectives.filter((obj: any) => obj.orgUnitIds?.some((id: string) => formOrgUnitIds.includes(id)))
  }, [objectives, formOrgUnitIds])

  const watchedKeyResultId = watch('keyResultId')
  const watchedPerspectiveId = watch('perspectiveId')
  const inheritedPerspective = useMemo(() => {
    if (!watchedKeyResultId || watchedKeyResultId === 'NONE') return null
    const obj = (objectives || []).find((o: any) => o.keyResults?.some((kr: any) => kr.id === watchedKeyResultId))
    if (obj?.perspectiveId) return { name: obj.perspectiveName as string, color: (obj.perspectiveColor as string) || '#8b5cf6' }
    return null
  }, [watchedKeyResultId, objectives])

  // Bản đồ đơn vị → cha (để resolve bộ tiêu chí áp dụng: đơn vị → cha → mặc định).
  const unitParent = useMemo(() => {
    const map = new Map<string, string | null>()
    const walk = (nodes: any[]) => (nodes || []).forEach((n: any) => { map.set(n.id, n.parentId ?? null); if (n.children) walk(n.children) })
    walk(orgUnitTreeData || [])
    return map
  }, [orgUnitTreeData])

  // Bộ tiêu chí HIỆU LỰC cho KPI theo đơn vị đầu tiên được gán (đơn vị → cha → mặc định).
  const effectiveScorecard = useMemo(() => {
    if (!formKpiPeriodId) return null
    const periodScs = scorecardsForPeriod(bscScorecards, formKpiPeriodId)
    if (periodScs.length === 0) return null
    const realUnits = formOrgUnitIds.filter(id => id && id !== '00000000-0000-0000-0000-000000000000')
    if (realUnits.length === 0) return null // chưa chọn đơn vị ⇒ chưa biết bộ tiêu chí nào
    let cur: string | null = realUnits[0]!, guard = 0
    while (cur && guard++ < 100) {
      const found = periodScs.find(s => (s.orgUnits || []).some(u => u.id === cur))
      if (found) return found
      cur = unitParent.get(cur) ?? null
    }
    return periodScs.find(s => !s.orgUnits || s.orgUnits.length === 0) || null
  }, [bscScorecards, formKpiPeriodId, formOrgUnitIds, unitParent])

  /**
   * Con số của từng hạng mục để hiện ngay trong dropdown.
   *
   * Lấy từ DÒNG của bộ tiêu chí hiệu lực chứ không từ danh mục hạng mục: cùng một hạng mục
   * "Doanh thu" nhưng mỗi đơn vị đặt một mục tiêu khác nhau, hiện số của danh mục là hiện nhầm
   * con số của đơn vị khác. Chưa chọn đủ kỳ/đơn vị để biết bộ tiêu chí nào thì rơi về danh mục.
   */
  const perspectiveNumbers = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const p of perspectives || []) {
      const row = effectiveScorecard?.perspectives.find(sp => sp.perspectiveId === p.id)
      map.set(p.id, perspectiveHint({
        targetValue: row?.targetValue ?? p.targetValue,
        minimumValue: row?.minimumValue ?? p.minimumValue,
        unit: row?.unit ?? p.unit,
        weightPercentage: row?.weightPercentage ?? null,
      }))
    }
    return map
  }, [perspectives, effectiveScorecard])

  // Trọng số THẬT (chỉ hiển thị) = trọng số form × %hạng_mục (lấy từ bộ tiêu chí hiệu lực của đơn vị KPI).
  // Form% chỉ để đủ 100%/hạng mục; trọng số thật mới là phần đóng góp vào 100% của đơn vị.
  const watchedWeight = watch('weight')
  const effectivePerspId = useMemo(() => {
    if (watchedPerspectiveId && watchedPerspectiveId !== 'NONE') return watchedPerspectiveId
    if (watchedKeyResultId && watchedKeyResultId !== 'NONE') {
      const obj = (objectives || []).find((o: any) => o.keyResults?.some((kr: any) => kr.id === watchedKeyResultId))
      return obj?.perspectiveId || null
    }
    return null
  }, [watchedPerspectiveId, watchedKeyResultId, objectives])
  const categoryWeightPct = useMemo(() => {
    if (!effectiveScorecard || !effectivePerspId) return null
    const sp = effectiveScorecard.perspectives.find(p => p.perspectiveId === effectivePerspId)
    return sp && sp.weightPercentage != null ? sp.weightPercentage : null
  }, [effectiveScorecard, effectivePerspId])
  const realWeight = (watchedWeight != null && !Number.isNaN(Number(watchedWeight)) && categoryWeightPct != null)
    ? (Number(watchedWeight) * categoryWeightPct / 100) : null

  // Lọc hạng mục theo BỘ TIÊU CHÍ của đơn vị KPI được gán: chỉ hiện hạng mục CÓ trong bộ tiêu chí
  // áp dụng cho đơn vị đó (union nếu gán nhiều đơn vị). Thiếu ⇒ nhắc thêm vào bộ tiêu chí.
  const availablePerspectiveIds = useMemo<Set<string> | null>(() => {
    if (!enableBsc) return null // không bật BSC ⇒ không liên quan (mục hạng mục cũng ẩn)
    const ids = new Set<string>()
    if (!formKpiPeriodId) return ids // chưa chọn kỳ ⇒ rỗng
    const periodScs = scorecardsForPeriod(bscScorecards, formKpiPeriodId)
    if (periodScs.length === 0) return ids // kỳ chưa có bộ tiêu chí ⇒ rỗng
    const realUnits = formOrgUnitIds.filter(id => id && id !== '00000000-0000-0000-0000-000000000000')
    if (realUnits.length === 0) return ids // chưa chọn đơn vị ⇒ rỗng
    const resolveForUnit = (unitId: string) => {
      let cur: string | null = unitId, guard = 0
      while (cur && guard++ < 100) {
        const found = periodScs.find(s => (s.orgUnits || []).some(u => u.id === cur))
        if (found) return found
        cur = unitParent.get(cur) ?? null
      }
      return periodScs.find(s => !s.orgUnits || s.orgUnits.length === 0) || null
    }
    realUnits.forEach(uid => (resolveForUnit(uid)?.perspectives || []).forEach(p => ids.add(p.perspectiveId)))
    return ids
  }, [enableBsc, bscScorecards, formKpiPeriodId, formOrgUnitIds, unitParent])

  const hasRealUnit = formOrgUnitIds.some(id => id && id !== '00000000-0000-0000-0000-000000000000')

  const filteredGroupedPerspectives = useMemo(() => {
    if (!availablePerspectiveIds) return groupedPerspectives
    return groupedPerspectives
      .map(g => ({ ...g, items: g.items.filter(p => availablePerspectiveIds.has(p.id)) }))
      .filter(g => g.items.length > 0)
  }, [groupedPerspectives, availablePerspectiveIds])

  // Hạng mục đang gán nhưng KHÔNG có trong bộ tiêu chí của đơn vị ⇒ cảnh báo (sẽ không tính điểm BSC).
  // Chỉ cảnh báo khi ĐÃ chọn đơn vị (chưa chọn thì đã có nhắc "chọn đơn vị trước").
  const selectedPerspMissing = !!availablePerspectiveIds && hasRealUnit && !!effectivePerspId && !availablePerspectiveIds.has(effectivePerspId)

  // Clear Key Result if OrgUnit changes to a different one
  useEffect(() => {
    if (formOrgUnitIds.length > 0 && watch('keyResultId')) {
      const currentKrId = watch('keyResultId')
      const isStillValid = filteredObjectives.some(obj => 
        obj.keyResults.some((kr: any) => kr.id === currentKrId)
      )
      if (!isStillValid) {
        setValue('keyResultId', null)
      }
    }
  }, [formOrgUnitIds, filteredObjectives, setValue, watch])

  // AI Suggestion Logic
  const [aiSuggestions, setAiSuggestions] = useState<AiKpiSuggestion[]>([])
  const [isSuggesting, setIsSuggesting] = useState(false)
  /** Chỉ số gợi ý vừa áp dụng, để đánh dấu và cho phép hoàn tác. */
  const [appliedIdx, setAppliedIdx] = useState<number | null>(null)
  /** Giá trị các trường trước khi áp dụng, dùng cho nút Hoàn tác. */
  const [beforeApply, setBeforeApply] = useState<Partial<KpiFormData> | null>(null)
  const [userSearch, setUserSearch] = useState('')

  const displayUsers = useMemo(() => {
    const filtered = availableUsers

    if (!userSearch.trim()) return filtered
    const search = userSearch.toLowerCase()
    return filtered.filter(u => 
      u.fullName.toLowerCase().includes(search) || 
      u.email.toLowerCase().includes(search)
    )
  }, [availableUsers, userSearch])

  /**
   * Gom bối cảnh người dùng đang soạn để AI gợi ý bám sát, thay vì trả về cùng một bộ
   * chung chung mỗi lần bấm. Rỗng thì backend dùng prompt mặc định.
   */
  const buildAiContext = () => {
    const parts: string[] = []
    const typedName = (watch('name') || '').trim()
    if (typedName) parts.push(`Tên chỉ tiêu đang gõ: "${typedName}"`)
    parts.push(isQualitative ? 'Loại KPI: định tính' : 'Loại KPI: định lượng')

    if (selectedPeriod?.name) parts.push(`Đợt: ${selectedPeriod.name}`)

    // Mục tiêu suy ra từ kết quả then chốt đang chọn — form không có trường objectiveId riêng.
    if (watchedKeyResultId && watchedKeyResultId !== 'NONE') {
      const obj = (objectives || []).find((o: any) =>
        o.keyResults?.some((kr: any) => kr.id === watchedKeyResultId))
      if (obj?.name) parts.push(`Mục tiêu liên quan: ${obj.name}`)
    }

    return parts.join('. ')
  }

  const handleAiSuggest = async () => {
    const orgUnitId = formOrgUnitIds[0] || user?.memberships?.[0]?.orgUnitId
    if (!orgUnitId) {
      toast.error('Vui lòng chọn hoặc đảm bảo bạn thuộc một phòng ban để nhận gợi ý chính xác')
      return
    }

    setIsSuggesting(true)
    // Chỉ số cũ không còn ứng với danh sách mới. Nhưng GIỮ beforeApply để sau khi
    // xin gợi ý khác, người dùng vẫn hoàn tác được về nội dung tự nhập ban đầu.
    setAppliedIdx(null)
    try {
      const suggestions = await kpiApi.getAiSuggestions(orgUnitId, buildAiContext())
      setAiSuggestions(suggestions)
      if (suggestions.length === 0) {
        toast.info('AI không tìm thấy gợi ý phù hợp lúc này')
      }
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'Lỗi khi lấy gợi ý từ AI'))
    } finally {
      setIsSuggesting(false)
    }
  }

  /**
   * Điền gợi ý vào form. Dùng setValue từng trường thay vì reset() cả form:
   * reset() ghi đè mọi trường khác (người nhận, đơn vị, đợt...) mà người dùng đã chọn.
   * Danh sách gợi ý vẫn mở để còn đổi sang phương án khác.
   */
  const applySuggestion = (sug: AiKpiSuggestion, idx: number) => {
    if (!beforeApply) {
      setBeforeApply({
        name: watch('name'),
        description: watch('description'),
        unit: watch('unit'),
        targetValue: watch('targetValue'),
        weight: watch('weight'),
        frequency: watch('frequency'),
      })
    }

    const opts = { shouldDirty: true, shouldValidate: true } as const
    setValue('name', sug.name ?? '', opts)
    if (sug.description != null) setValue('description', sug.description, opts)
    // Chỉ tiêu định tính không chấm theo con số nên bỏ qua đơn vị / giá trị mục tiêu.
    if (!isQualitative) {
      if (sug.unit != null) setValue('unit', sug.unit, opts)
      if (sug.targetValue != null) setValue('targetValue', sug.targetValue, opts)
    }
    if (sug.weight != null) setValue('weight', sug.weight, opts)
    if (sug.frequency != null) setValue('frequency', sug.frequency, opts)

    setAppliedIdx(idx)
  }

  const undoSuggestion = () => {
    if (!beforeApply) return
    const opts = { shouldDirty: true, shouldValidate: true } as const
    Object.entries(beforeApply).forEach(([field, value]) => {
      setValue(field as keyof KpiFormData, value as never, opts)
    })
    setBeforeApply(null)
    setAppliedIdx(null)
  }

  const closeSuggestions = () => {
    setAiSuggestions([])
    setAppliedIdx(null)
    setBeforeApply(null)
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const isPendingApproval = isEdit && editKpi?.status === 'PENDING_APPROVAL'

  // Chép lại ĐÚNG các điều kiện đang dùng để vẽ từng ô bên dưới.
  useEffect(() => {
    fillableRef.current = [
      'name', 'description', 'weight',
      ...(showTypeTabs ? ['kpiType'] : []),
      ...(isQualitative ? [] : ['targetValue', 'minimumValue', 'unit', 'isReverseKpi']),
      ...(parentKpi ? [] : ['isBonusKpi']),
      // Đợt bị khoá thì ô đó không còn được vẽ nữa — để lại trong danh sách này là mời trợ lý
      // điền vào một ô không tồn tại.
      ...(isPendingApproval ? [] : [...(lockedPeriodId ? [] : ['kpiPeriodId']), 'frequency', 'deadline', 'assignedToIds']),
      ...(!isPendingApproval && flatOrgUnits.length > 0 ? ['orgUnitIds'] : []),
    ]
  }, [showTypeTabs, isQualitative, parentKpi, isPendingApproval, flatOrgUnits.length, lockedPeriodId])

  const onSubmit = (data: KpiFormData) => {
    const payload = { ...data }

    // Qualitative KPIs have no numeric measurement fields.
    if (payload.kpiType === 'QUALITATIVE') {
      delete payload.targetValue
      delete payload.minimumValue
      delete payload.unit
      payload.isReverseKpi = false
    }

    if (!payload.orgUnitIds || payload.orgUnitIds.length === 0) {
        delete payload.orgUnitIds
    }

    if (payload.keyResultId === '' || payload.keyResultId === 'NONE') payload.keyResultId = null
    if (payload.parentId === '') payload.parentId = null
    if (payload.perspectiveId === '' || payload.perspectiveId === 'NONE') payload.perspectiveId = null

    if (payload.deadline && selectedPeriod) {
      const t = new Date(payload.deadline).getTime()
      const s = selectedPeriod.startDate ? new Date(selectedPeriod.startDate).getTime() : null
      const e = selectedPeriod.endDate ? new Date(selectedPeriod.endDate).getTime() : null
      if ((s && t < s) || (e && t > e)) {
        toast.error('Hạn chót phải nằm trong khoảng thời gian của đợt KPI')
        return
      }
      payload.deadline = new Date(payload.deadline).toISOString()
    } else {
      delete payload.deadline
    }

    if (isEdit) {
      updateMutation.mutate(payload as any)
    } else {
      createMutation.mutate(payload as any)
    }
  }

  const toggleAssignee = (userId: string) => {
    const current = [...selectedAssignees]
    const index = current.indexOf(userId)
    if (index > -1) {
      current.splice(index, 1)
    } else {
      current.push(userId)
    }
    setValue('assignedToIds', current)
  }

  const toggleOrgUnit = (orgId: string) => {
    // Chế độ một đơn vị: luôn THAY, kể cả khi bấm vào đơn vị đang chọn. Cho bỏ chọn về rỗng sẽ
    // đẩy người dùng vào trạng thái không đơn vị nào — thẻ trọng số bên phải mất chỗ bám và nút
    // Tiếp tục tắt mà không rõ vì sao.
    //
    // Cố ý KHÔNG gộp với `enableOkr` bên dưới: chế độ OKR cũng chỉ giữ một đơn vị nhưng vẫn cho
    // bỏ chọn về rỗng, và đó là hành vi có sẵn của nó.
    if (singleOrgUnit) {
      setValue('orgUnitIds', [orgId])
      return
    }

    let current = [...formOrgUnitIds]
    const index = current.indexOf(orgId)
    if (index > -1) current.splice(index, 1)
    else if (enableOkr) current = [orgId]
    else current.push(orgId)
    setValue('orgUnitIds', current)
  }

  if (!open) return null

  const inputCls = "w-full px-3 py-2.5 rounded-control border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 transition-all shadow-sm"

  const formBody = (
    <>
        <form
          id="kpi-form"
          noValidate
          onSubmit={handleSubmit(onSubmit, (err) => console.error('KPI Form Errors:', err))}
          // Trong modal thì xếp dọc như cũ (bề ngang chỉ 512px). Nhúng vào trình thiết lập thì có
          // cả trang để dùng, nên dàn hai cột: form này có mười khối, xếp dọc hết thì người dùng
          // phải cuộn qua ba màn hình mới tới được nút thêm.
          // Luôn là flex dọc; phần chia hai cột nằm bên trong. Dùng grid hai cột ở cấp form thì
          // mỗi hàng bị ép cùng chiều cao — bung danh sách đơn vị bên phải là đẩy luôn nội dung
          // cột trái xuống, để lại một khoảng trống lớn.
          className="flex flex-col gap-5"
        >
          {showTypeTabs && (
            <div className="grid grid-cols-2 gap-2 p-1 rounded-card bg-[var(--color-accent)]/30 border border-[var(--color-border)]/40">
              <ChoiceChip selected={!isQualitative} variant="solid" className="py-2.5" onClick={() => setValue('kpiType', 'QUANTITATIVE')}>
                <BarChart3 /> Định lượng
              </ChoiceChip>
              <button
                type="button"
                onClick={() => setValue('kpiType', 'QUALITATIVE')}
                className={cn(
                  "flex items-center justify-center gap-2 py-2.5 rounded-card text-sm font-medium transition-all",
                  isQualitative ? "bg-[var(--color-success-solid)] text-white" : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]"
                )}
              >
                <SlidersHorizontal size={14} /> Định tính
              </button>
            </div>
          )}

          {isEdit && isQualitative && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-card bg-[var(--color-success-bg)] border border-[var(--color-success-border)] text-[var(--color-success)] text-xs font-medium">
              <SlidersHorizontal size={14} /> KPI Định tính — chấm điểm theo thang định tính khi duyệt
            </div>
          )}

          {/* Tên + mô tả trải hết bề ngang: đây là ô người dùng gõ nhiều nhất, bó hẹp một nửa
              khiến tên chỉ tiêu dài bị cắt ngay lúc nhập. */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-label block text-[var(--color-foreground)]">Tên chỉ tiêu <span className="text-[var(--color-error)]">*</span></label>
                {(canManageOrg || canReview) && !isEdit && (
                  <Button size="sm" type="button" onClick={handleAiSuggest} disabled={isSuggesting} title="AI đọc số liệu của đơn vị và bối cảnh bạn đang nhập để đề xuất chỉ tiêu">
                    {isSuggesting ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Sparkles aria-hidden="true" />}
                    {isSuggesting ? 'ĐANG PHÂN TÍCH...' : 'GỢI Ý AI'}
                  </Button>
                )}
              </div>
              <input 
                {...register('name')} 
                className={inputCls} 
                placeholder="VD: Doanh thu tháng 10" 
              />
              {errors.name && <p className="text-[var(--color-error)] text-xs mt-1 font-medium">{errors.name.message}</p>}
            </div>

            {/* Đang chờ AI: hiện khung chờ ngay tại chỗ kết quả sẽ xuất hiện.
                Lời gọi có thể mất hàng chục giây nên chỉ quay vòng trên nút là chưa đủ rõ. */}
            {isSuggesting && aiSuggestions.length === 0 && (
              <div className="bg-[var(--color-info-bg)] border border-[var(--color-info-border)] rounded-card p-3 space-y-2 animate-in fade-in">
                <span className="text-eyebrow text-[var(--color-info)] flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" /> AI đang đọc số liệu đơn vị...
                </span>
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-14 rounded-card bg-[var(--color-card)] animate-pulse"/>
                ))}
              </div>
            )}

            {aiSuggestions.length > 0 && (
              <div className="bg-[var(--color-info-bg)] border border-[var(--color-info-border)] rounded-card p-3 space-y-2 animate-in fade-in slide-in-from-top-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-eyebrow text-[var(--color-info)] flex items-center gap-1">
                    <Sparkles size={12} /> AI đề xuất {aiSuggestions.length} chỉ tiêu
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    {beforeApply && (
                      <Button variant="ghost" type="button" onClick={undoSuggestion}>
                        <RotateCcw aria-hidden="true" /> Hoàn tác
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" type="button" onClick={handleAiSuggest} disabled={isSuggesting}>
                      {isSuggesting
                        ? <Loader2 aria-hidden="true" className="animate-spin" />
                        : <RefreshCw aria-hidden="true" />} Gợi ý khác
                    </Button>
                    <Button variant="ghost" type="button" onClick={closeSuggestions}>
                      Đóng
                    </Button>
                  </span>
                </div>

                <p className="text-caption font-medium">
                  Bấm để điền vào biểu mẫu. Các trường khác bạn đã chọn (đơn vị, đợt, người nhận) được giữ nguyên.
                </p>

                <div className="space-y-1.5">
                  {aiSuggestions.map((s, idx) => {
                    const applied = appliedIdx === idx
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => applySuggestion(s, idx)}
                        className={cn(
                          'w-full text-left p-3 rounded-card border shadow-sm transition-all group',
                          applied
                            ? 'bg-[var(--color-info-bg)] border-[var(--color-info-border)] ring-2 ring-[var(--color-info-solid)]'
                            : 'bg-[var(--color-background)] border-[var(--color-info-border)] hover:border-[var(--color-info-border)]',
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <span className={cn(
                            'text-sm flex-1 min-w-0 transition-colors',
                            applied ? 'text-[var(--color-info)]' : 'group-hover:text-[var(--color-info)]',
                          )}>
                            {s.name}
                          </span>
                          {applied && (
                            <span className="text-eyebrow flex items-center gap-1 text-[var(--color-info)] shrink-0">
                              <Check size={11} /> Đã điền
                            </span>
                          )}
                        </div>

                        {s.description && (
                          <p className="text-caption line-clamp-2 mt-1">
                            {s.description}
                          </p>
                        )}

                        {/* Hiện đủ các con số để cân nhắc trước khi điền, thay vì
                            phải áp dụng rồi mới biết AI đề xuất mục tiêu bao nhiêu. */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {!isQualitative && s.targetValue != null && (
                            <SuggestionChip label="Mục tiêu" value={`${s.targetValue}${s.unit ? ` ${s.unit}` : ''}`} />
                          )}
                          {s.weight != null && <SuggestionChip label="Trọng số" value={`${s.weight}%`} />}
                          {s.frequency && <SuggestionChip label="Tần suất" value={FREQUENCY_MAP[s.frequency] ?? s.frequency} />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="text-label block mb-1.5">Mô tả chi tiết</label>
              <textarea 
                {...register('description')} 
                rows={2} 
                className={inputCls + ' resize-none'} 
                placeholder="Cung cấp ngữ cảnh và cách tính toán..." 
              />
            </div>
          </div>
          <div className={isInline ? "flex flex-col gap-5 xl:flex-row xl:items-start" : "contents"}>
          <div className={isInline ? "flex-1 min-w-0 flex flex-col gap-5" : "contents"}>

          <div className="bg-[var(--color-accent)]/10 rounded-card p-4 border border-[var(--color-border)]/30 space-y-4">
              {!isQualitative && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-label block mb-1.5">Mục tiêu mong muốn <span className="text-[var(--color-error)]">*</span></label>
                  <input
                    {...register('targetValue', { setValueAs: numOrUndef })}
                    type="number"
                    step="any"
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    className={inputCls}
                    placeholder="1000"
                  />
                  {errors.targetValue && <p className="text-[var(--color-error)] text-xs mt-1 font-medium">{errors.targetValue.message}</p>}
                </div>
                <div>
                  <label className="text-label block mb-1.5">Mục tiêu tối thiểu <span className="text-[var(--color-error)]">*</span></label>
                  <input
                    {...register('minimumValue', { setValueAs: numOrUndef })}
                    type="number"
                    step="any"
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    className={inputCls}
                    placeholder="800"
                  />
                  {errors.minimumValue && <p className="text-[var(--color-error)] text-xs mt-1 font-medium">{errors.minimumValue.message}</p>}
                </div>
              </div>
              )}

              {isQualitative && (
                <div className="p-3 rounded-card bg-[var(--color-success-bg)] border border-[var(--color-success-border)] text-xs font-medium text-[var(--color-success)] leading-relaxed">
                  KPI định tính không có mục tiêu số. Khi duyệt bài nộp, quản lý chọn một mức trong thang điểm định tính (KÉM/YẾU/…/TỐT) để chấm điểm.
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-label block mb-1.5">Trọng số (%) <span className="text-[var(--color-error)]">*</span></label>
                  <input
                    {...register('weight', { setValueAs: numOrUndef })}
                    type="number"
                    step="any"
                    min={0}
                    max={100}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    className={inputCls}
                    placeholder="25"
                  />
                  {errors.weight && <p className="text-[var(--color-error)] text-xs mt-1 font-medium">{errors.weight.message}</p>}
                  {parentKpi && watch('parentRelationType') === 'DECOMPOSITION' && (
                    <p className="text-xs mt-1 font-medium text-[var(--color-info)]">
                      Trọng số còn lại của KPI cha "{parentKpi.name}": {Math.max(0, (parentKpi.weight ?? 0) - (parentKpi.childrenWeightTotal ?? 0))}%
                    </p>
                  )}
                  {realWeight != null && (
                    <p className="text-xs mt-1 font-medium text-[var(--color-primary)]">
                      Trọng số thật ≈ {realWeight.toFixed(1)}%
                      <span className="font-medium text-[var(--color-subtle-foreground)]"> (= {Number(watchedWeight)}% × {categoryWeightPct}% hạng mục — phần đóng góp vào 100% của đơn vị)</span>
                    </p>
                  )}
                </div>
                {!isQualitative && (
                <div>
                  <label className="text-label block mb-1.5">Đơn vị tính <span className="text-[var(--color-error)]">*</span></label>
                  <input
                    {...register('unit')}
                    className={inputCls}
                    placeholder="VNĐ, %, KPI..."
                  />
                  {errors.unit && <p className="text-[var(--color-error)] text-xs mt-1 font-medium">{errors.unit.message}</p>}
                </div>
                )}
              </div>

              {!isQualitative && (
              <Controller
                name="isReverseKpi"
                control={control}
                render={({ field }) => (
                  <button
                    type="button"
                    onClick={() => field.onChange(!field.value)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-card border-2 transition-all text-left",
                      field.value
                        ? "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)]"
                        : "border-[var(--color-border)] bg-[var(--color-background)] hover:border-[var(--color-primary)]/50"
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-sm font-medium", field.value ? "text-[var(--color-warning)]" : "text-[var(--color-foreground)]")}>
                          KPI Ngược
                        </span>
                        <div className="relative group/tooltip">
                          <div className="w-4 h-4 rounded-full bg-[var(--color-muted-foreground)]/20 hover:bg-[var(--color-warning-bg)] dark:hover:bg-[var(--color-warning-bg)] flex items-center justify-center cursor-help transition-colors">
                            <span className="text-caption group-hover/tooltip:text-[var(--color-warning)] leading-none transition-colors">?</span>
                          </div>
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 rounded-card bg-[var(--color-foreground)] text-[var(--color-background)] text-xs leading-relaxed shadow-2xl opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all duration-200 z-50 scale-95 group-hover/tooltip:scale-100">
                            <p className="font-semibold text-amber-300 dark:text-amber-700 mb-1.5">KPI Ngược là gì?</p>
                            <p className="font-medium opacity-90">Loại KPI mà giá trị thực tế <span className="text-amber-300 dark:text-amber-700 font-semibold">càng thấp càng tốt</span>.</p>
                            <p className="font-medium opacity-80 mt-1.5">Ví dụ: tỉ lệ lỗi, chi phí vận hành, thời gian xử lý, tỉ lệ nghỉ việc...</p>
                            <p className="font-medium opacity-80 mt-1.5">Công thức điểm: <span className="text-emerald-300 dark:text-emerald-700 font-semibold">2 − (thực tế ÷ mục tiêu)</span>, thay vì chia thẳng như KPI thường.</p>
                            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[var(--color-foreground)]" />
                          </div>
                        </div>
                      </div>
                      <div className="text-caption mt-0.5">
                        Giá trị mục tiêu càng thấp càng tốt (VD: tỉ lệ lỗi, chi phí)
                      </div>
                    </div>
                    <div className={cn(
                      "w-10 h-6 rounded-full transition-all relative flex-shrink-0",
                      field.value ? "bg-[var(--color-warning-solid)]" : "bg-[var(--color-muted-foreground)]/30"
                    )}>
                      <div className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all",
                        field.value ? "left-5" : "left-1"
                      )} />
                    </div>
                  </button>
                )}
              />
              )}

              {!parentKpi && (
                <Controller
                  name="isBonusKpi"
                  control={control}
                  render={({ field }) => (
                    <button
                      type="button"
                      onClick={() => field.onChange(!field.value)}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-3 rounded-card border-2 transition-all text-left",
                        field.value
                          ? "border-[var(--color-success-border)] bg-[var(--color-success-bg)]"
                          : "border-[var(--color-border)] bg-[var(--color-background)] hover:border-[var(--color-primary)]/50"
                      )}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={cn("text-sm font-medium", field.value ? "text-[var(--color-success)]" : "text-[var(--color-foreground)]")}>
                            KPI Thưởng
                          </span>
                          <div className="relative group/tooltip">
                            <div className="w-4 h-4 rounded-full bg-[var(--color-muted-foreground)]/20 hover:bg-[var(--color-success-bg)] dark:hover:bg-[var(--color-success-bg)] flex items-center justify-center cursor-help transition-colors">
                              <span className="text-caption group-hover/tooltip:text-[var(--color-success)] leading-none transition-colors">?</span>
                            </div>
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 rounded-card bg-[var(--color-foreground)] text-[var(--color-background)] text-xs leading-relaxed shadow-2xl opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all duration-200 z-50 scale-95 group-hover/tooltip:scale-100">
                              <p className="font-semibold text-emerald-300 dark:text-emerald-700 mb-1.5">KPI Thưởng là gì?</p>
                              <p className="font-medium opacity-90">KPI <span className="text-emerald-300 dark:text-emerald-700 font-semibold">tùy chọn</span>, không tính vào tổng 100% trọng số của đơn vị.</p>
                              <p className="font-medium opacity-80 mt-1.5">Không làm cũng không sao. Nếu hoàn thành, điểm sẽ được <span className="text-emerald-300 dark:text-emerald-700 font-semibold">cộng thêm</span> vào tổng điểm đánh giá.</p>
                              <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[var(--color-foreground)]" />
                            </div>
                          </div>
                        </div>
                        <div className="text-caption mt-0.5">
                          Không bắt buộc, không tính vào 100% trọng số, hoàn thành thì được cộng điểm thêm
                        </div>
                      </div>
                      <div className={cn(
                        "w-10 h-6 rounded-full transition-all relative flex-shrink-0",
                        field.value ? "bg-[var(--color-success-solid)]" : "bg-[var(--color-muted-foreground)]/30"
                      )}>
                        <div className={cn(
                          "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all",
                          field.value ? "left-5" : "left-1"
                        )} />
                      </div>
                    </button>
                  )}
                />
              )}
          </div>
          {!isPendingApproval && (
          <div className="grid grid-cols-2 gap-4">
            {/* Đợt bị khoá thì bỏ hẳn ô này: bước trước của trình thiết lập đã chọn, và thẻ
                "Đang lập cho" bên phải đã hiện tên đợt. Bày thêm một ô nữa chỉ làm rối. */}
            {!lockedPeriodId && (
              <div>
                <label className="text-label block mb-1.5">Đợt đánh giá <span className="text-[var(--color-error)]">*</span></label>
                <Controller name="kpiPeriodId" control={control}
                  render={({ field }) => (
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <SelectTrigger className={cn(inputCls, 'h-auto', errors.kpiPeriodId && 'ring-2 ring-[var(--color-error-solid)]')}>
                        <SelectValue placeholder="Chọn đợt..." />
                      </SelectTrigger>
                      <SelectContent className="z-[1100]">
                        {periodsData?.content.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.kpiPeriodId && <p className="text-[var(--color-error)] text-xs mt-1 font-medium">{errors.kpiPeriodId.message}</p>}
              </div>
            )}
            <div>
              <label className="text-label block mb-1.5">Tần suất chốt <span className="text-[var(--color-error)]">*</span></label>
              <Controller name="frequency" control={control}
                render={({ field }) => (
                  <Select value={field.value || ''} onValueChange={field.onChange}>
                    <SelectTrigger className={cn(inputCls, 'h-auto')}>
                      <SelectValue placeholder="Chọn tần suất..." />
                    </SelectTrigger>
                    <SelectContent className="z-[1100]">
                      {filteredFrequencyOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="col-span-2">
              <label className="text-label block mb-1.5">Hạn chót</label>
              <Controller name="deadline" control={control}
                render={({ field }) => (
                  <DateTimePicker
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder="Chưa chọn (mặc định theo đợt)"
                    className={cn(!selectedPeriod && 'opacity-50 pointer-events-none')}
                  />
                )}
              />
              {selectedPeriod && (
                <p className="text-caption mt-1">
                  Để trống = mặc định theo ngày kết thúc đợt ({formatDateTime(selectedPeriod.endDate)})
                </p>
              )}
            </div>
          </div>
          )}
          </div>

          <div className={isInline ? "flex-1 min-w-0 flex flex-col gap-5" : "contents"}>

          {/* Đơn vị và Thành viên gộp thành MỘT ô lưới: chọn đơn vị xong là danh sách nhân sự
              nằm ngay dưới. Để rời ra, lưới hai cột đẩy chúng nằm chéo nhau trên màn hình dù
              về nghiệp vụ cái sau phụ thuộc hoàn toàn vào cái trước. */}
          <div className="space-y-4">
          {!isPendingApproval && flatOrgUnits.length > 0  && (
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-label block flex items-center gap-2">
                          <LayoutGrid size={16} className="text-[var(--color-primary)]" />
                          Đơn vị thực hiện
                      </label>
                      {enableOkr && (
                        <p className="text-xs text-[var(--color-primary)] font-medium animate-pulse italic">
                          * Chế độ OKR đang bật: Chỉ chọn được 1 đơn vị
                        </p>
                      )}
                    </div>
                    {/* Ở chế độ thu gọn, nút này vừa là nhãn tóm tắt vừa là lối bung danh sách ra. */}
                    {compactOrgUnits ? (
                      <Button variant="ghost" type="button" onClick={() => setOrgUnitsExpanded(v => !v)}>
                        {orgUnitsExpanded ? 'Xong' : 'Đổi'}
                      </Button>
                    ) : (
                      <span className="rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]">
                          {formOrgUnitIds.length} đã chọn
                      </span>
                    )}
                </div>

                {/* Thu gọn: một dòng nói rõ đang giao cho đâu, thay cho danh sách cuộn cao 144px
                    mà lần nào cũng phải tự đi tích dù gần như luôn là đơn vị của chính mình. */}
                {compactOrgUnits && !orgUnitsExpanded && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-control border border-[var(--color-border)] bg-[var(--color-accent)]/20 text-sm font-medium">
                    <LayoutGrid size={13} className="shrink-0 text-[var(--color-muted-foreground)]" />
                    <span className="truncate">
                      {formOrgUnitIds.length === 0
                        ? 'Chưa chọn đơn vị'
                        : formOrgUnitIds.length === 1
                          ? (flatOrgUnits.find(u => u.id === formOrgUnitIds[0])?.name ?? '1 đơn vị')
                          : `${formOrgUnitIds.length} đơn vị`}
                    </span>
                  </div>
                )}

                <div className={cn(
                  'border border-[var(--color-border)] rounded-card bg-[var(--color-background)]',
                  compactOrgUnits && !orgUnitsExpanded && 'hidden',
                )}>
                    <div className="max-h-36 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {flatOrgUnits.map(unit => (
                            <div 
                                key={unit.id} 
                                onClick={() => toggleOrgUnit(unit.id)}
                                className={cn(
                                    "flex items-center justify-between px-3 py-1.5 text-xs rounded-control cursor-pointer transition-all",
                                    formOrgUnitIds.includes(unit.id) 
                                        ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] font-semibold"
                                        : "hover:bg-[var(--color-accent)]"
                                )}
                            >
                                <span className="truncate">{unit.levelLabel}</span>
                                {formOrgUnitIds.includes(unit.id) && <Check size={14} />}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          )}

          {!isPendingApproval && (<div className="bg-[var(--color-primary)]/5 rounded-card p-4 space-y-4 border border-[var(--color-primary)]/10 shadow-sm transition-all overflow-hidden">
            <div className="flex items-center justify-between">
                <label className="text-label block flex items-center gap-2">
                    <Users size={16} className="text-[var(--color-primary)]" />
                    Giao thực hiện
                </label>
                {!isStaff && !lockAssignees && (
                    <div className="text-eyebrow px-2.5 py-1 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                        {totalMemberCount} nhân sự khả dụng
                    </div>
                )}
            </div>

            {/* `lockAssignees` dùng chung đúng thẻ gọn này với nhân viên: cả hai đều là "người nhận
                chỉ là chính bạn", chỉ khác lý do — một bên do quyền, một bên do luồng. */}
            {isStaff || lockAssignees ? (
                <div className="bg-[var(--color-card)] border border-[var(--color-primary)]/20 rounded-card p-4 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center gap-3">
                        <UserAvatar
                            fullName={user?.fullName}
                            avatarUrl={user?.avatarUrl}
                            className="w-10 h-10 rounded-full"
                            fallbackClassName="bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold text-lg"
                        />
                        <div className="flex-1">
                            <div className="text-sm font-medium">{user?.fullName} <span className="text-[var(--color-primary)]">(Bản thân)</span></div>
                            <div className="text-caption font-medium">{user?.email}</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-none font-semibold text-xs">
                                Đang chọn
                            </Badge>
                            <div className="bg-[var(--color-primary)] text-[var(--color-primary-foreground)] rounded-full p-1">
                                <Check size={12} strokeWidth={3} />
                            </div>
                        </div>
                    </div>
                </div>
            ) : formOrgUnitIds.length > 0 ? (
                <>
                <div className="flex flex-wrap gap-2 items-center animate-in fade-in slide-in-from-top-1">
                    <span className="text-eyebrow shrink-0">Role:</span>
                    <ChoiceChip selected={selectedRole === 'ALL'} variant="solid" size="sm" className="py-1 shrink-0" onClick={() => setSelectedRole('ALL')}>
                        Tất cả
                    </ChoiceChip>
                    {availableRolesForFilter.map(role => (
                        <ChoiceChip selected={selectedRole === role.name} variant="solid" size="sm" className="py-1 shrink-0" key={role.id} onClick={() => setSelectedRole(role.name)}>
                            {role.name}
                        </ChoiceChip>
                    ))}
                </div>
                
                <div className="border border-[var(--color-border)] rounded-card overflow-hidden bg-[var(--color-background)] animate-in fade-in slide-in-from-top-2">
                <div className="p-2 border-b border-[var(--color-border)] bg-[var(--color-accent)]/5">
                    <input 
                    type="text"
                    placeholder="Họ tên hoặc Email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-control border border-[var(--color-border)] bg-[var(--color-background)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 transition-all shadow-sm"
                    />
                </div>
                <div className="max-h-48 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                    {isLoadingUsers ? (
                    <div className="p-12 flex flex-col items-center justify-center gap-3 text-xs text-[var(--color-muted-foreground)] font-medium">
                        <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
                        <span className="opacity-60">Đang đồng bộ...</span>
                    </div>
                    ) : displayUsers.length === 0 ? (
                        <div className="p-12 text-center text-xs text-[var(--color-muted-foreground)] font-medium italic">
                            Không tìm thấy nhân sự phù hợp theo tiêu chí lọc
                        </div>
                    ) : (
                    displayUsers.map((u) => (
                        <div 
                        key={u.id}
                        onClick={() => toggleAssignee(u.id)}
                        className={cn(
                            "flex items-center justify-between px-3 py-2.5 rounded-card cursor-pointer transition-all",
                            selectedAssignees.includes(u.id) 
                                ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] scale-[1.01] font-semibold"
                                : "hover:bg-[var(--color-accent)] group"
                        )}
                        >
                        <div className="flex flex-col">
                            <span className="text-sm">{u.fullName}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={cn("text-xs font-medium opacity-70", selectedAssignees.includes(u.id) ? "text-white" : "text-[var(--color-muted-foreground)]")}>{u.email}</span>
                                {u.memberships?.[0] && (
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded text-xs font-medium",
                                        selectedAssignees.includes(u.id) ? "bg-white/20 text-white" : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                                    )}>
                                        {u.memberships[0].roleDisplayName}
                                    </span>
                                )}
                            </div>
                        </div>
                        {selectedAssignees.includes(u.id) && (
                            <div className="bg-white rounded-full p-0.5 animate-in zoom-in">
                                <Check size={12} className="text-[var(--color-primary)]" />
                            </div>
                        )}
                        </div>
                    ))
                    )}
                </div>
                </div>
                </>
            ) : (
                <div className="text-eyebrow p-10 text-center italic bg-[var(--color-background)]/50 rounded-card border border-dashed border-[var(--color-border)] animate-pulse">
                     Vui lòng chọn đơn vị thực hiện để hiển thị danh sách nhân sự
                </div>
            )}
          </div>)}

          </div>


          {!isPendingApproval && enableOkr && (
            <div className="bg-[var(--color-primary-soft)] p-4 rounded-card border border-[var(--color-border)] space-y-3">
              <div className="flex items-center gap-2 text-[var(--color-primary)]">
                <Target size={16} />
                <span className="text-eyebrow">Đẩy tiến độ OKR Chiến lược</span>
              </div>
              <div className="space-y-1">
                <label className="text-label block text-[var(--color-muted-foreground)] tracking-tight">Gắn kết Kết quả then chốt (KR)</label>
                <Controller
                  name="keyResultId"
                  control={control}
                  render={({ field }) => (
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value || "NONE"}
                      disabled={isEdit && !!editKpi?.keyResultId}
                    >
                      <SelectTrigger className={cn(
                        "w-full rounded-card border-[var(--color-border)] bg-[var(--color-card)] focus:ring-[var(--color-ring)] transition-all h-11 shadow-sm overflow-hidden",
                        isEdit && !!editKpi?.keyResultId && "bg-[var(--color-muted)] cursor-not-allowed opacity-70"
                      )}>
                        <SelectValue placeholder="-- Không liên kết --" className="truncate flex-1 min-w-0 text-left" />
                      </SelectTrigger>
                      <SelectContent className="z-[1100] rounded-card border-[var(--color-border)] shadow-2xl max-h-[350px] overflow-auto">
                        <SelectItem value="NONE" className="font-semibold py-3">-- Không liên kết mục tiêu --</SelectItem>
                        {filteredObjectives.map(obj => (
                          <SelectGroup key={obj.id} className="p-1">
                            <SelectLabel className="text-eyebrow px-3 py-2 text-[var(--color-primary)] bg-[var(--color-primary-soft)] rounded-card my-1.5 flex items-start justify-between gap-2">
                              <span>OBJ: {obj.name}</span>
                              <Badge variant="outline" className="text-xs border-[var(--color-border)] shrink-0">OKR</Badge>
                            </SelectLabel>
                            {obj.keyResults.map((kr: any) => (
                              <SelectItem
                                key={kr.id}
                                value={kr.id}
                                className="rounded-card py-2.5 pl-8 pr-3 focus:bg-[var(--color-primary-soft)] focus:text-[var(--color-primary)] transition-colors"
                                              >
                                <span className="font-semibold text-xs truncate block" title={kr.name}>{kr.name}</span>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          )}

          {!isPendingApproval && enableBsc && (
            <div className="bg-[var(--color-primary-soft)] p-4 rounded-card border border-[var(--color-border)] space-y-3">
              <div className="flex items-center justify-between gap-2 text-[var(--color-primary)]">
                <div className="flex items-center gap-2">
                  <LayoutGrid size={16} />
                  <span className="text-eyebrow">Hạng mục BSC</span>
                </div>
                {/* Đường đi ngược: bắt đầu TỪ con số của hạng mục (VD doanh thu 100 triệu cho kỳ
                    2 đợt) rồi chia ra KPI từng đợt, thay vì gõ tay rồi mới nhớ gán hạng mục. */}
                {onSplitFromBsc && !isEdit && !parentKpi && (
                  <Button size="sm" type="button" onClick={onSplitFromBsc} title="Lấy mục tiêu của hạng mục BSC và chia ra KPI theo từng đợt">
                    <SplitSquareHorizontal aria-hidden="true" /> Dùng hạng mục BSC
                  </Button>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-label block text-[var(--color-muted-foreground)] tracking-tight">Gắn chỉ tiêu vào hạng mục (theo lĩnh vực)</label>
                <Controller
                  name="perspectiveId"
                  control={control}
                  render={({ field }) => (
                    // key ép remount khi value được nạp (reset async) hoặc danh sách hạng mục
                    // load xong → hiện đúng ngay lần mở đầu, không phải mở lần 2.
                    <Select key={`${field.value ?? 'NONE'}-${(perspectives || []).length}`} onValueChange={field.onChange} value={field.value || 'NONE'}>
                      <SelectTrigger className="w-full rounded-card border-[var(--color-border)] bg-[var(--color-card)] focus:ring-[var(--color-ring)] transition-all h-11 shadow-sm overflow-hidden">
                        <SelectValue placeholder="-- Chưa gán hạng mục --" className="truncate flex-1 min-w-0 text-left" />
                      </SelectTrigger>
                      <SelectContent className="z-[1100] rounded-card border-[var(--color-border)] shadow-2xl max-h-[350px] overflow-auto">
                        <SelectItem value="NONE" className="font-semibold py-3">-- Chưa gán hạng mục --</SelectItem>
                        {filteredGroupedPerspectives.map(group => (
                          <div key={group.code}>
                            <div className="text-eyebrow px-3 pt-2 pb-1">{group.name}</div>
                            {group.items.map(p => (
                              <SelectItem key={p.id} value={p.id} className="rounded-card py-2.5 pl-3 pr-3 focus:bg-[var(--color-primary-soft)] focus:text-[var(--color-primary)] transition-colors"
                                extra={perspectiveNumbers.get(p.id) && (
                                  <span className="ml-auto pl-3 text-caption whitespace-nowrap">
                                    {perspectiveNumbers.get(p.id)}
                                  </span>
                                )}>
                                <span className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color || '#94a3b8' }} />
                                  <span className="font-semibold text-xs truncate">{p.name}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {(!watchedPerspectiveId || watchedPerspectiveId === 'NONE') && inheritedPerspective && (
                  <p className="text-caption flex items-start gap-1.5 mt-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: inheritedPerspective.color }} />
                    <span>
                      Đang kế thừa hạng mục <b className="text-[var(--color-foreground)]">"{inheritedPerspective.name}"</b> từ mục tiêu cha. Chọn ở đây để gán đè trực tiếp.
                    </span>
                  </p>
                )}
                <p className="text-caption mt-1.5">
                  Lưu ý: tổng trọng số các chỉ tiêu trong cùng 1 hạng mục phải bằng <b>100%</b>. Hệ thống sẽ <b>chặn phê duyệt</b> nếu chưa đủ 100%.
                </p>
                {selectedPerspMissing && (
                  <p className="text-xs font-medium text-[var(--color-warning)] flex items-start gap-1.5 mt-1.5">
                    <span className="shrink-0">⚠</span>
                    Hạng mục đang gán <b>chưa có trong bộ tiêu chí</b> của đơn vị bạn chọn ⇒ KPI sẽ <b>không tính vào điểm BSC</b>. Hãy thêm hạng mục này vào bộ tiêu chí cho phòng ban đó.
                  </p>
                )}
                {availablePerspectiveIds && !formKpiPeriodId && (
                  <p className="text-xs font-medium text-[var(--color-warning)] flex items-start gap-1.5 mt-1.5">
                    <span className="shrink-0">⚠</span>
                    Hãy <b>chọn Đợt đánh giá trước</b> — hạng mục hiện theo bộ tiêu chí của đợt + đơn vị.
                  </p>
                )}
                {availablePerspectiveIds && formKpiPeriodId && !periodHasScorecard && (
                  <p className="text-xs font-medium text-[var(--color-warning)] flex items-start gap-1.5 mt-1.5">
                    <span className="shrink-0">⚠</span>
                    Đợt này <b>chưa có bộ tiêu chí BSC</b> — hãy tạo bộ tiêu chí cho đợt (gồm các hạng mục) thì mới chọn được hạng mục.
                  </p>
                )}
                {availablePerspectiveIds && formKpiPeriodId && periodHasScorecard && !hasRealUnit && (
                  <p className="text-xs font-medium text-[var(--color-warning)] flex items-start gap-1.5 mt-1.5">
                    <span className="shrink-0">⚠</span>
                    Hãy <b>chọn Đơn vị thực hiện trước</b> — hạng mục hiện theo bộ tiêu chí của đơn vị đó.
                  </p>
                )}
                {availablePerspectiveIds && periodHasScorecard && hasRealUnit && filteredGroupedPerspectives.length === 0 && (
                  <p className="text-xs font-medium text-[var(--color-warning)] flex items-start gap-1.5 mt-1.5">
                    <span className="shrink-0">⚠</span>
                    Bộ tiêu chí của phòng ban bạn chọn <b>chưa có hạng mục nào</b> — hãy thêm hạng mục vào bộ tiêu chí cho phòng ban đó trước.
                  </p>
                )}
              </div>
            </div>
          )}
          </div>
          </div>

          {isInline && (
            <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-4">
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                {submitLabel ?? (isEdit ? 'Lưu thay đổi' : 'Tạo chỉ tiêu')}
              </Button>
            </div>
            )}
        </form>
    </>
  )

  if (isInline) return formBody

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      dismissible={!isPending}
      title={isEdit ? 'Sửa chỉ tiêu' : parentKpi ? (parentRelationType === 'DECOMPOSITION' ? 'Thêm KPI con' : 'Phân rã chỉ tiêu') : 'Tạo chỉ tiêu'}
      description={isEdit ? 'Thay đổi có hiệu lực sau khi lưu; chỉ tiêu đã duyệt cần gửi duyệt lại.' : 'Điền thông tin chỉ tiêu, giao cho nhân sự hoặc đơn vị, rồi gửi duyệt sau.'}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={isPending}>Hủy</Button>}
          primary={
            <Button type="submit" form="kpi-form" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {submitLabel ?? (isEdit ? 'Lưu thay đổi' : 'Tạo chỉ tiêu')}
            </Button>
          }
        />
      }
    >
        {formBody}
    </Dialog>
  )
}

/** Thẻ nhỏ hiện một thông số của gợi ý AI (mục tiêu, trọng số, tần suất). */
function SuggestionChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-control border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-2 py-0.5 text-xs font-medium text-[var(--color-info)]">
      <span className="text-[var(--color-muted-foreground)]">{label}</span>
      {value}
    </span>
  )
}
