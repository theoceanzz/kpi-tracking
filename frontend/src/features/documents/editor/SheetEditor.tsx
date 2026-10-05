import { useEffect, useRef } from 'react'
import { CommandType, LocaleType, createUniver, mergeLocales, type IWorkbookData } from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import { UniverSheetsSortPreset } from '@univerjs/preset-sheets-sort'
import { UniverSheetsFilterPreset } from '@univerjs/preset-sheets-filter'
import { UniverSheetsConditionalFormattingPreset } from '@univerjs/preset-sheets-conditional-formatting'
import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation'
import { UniverSheetsFindReplacePreset } from '@univerjs/preset-sheets-find-replace'
import { UniverSheetsHyperLinkPreset } from '@univerjs/preset-sheets-hyper-link'
import CoreVi from '@univerjs/preset-sheets-core/locales/vi-VN'
import CoreEn from '@univerjs/preset-sheets-core/locales/en-US'
import SortVi from '@univerjs/preset-sheets-sort/locales/vi-VN'
import SortEn from '@univerjs/preset-sheets-sort/locales/en-US'
import FilterVi from '@univerjs/preset-sheets-filter/locales/vi-VN'
import FilterEn from '@univerjs/preset-sheets-filter/locales/en-US'
import CfVi from '@univerjs/preset-sheets-conditional-formatting/locales/vi-VN'
import CfEn from '@univerjs/preset-sheets-conditional-formatting/locales/en-US'
import DvVi from '@univerjs/preset-sheets-data-validation/locales/vi-VN'
import DvEn from '@univerjs/preset-sheets-data-validation/locales/en-US'
import FrVi from '@univerjs/preset-sheets-find-replace/locales/vi-VN'
import FrEn from '@univerjs/preset-sheets-find-replace/locales/en-US'
import LinkVi from '@univerjs/preset-sheets-hyper-link/locales/vi-VN'
import LinkEn from '@univerjs/preset-sheets-hyper-link/locales/en-US'
import '@univerjs/preset-sheets-core/lib/index.css'
import '@univerjs/preset-sheets-sort/lib/index.css'
import '@univerjs/preset-sheets-filter/lib/index.css'
import '@univerjs/preset-sheets-conditional-formatting/lib/index.css'
import '@univerjs/preset-sheets-data-validation/lib/index.css'
import '@univerjs/preset-sheets-find-replace/lib/index.css'
import '@univerjs/preset-sheets-hyper-link/lib/index.css'

/**
 * Mutation không phải do người dùng sửa dữ liệu mà Univer tự sinh khi mở / vẽ: tính công thức ({@code formula.*}), ô soạn
 * ẩn bên trong tự khởi tạo và nhận từng phím gõ ({@code doc.*} — gõ xong một ô thì Univer phát {@code sheet.mutation.*}
 * riêng), tự đo chiều cao hàng, đổi trang tính đang xem. Không tính là "có thay đổi" — nếu không, chỉ mở bảng tính ra xem
 * cũng kích hoạt tự lưu (và người chỉ có quyền xem nhận lỗi).
 */
const IGNORED_MUTATION = /^(formula|doc)\.|auto-height|set-worksheet-active/

interface Props {
  /** Snapshot ban đầu (nội dung `.kgsheet`); null = bảng tính trống. */
  initial: IWorkbookData | null
  editable: boolean
  dark: boolean
  language: string
  onChange: () => void
  /** Bên gọi nhận hàm đọc snapshot hiện tại (để tự lưu / xuất tệp). */
  readerRef: React.MutableRefObject<(() => IWorkbookData | null) | null>
}

/**
 * Trình bảng tính kiểu Lark Sheets / Google Sheets — Univer (Apache-2.0): nhiều trang tính, công thức, định dạng số,
 * gộp ô, sắp xếp, lọc, định dạng có điều kiện, kiểm tra dữ liệu, tìm/thay, liên kết. Univer tự vẽ giao diện vào một
 * thẻ div; component này chỉ tạo / huỷ nó theo vòng đời React và nối sự kiện thay đổi vào tự lưu.
 */
export default function SheetEditor({ initial, editable, dark, language, onChange, readerRef }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const api = useRef<ReturnType<typeof createUniver>['univerAPI'] | null>(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })

  useEffect(() => {
    if (!container.current) return
    const en = language.startsWith('en')
    const { univer, univerAPI } = createUniver({
      locale: en ? LocaleType.EN_US : LocaleType.VI_VN,
      locales: {
        [LocaleType.VI_VN]: mergeLocales(CoreVi, SortVi, FilterVi, CfVi, DvVi, FrVi, LinkVi),
        [LocaleType.EN_US]: mergeLocales(CoreEn, SortEn, FilterEn, CfEn, DvEn, FrEn, LinkEn),
      },
      darkMode: dark,
      presets: [
        UniverSheetsCorePreset({ container: container.current }),
        UniverSheetsSortPreset(),
        UniverSheetsFilterPreset(),
        UniverSheetsConditionalFormattingPreset(),
        UniverSheetsDataValidationPreset(),
        UniverSheetsFindReplacePreset(),
        UniverSheetsHyperLinkPreset(),
      ],
    })
    api.current = univerAPI
    const workbook = univerAPI.createWorkbook(initial ?? {})
    if (!editable) workbook.setEditable(false)
    readerRef.current = () => univerAPI.getActiveWorkbook()?.save() ?? null

    const sub = univerAPI.addEvent(univerAPI.Event.CommandExecuted, e => {
      if (e.type === CommandType.MUTATION && !IGNORED_MUTATION.test(e.id)) onChangeRef.current()
    })
    return () => {
      sub.dispose()
      readerRef.current = null
      api.current = null
      univer.dispose()
    }
    // Tạo Univer MỘT lần mỗi lần gắn: đổi snapshot / quyền thì trang cha gắn lại cả component (key).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { api.current?.toggleDarkMode(dark) }, [dark])

  return <div ref={container} className="h-[calc(100vh-220px)] min-h-[520px] w-full" />
}
